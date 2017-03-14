import * as net from "net";
import {IContext, raceContext} from "hlandau.Context";
import {Scope, IAddr, L4Addr, TCPAddr} from "hlandau.Net/Addr";
import {NetLoc, NetLocish, asNetLoc, join} from "hlandau.Net/NetLoc";
import {IResolver, resolver} from "hlandau.Net/Resolver";

/* ...
 *****************************************************************************
 */

export interface IConn {
  close(): Promise<void>;
  read(numBytes: number): Promise<Uint8Array>;
  write(data: Uint8Array | string): Promise<void>;

  readonly localAddr: IAddr;
  readonly remoteAddr: IAddr;
}

class TCPConn implements IConn {
  private __s: net.Socket;
  private __numReaders: number = 0;
  private __localAddr: TCPAddr;
  private __remoteAddr: TCPAddr;

  constructor(s: net.Socket) {
    this.__s = s;
    this.__localAddr = new TCPAddr(s.localAddress, s.localPort);
    this.__remoteAddr = new TCPAddr(s.remoteAddress, s.remotePort);
  }

  async close(): Promise<void> {
    this.__s.destroy();

    // XXX: The close event indicates the handle has actually been closed, but
    // we cannot be sure it will be emitted because it will not be emitted if
    // the socket doesn't currently have a handle. So we can't wait for the
    // handle to actually be closed. This should usually be inconsequential,
    // but could have consequences in some circumstances (e.g. port
    // utilization).
  }

  read(numBytes: number): Promise<Uint8Array> {
    let once = false;
    ++this.__numReaders;
    return new Promise<Uint8Array>((resolve, reject) => {
      const errorHandler = (e: any) => {
        if (once)
          return;

        once = true;
        --this.__numReaders;
        reject(e);
      };

      // Use 'close' event as well as 'error' event so that we get notified if
      // the socket is closed concurrently to this read.
      this.__s.once('error', errorHandler);
      this.__s.once('close', () => { errorHandler(new Error(`The socket was closed.`)); });

      this.__s.once('data', (d) => {
        if (once)
          return;

        once = true;
        --this.__numReaders;
        this.__updateRead();
        resolve(d);
      });
      this.__updateRead();
    });
  }

  write(data: Uint8Array | string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.__s.write(data as string, () => { resolve(); });
    });
  }

  get localAddr(): IAddr { return this.__localAddr; }
  get remoteAddr(): IAddr { return this.__remoteAddr; }

  private __updateRead() {
    if (this.__numReaders > 0)
      this.__s.resume();
    else
      this.__s.pause();
  }

  toString(): string {
    return `[TCPConn: ${this.localAddr} <-> ${this.remoteAddr}]`;
  }
}


/* LISTENING
 *****************************************************************************
 */

export interface IListener {
  close(): Promise<void>;
  accept(ctx: IContext): Promise<IConn>;
  readonly addr: IAddr;
}

interface PendingAccept {
  resolve(x: IConn): void;
  reject(e: Error): void;
}

class TCPListener implements IListener {
  private __s: net.Server;
  private __addr: IAddr;
  private __waiting: net.Socket[] = [];
  private __pendingAccepts: PendingAccept[] = [];
  private __closed: boolean = false;

  constructor(s: net.Server) {
    this.__s = s;

    s.on('listening', () => {
      const addr = s.address();
      this.__addr = TCPAddr.resolve('tcp', [addr.address, addr.port.toString()]);
    });

    s.on('connection', (s: net.Socket) => {
      const a = this.__pendingAccepts.pop();
      if (a) {
        a.resolve(new TCPConn(s));
        return;
      }

      this.__waiting.push(s);
    });
  }

  close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.__closed = true;
      this.__s.close(() => {
        this.__rejectPending();
        resolve();
      });
    });
  }

  private __rejectPending() {
    const err = new Error(`The listener was closed.`);
    for (const o of this.__pendingAccepts)
      o.reject(err);
    this.__pendingAccepts = [];

    for (const w of this.__waiting)
      w.destroy();
    this.__waiting = [];
  }

  async accept(ctx: IContext): Promise<IConn> {
    if (this.__closed)
      throw new Error(`The listener was closed.`);

    if (ctx.error !== null)
      throw ctx.error;

    const w = this.__waiting.pop();
    if (w)
      return new TCPConn(w);

    return raceContext(ctx, () => new Promise<IConn>((resolve, reject) => {
      this.__pendingAccepts.push({resolve, reject});
    }), (conn: IConn) => { conn.close(); });
  }

  get addr(): IAddr { return this.__addr; }
}

export function listen(scope: Scope, addr: NetLocish): Promise<IListener> {
  switch (scope) {
    case "tcp":
    case "tcp4":
    case "tcp6":
      return listenTCP(scope, addr);
    default:
      throw new Error(`unknown scope: "${scope}"`);
  }
}

export async function listenTCP(scope: Scope, addr: NetLocish): Promise<IListener> {
  const tcpa = TCPAddr.resolve(scope, addr);
  const s = (net.createServer as any)({pauseOnConnect: true});
  const l = new TCPListener(s);
  return new Promise<IListener>((resolve, reject) => {
    s.once('listening', () => { resolve(l); });
    s.once('error', (e: Error) => { reject(e); });
    s.listen({host: tcpa.ipZone, port: tcpa.port});
  });
}


/* DIALLING
 *****************************************************************************
 * Facilities for establishing connections.
 */

export interface IDialer {
  dial(ctx: IContext, scope: Scope, addr: NetLocish): Promise<IConn>;
}

export class Dialer implements IDialer {
  // Optional local bind address. If not specified, a local bind address is
  // chosen automatically.
  localAddr: IAddr | null = null;

  // Optional custom resolver used for hostname lookups. If not specified, a
  // default resolver is used.
  resolver: IResolver | null = null;

  /*// RFC 6555.
  happyEyeballs: boolean = false;
  fallbackDelay: number = -1; // ms. Happy Eyeballs fallback delay.

  // ms. Keepalive interval. -1: Disable keepalives.
  keepAliveInterval: number = -1;*/

  constructor() {
  }

  // Connects to the specified address within the specified scope using the
  // provided context.
  //
  // If the provided context expires before the connection is complete, an
  // error is thrown. Once successfully connected, context expiry will not
  // affect the connection.
  //
  // The address format is a NetLocish: either a NetLoc ([host: string, port:
  // string]) or a string which can be parsed to a NetLoc ('127.0.0.1:80',
  // '[::1]:80', '[fe80::beef%eth0]:80', 'example.com:80').
  //
  // If hostname resolution results in multiple addresses, they will be tried
  // in sequence until one succeeds.
  dial(ctx: IContext, scope: Scope, addr: NetLocish): Promise<IConn> {
    const nl = asNetLoc(addr);

    switch (scope) {
      case "tcp":
      case "tcp4":
      case "tcp6":
        return dialTCP(ctx, this, scope, nl);

      default:
        throw new Error(`unknown scope: "${scope}"`);
    }
  }
}

function scopeAcceptsEndpoint(scope: Scope, endp: L4Addr): boolean {
  const lch = scope[scope.length-1];
  if (lch === '4')
    return net.isIPv4(endp.ip);
  else if (lch === '6')
    return net.isIPv6(endp.ip);
  else
    return true;
}

async function dialTCP(ctx: IContext, d: Dialer, scope: Scope, addr: NetLoc): Promise<IConn> {
  const resolver_ = d.resolver || resolver;
  let endpoints: NetLoc[] = [addr];

  if (ctx.error !== null)
    throw ctx.error;

  if (d.localAddr && !(d.localAddr instanceof L4Addr))
    throw new Error(`dial local address must be a L4 address: "${d.localAddr}"`);

  if (!net.isIP(addr[0])) {
    const res = await resolver_.lookupHost(ctx, addr[0]);
    endpoints = res.addrs.map((ip: string): NetLoc => [ip, addr[1]]);
  }

  for (const endp of endpoints) {
    if (ctx.error !== null)
      throw ctx.error;

    const tcpa = TCPAddr.resolve(scope, endp);
    if (!scopeAcceptsEndpoint(scope, tcpa))
      continue;

    try {
      const conn = await dialTCPEndpoint(ctx, d, scope, tcpa);
      return conn;
    } catch (e) {}
  }

  throw new Error(`could not connect to any endpoint for "${join(addr)}"`);
}

function dialTCPEndpoint(ctx: IContext, d: Dialer, scope: Scope, addr: TCPAddr): Promise<IConn> {
  return raceContext(ctx, () => new Promise<IConn>((resolve, reject) => {
    const s = net.createConnection({
      host: addr.ipZone,
      port: addr.port,
      localAddress: d.localAddr ? (d.localAddr as L4Addr).ipZone : undefined,
      localPort: d.localAddr ? (d.localAddr as L4Addr).port.toString() : undefined,
    });
    s.once('connect', () => resolve(new TCPConn(s)));
    s.once('error', reject);
  }), (conn: IConn) => { conn.close(); });
}

// The default Dialer. This can be configured or replaced if global changes to
// Dialer configuration are desired. However, you should probably avoid doing
// this in most cases.
export let dialer: IDialer = new Dialer();

// Dials using the default dialer, which is whatever IDialer is currently
// referenced by module-level variable 'dialer'.
//
// See Dialer.dial for documentation.
export function dial(ctx: IContext, scope: Scope, addr: NetLocish): Promise<IConn> {
  return dialer.dial(ctx, scope, addr);
}

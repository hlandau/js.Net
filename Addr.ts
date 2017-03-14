import * as net from "net";
import {NetLoc, NetLocish, asNetLoc} from "hlandau.Net/NetLoc";

// Returns [ip, zone | ''].
function splitIPv6Zone(ip: string): [string, string] {
  const idx = ip.indexOf('%');
  if (idx < 0)
    return [ip, ''];

  return [ip.substr(0, idx), ip.substr(idx+1)];
}

export type Scope = "tcp" | "tcp4" | "tcp6" | "udp" | "udp4" | "udp6" | "ip" | "ip4" | "ip6" | "unix" | "unixgram" | "unixpacket";

function isIPv6NoZone(s: string): boolean {
  return net.isIPv6(s) && s.indexOf('%') < 0;
}

function isValidIPNoZone(s: string): boolean {
  return (typeof s === 'string') && (net.isIPv4(s) || isIPv6NoZone(s));
}
function assertValidIPNoZone(s: string) {
  if (!isValidIPNoZone(s))
    throw new Error(`not a valid IPv4 or IPv6 address: "${s}"`);
}

function isValidPort(n: number): boolean {
  return (typeof n === 'number' && n >= 0 && n <= 65535 && n % 1 === 0);
}
function assertValidPort(port: number) {
  if (!isValidPort(port))
    throw new Error(`port number must be an integer in range [0,65535], not "${port}"`);
}

function isValidZone(z: string): boolean {
  return (typeof z === 'string');
}
function assertValidZone(z: string) {
  if (!isValidZone(z))
    throw new Error(`not a valid zone name: "${z}"`);
}


/* ADDRESSING
 *****************************************************************************
 * Immutable objects representing parsed L3 or L4 addresses.
 *
 * You can produce these from NetLocs.
 */

export interface IAddr {
  readonly network: string; // 'ip' | 'tcp' | 'udp' | unknown-string
  toString(): string;
}

/* IPAddr
 * ------
 * Models a logical IP address (including a zone name, or a specification of no
 * particular zone). Immutable.
 */
export class IPAddr implements IAddr {
  private __ip: string;
  private __zone: string;

  constructor(ip: string, zone: string='') {
    assertValidIPNoZone(ip);
    assertValidZone(zone);

    this.__ip   = ip;
    this.__zone = zone;

    Object.freeze(this);
  }

  get network(): string { return 'ip'; }
  get ip(): string { return this.__ip; }
  get zone(): string { return this.__zone; }

  toString(): string {
    return `${this.__ip}${this.__zone !== '' ? '%'+this.__zone : ''}`;
  }

  static resolve(addr: string): IPAddr {
    if (net.isIPv6(addr)) {
      const [ip, zone] = splitIPv6Zone(addr);
      return new IPAddr(ip, zone);
    } else
      return new IPAddr(addr);
  }
}

/* L4Addr
 * ------
 * Models common L4 address types which use an (IP, port) tuple to address
 * their endpoints. Immutable.
 */
export abstract class L4Addr implements IAddr {
  private __ip: string;
  private __port: number;
  private __zone: string;

  constructor(ip: string, port: number, zone: string='') {
    assertValidIPNoZone(ip);
    assertValidPort(port);
    assertValidZone(zone);

    this.__ip = ip;
    this.__port = port;
    this.__zone = zone;

    Object.freeze(this);
  }

  abstract get network(): string;
  get ip(): string { return this.__ip; }
  get port(): number { return this.__port; }
  get zone(): string { return this.__zone; }

  get ipZone(): string { return `${this.ip}${this.zone !== '' ? ('%'+this.zone) : ''}`; }
  get netLoc(): NetLoc { return [this.ip, this.port.toString()]; }

  toString(): string {
    return (this.ip.indexOf(':') >= 0)
    ? `[${this.ipZone}]:${this.port}`
    : `${this.ip}:${this.port}`;
  }
}

function strictParseInt(x: string): number {
  // don't use parseInt because it ignores trailing data
  const n = Number(x);
  if (isNaN(n) || n%1 !== 0)
    throw new Error(`value is not an integer: "${x}"`);

  return n;
}

interface cons<T> {
  new(ip: string, port: number, zone: string): T;
}

function parseL4<T>(x: cons<T>, addr: NetLocish): T {
  const nl = asNetLoc(addr);
  let ip = nl[0];
  let zone = '';
  if (net.isIPv6(ip))
    [ip, zone] = splitIPv6Zone(ip);

  return new x(ip, strictParseInt(nl[1]), zone);
}

export class TCPAddr extends L4Addr {
  get network(): string { return 'tcp'; }

  static resolve(scope: Scope, addr: NetLocish): TCPAddr {
    return parseL4(TCPAddr, addr);
  }
}

export class UDPAddr extends L4Addr {
  get network(): string { return 'udp'; }

  static resolve(scope: Scope, addr: NetLocish): UDPAddr {
    return parseL4(UDPAddr, addr);
  }
}

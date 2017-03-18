import * as net from "net";
import {NetLoc, NetLocish, asNetLoc} from "hlandau.Net/NetLoc";
import * as IPFuncs from "hlandau.Net/IPFuncs";

export type Scope = "tcp" | "tcp4" | "tcp6" | "udp" | "udp4" | "udp6" | "ip" | "ip4" | "ip6" | "unix" | "unixgram" | "unixpacket";

function isValidPort(n: number): boolean {
  return (typeof n === 'number' && n >= 0 && n <= 65535 && n % 1 === 0);
}
function assertValidPort(port: number) {
  if (!isValidPort(port))
    throw new Error(`port number must be an integer in range [0,65535], not "${port}"`);
}
function assertValidZone(z: string) {
  if (typeof z !== 'string' || (z !== '' && !IPFuncs.validateZoneName(z)))
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

/* IP
 * --
 * Represents an IP address number. Does not include a zone name. Immutable.
 */
export type IPish = IP | string | Uint8Array;

export class IP {
  private __ip: Uint8Array; // length 4 or 16

  constructor(ip: IPish) {
    if (typeof ip === 'string')
      this.__ip = IPFuncs.parseIP(ip);
    else if (ip instanceof Uint8Array && (ip.length === 4 || ip.length === 16))
      this.__ip = ip;
    else if (ip instanceof IP)
      return ip;
    else
      throw new Error(`IP constructor requires a string or Uint8Array of length 4 or 16`);

    Object.freeze(this);
  }

  // Do not modify the bytes!
  get bytes(): Uint8Array { return this.__ip; }
  get isV6(): boolean { return this.__ip.length === 16; }
  get isV4(): boolean { return !this.isV6; }

  toString(): string { return IPFuncs.stringifyIP(this.__ip); }
  inspect(): string { return `IP(${this.toString()})`; }
}

/* IPAddr
 * ------
 * Models a logical IP address (including a zone name, or a specification of no
 * particular zone). Immutable.
 */
export class IPAddr implements IAddr {
  private __ip: IP;
  private __zone: string;

  constructor(ip: IPish, zone: string='') {
    assertValidZone(zone);

    this.__ip   = new IP(ip);
    this.__zone = zone;

    Object.freeze(this);
  }

  get network(): string { return 'ip'; }
  get ip(): IP { return this.__ip; }
  get zone(): string { return this.__zone; }

  toString(): string {
    return `${this.__ip}${this.__zone !== '' ? '%'+this.__zone : ''}`;
  }

  static resolve(addr: string): IPAddr {
    const [ip, zone] = IPFuncs.parseIPAddr(addr);
    return new IPAddr(ip, zone || '');
  }
}

/* IPNet
 * -----
 */
export class IPNet implements IAddr {
  private __ip: string;
  private __prefixLength: number;

  constructor(ip: string, prefixLength: number=128) {
    if (prefixLength < 0 || prefixLength % 1 !== 0)
      throw new Error(`prefix length must be non-negative integer`);

    if (net.isIPv4(ip))
      prefixLength = Math.min(32, prefixLength);
    else if (net.isIPv6(ip))
      prefixLength = Math.min(128, prefixLength);
    else
      throw new Error(`invalid IP address`);

    this.__ip = ip;
    this.__prefixLength = prefixLength;
    Object.freeze(this);
  }

  get network(): string { return 'ip+net'; }
  get ip(): string { return this.__ip; }
  get prefixLength(): number { return this.__prefixLength; }

  toString(): string {
    return '${this.ip}/${this.prefixLength}';
  }
}

/* L4Addr
 * ------
 * Models common L4 address types which use an (IP, port) tuple to address
 * their endpoints. Immutable.
 */
export abstract class L4Addr implements IAddr {
  private __ip: IP;
  private __port: number;
  private __zone: string;

  constructor(ip: IP, port: number, zone: string='') {
    assertValidPort(port);
    assertValidZone(zone);

    this.__ip = ip;
    this.__port = port;
    this.__zone = zone;

    Object.freeze(this);
  }

  abstract get network(): string;
  get ip(): IP { return this.__ip; }
  get port(): number { return this.__port; }
  get zone(): string { return this.__zone; }

  get ipZone(): string { return `${this.ip}${this.zone !== '' ? ('%'+this.zone) : ''}`; }
  get netLoc(): NetLoc { return [this.ip.toString(), this.port.toString()]; }

  toString(): string {
    return this.ip.isV6
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
  new(ip: IP, port: number, zone: string): T;
}

function parseL4<T>(x: cons<T>, addr: NetLocish): T {
  const nl = asNetLoc(addr);
  const [ip, zone] = IPFuncs.parseIPAddr(nl[0]);

  return new x(new IP(ip), strictParseInt(nl[1]), zone || '');
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

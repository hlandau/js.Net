import {isIPv6} from "net";

// NetLoc. Represents a host:port combination. Either the host or the port or
// both may be '' if not specified.
export type NetLoc = [string, string];

function cleanHost(s: string): string {
  if (s === '')
    return '';

  if (s[0] !== '[')
    return s;

  if (s.length < 2 || s[s.length-1] !== ']')
    throw new Error(`invalid hostname: "${s}"`);

  return s.substr(1, s.length-2);
}

// Splits a netloc string.
//
// "host:port"        ["host","port"]
// "IPv4:port"        ["IPv4","port"]
// "[IPv4]:port"      ["IPv4","port"]
// "[IPv6]:port"      ["IPv6","port"]
// "host:"            ["host",""]
// ":port"            ["","port"]
// "host"             ["host",""]
// "IPv4"             ["IPv4",""]
// "IPv6"             ["IPv6",""]
export function split(s: string): NetLoc {
  if (typeof s !== 'string')
    throw new Error(`netloc string must be a string`);

  const ms = s.match(/^([^:\[\]]+|\[[^\]]+\])?(:([a-z0-9]*))?$/);
  if (s === '' || !ms) {
    if (isIPv6(s))
      return [s, ''];

    throw new Error(`string is not a valid netloc: "${s}"`);
  }

  const host = cleanHost(ms[1] || '')
  const port = ms[3] || '';
  return [host, port];

  /*if (s === '')
    throw new Error("empty string is not a valid netloc");

  const colonIdx = s.lastIndexOf(':');
  if (colonIdx < 0)
    return [cleanHost(s), undefined];

  const host = cleanHost(s.substr(0, colonIdx));
  const port = s.substr(colonIdx+1);
  return [host, port];*/
}

export function join(host: string, port: string | number): string;
export function join(netLoc: NetLoc, __dummy?: string): string;
export function join(host: any, port: any) {
  if (host instanceof Array) {
    if (host.length !== 2)
      throw new Error("invalid netloc: must be array of length 2");

    [host, port] = host;
  }

  if (port === undefined || port === null)
    port = '';

  if (port === '')
    return host;

  if (host === undefined || host === null) {}
  else if (host.indexOf(':') >= 0)
    host = `[${host}]`;

  return `${host}:${port}`;
}

export function validNetLoc(x: NetLoc): boolean {
  return (x instanceof Array && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string');
}

export type NetLocish = NetLoc | string;

export function asNetLoc(x: NetLocish): NetLoc {
  if (x instanceof Array && validNetLoc(x))
    return x;

  if (typeof x === 'string')
    return split(x);

  throw new Error(`invalid NetLocish: "${x}"`);
}

// These are low-level functions and you probably don't want to use them directly.
//
// Use the object-oriented APIs (IP, IPAddr, IPNet, etc.) instead.

/* Regular Expression Components
 * -----------------------------
 */
// IPv4 address matcher.
const re_ipv4_s = (function(): string {
  let s = '';
  for (let i=0; i<4; ++i) {
    s += '(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])';
    if (i !== 3)
      s += '\\.';
  }
  return s;
})();

// IPv6 address without zone specifier matcher.
const re_ipv6_s = (function(): string {
  const block = '([0-9a-fA-F]{1,4})';

  const blocke2 = `
    ( (${re_ipv4_s})
    | ${block} (: ${block})?
    )
  `;

  const blocke3 = `${block} (: ${blocke2})?`;
  const blocke4 = `${block} (: ${blocke3})?`;
  const blocke5 = `${block} (: ${blocke4})?`;
  const blocke6 = `${block} (: ${blocke5})?`;
  const blocke7 = `${block} (: ${blocke6})?`;

  const blocks2 = `${block} : ${block}`;
  const blocks3 = `${blocks2} : ${block}`;
  const blocks4 = `${blocks3} : ${block}`;
  const blocks5 = `${blocks4} : ${block}`;
  const blocks6 = `${blocks5} : ${block}`;
  const blocks7 = `${blocks6} : ${block}`;
  const blocks8 = `${blocks7} : ${block}`;

  const s = `
  (
    :: (${blocke7})?
  | ${block} :: (${blocke6})?
  | ${blocks2} :: (${blocke5})?
  | ${blocks3} :: (${blocke4})?
  | ${blocks4} :: (${blocke3})?
  | ${blocks5} :: (${blocke2})?
  | ${blocks6} :: (${block})?
  | ${blocks6} : (${re_ipv4_s})
  | ${blocks7} ::
  | ${blocks8}
  )
`;
  return s.replace(/[ \n]/g,'');
})();

// Zone name.
const re_zone_s = `[a-zA-Z0-9:_-]+`;

// IPv6 address with optional zone specifier matcher.
const re_ipv6_addr_s = `${re_ipv6_s}(%(${re_zone_s}))?`;


/* Compiled Regular Expressions
 * ----------------------------
 */
// IPv4 address.
const re_ipv4 = new RegExp('^'+re_ipv4_s+'$');
// IPv4 address with optional prefix length.
//const re_ipv4_cidr = new RegExp('^'+re_ipv4_s+'(/(0|[1-9]|[1-2][0-9]|3[0-2]))?$');

// IPv6 address without zone specifier.
const re_ipv6 = new RegExp('^'+re_ipv6_s+'$');
// IPv6 address with optional zone specifier.
const re_ipv6_addr = new RegExp('^'+re_ipv6_addr_s+'$');
// IPv6 address with optional prefix length.
//const re_ipv6_cidr = new RegExp('^'+re_ipv6_s+'(/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$');

// IPv4 or IPv6 address without zone specifier.
const re_ip = new RegExp(`^((${re_ipv4_s})|(${re_ipv6_s}))$`);
// IPv4 address or IPv6 address with optional zone specifier.
const re_ip_addr = new RegExp(`^((${re_ipv4_s})|(${re_ipv6_addr_s}))$`);

// Zone name.
const re_zone = new RegExp(`^${re_zone_s}$`);


/* IP Validation
 * -------------
 * Functions to validate IPv4 or IPv6 address strings. These functions do not
 * accept zone specifiers.
 */
export function validateIPv4(s: string): boolean {
  return !!s.match(re_ipv4);
}
export function validateIPv6(s: string): boolean {
  return !!s.match(re_ipv6);
}
export function validateIP(s: string): boolean {
  return !!s.match(re_ip);
}


/* IP Addr Validation
 * ------------------
 * Functions to validate IPv4 or IPv6 address strings. These functions accept
 * zone specifiers for IPv6 addresses.
 */
export function validateIPv4Addr(s: string): boolean {
  return validateIPv4(s);
}
export function validateIPv6Addr(s: string): boolean {
  return !!s.match(re_ipv6_addr);
}
export function validateIPAddr(s: string): boolean {
  return !!s.match(re_ip_addr);
}


/* IP Parsing
 * ----------
 * Parses IP addresses into big-endian binary data arrays. These functions do
 * not accept zone specifiers.
 */
// Returns Uint8Array of length 4. Throws if invalid.
export function parseIPv4(s: string): Uint8Array {
  const m = s.match(re_ipv4);
  if (!m)
    throw new Error(`not a valid IP address: "${s}"`);

  const a = new Uint8Array(4);
  a[0] = parseInt(m[1]);
  a[1] = parseInt(m[2]);
  a[2] = parseInt(m[3]);
  a[3] = parseInt(m[4]);
  return a;
}

// Returns Uint8Array of length 16. Throws if invalid.
export function parseIPv6(s: string): Uint8Array {
  const m = s.match(re_ipv6);
  if (!m)
    throw new Error(`not a valid IP address: "${s}"`);

  return _parseIPv6(s);
}

function zl(x: string[]): string[] {
  return (x.length === 1 && x[0] === '') ? [] : x;
}

function _parseIPv6(s: string): Uint8Array {
  const a = new Uint8Array(16);
  const sides = s.split('::');

  const sideA = zl(sides[0].split(':'));
  const sideB = zl((sides.length > 1) ? sides[1].split(':') : []);
  for (let j=0; j<sides.length; ++j) {
    const parts = j ? sideB : sideA;
    let idx = j ? 16-sideB.length*2 : 0;
    for (let i=0; i<parts.length; ++i, idx += 2) {
      const v = parts[i];
      if (j === sides.length-1 && i === parts.length-1 && v.indexOf('.') >= 0) {
        const v4 = parseIPv4(v);
        a[12] = v4[0];
        a[13] = v4[1];
        a[14] = v4[2];
        a[15] = v4[3];
        break;
      }

      const n = parseInt(v, 16);
      a[idx+0] = n >>> 8;
      a[idx+1] = n & 0xFF;
    }
  }

  return a;
}
//{s: '1234:2345:3456:4567:5678:6789:127.129.128.221',  b: fromHex('1234234534564567567867897f8180dd')},

// Returns Uint8Array of length 4 or 16. Throws if invalid.
export function parseIP(s: string): Uint8Array {
  // This is a reliable way to figure out what parser to use for valid input;
  // if it isn't a valid IP address, the parser in question will reject it.
  return (s.indexOf(':') >= 0) ? parseIPv6(s) : parseIPv4(s);
}


/* IP Stringification
 * ------------------
 * Converts IP addresses in binary representation to human-readable strings.
 */
// Converts an IPv4 address in binary format to a dotted-decimal string. The
// input must be a Uint8Array of length 4.
export function stringifyIPv4(b: Uint8Array): string {
  if (b.length !== 4)
    throw new Error(`only Uint8Arrays which are 4 bytes in length can be converted to IPv4 address strings`);

  return `${b[0]}.${b[1]}.${b[2]}.${b[3]}`;
}

const hexchar = '0123456789abcdef';
function phex(x: number): string {
  return hexchar[((x >>> 4) & 0x0F)] + hexchar[(x & 0x0F)];
}

function stripz(x: string): string {
  for (let i=0; i<x.length; ++i)
    if (x[i] !== '0')
      return x.substr(i);
  return '0';
}

// Converts an IPv6 address in binary format to a human-readable string. The
// input must be a Uint8Array of length 4.
export function stringifyIPv6(b: Uint8Array): string {
  if (b.length !== 16)
    throw new Error(`only Uint8Arrays which are 16 bytes in length can be converted to IPv6 address strings`);

  let s = '';
  for (let i=0; i<16; i += 2) {
    if (i)
      s += ':';
    s += stripz(phex(b[i  ]) + phex(b[i+1]));
  }

  let lmBegin = -1, lmEnd = -1, lmLen = -1;
  s.replace(/(:|^)((0(:|$))+)/g, (m: string, p1: string, p2: string, p3: string, p4: string, offset: number): string => {
    if (p2.length > lmLen) {
      lmBegin = offset + p1.length;
      lmEnd = offset + p1.length + p2.length;
      lmLen = p2.length;
    }

    return m;
  });

  if (lmLen >= 0)
    s = s.substr(0, lmBegin-1) + '::' + s.substr(lmEnd);
  return s;
}

export function stringifyIP(b: Uint8Array): string {
  if (b.length === 4)
    return stringifyIPv4(b);
  if (b.length === 16)
    return stringifyIPv6(b);
  throw new Error(`only Uint8Arrays which are 4 or 16 bytes in length can be converted to IP address strings`);
}


/* IP Addr Parsing
 * ---------------
 */
// Returns Uint8Array of length 4. Throws if invalid.
export function parseIPv4Addr(s: string): Uint8Array {
  return parseIPv4(s);
}

// Parses an IPv6 address, optionally accepting a zone specifier. Returns
// Uint8Array of length 16 and a zone name, or null if a zone was not
// specified. Throws if invalid.
export function parseIPv6Addr(s: string): [Uint8Array, string | null] {
  if (!s.match(re_ipv6_addr))
    throw new Error(`not a valid IP address: "${s}"`);

  let zone: string | null = null;
  const zidx = s.indexOf('%');
  if (zidx >= 0) {
    zone = s.substr(zidx+1);
    s = s.substr(0, zidx);
  }

  return [_parseIPv6(s), zone];
}

// Parses an IP address, optionally accepting a zone specifier for IPv6
// addresses. Returns Uint8Array of length 4 or 16 and a zone name, or null if
// a zone was not specified or the address is an IPv4 address.
export function parseIPAddr(s: string): [Uint8Array, string | null] {
  return s.indexOf(':') >= 0 ? parseIPv6Addr(s) : [parseIPv4Addr(s), null];
}


/* IP Addr Stringification
 * -----------------------
 */
export function stringifyIPv4Addr(b: Uint8Array): string {
  return stringifyIPv4(b);
}

export function stringifyIPv6Addr(b: Uint8Array, zone: string | null=null): string {
  return stringifyIPv6(b) + ((zone !== null) ? '%'+zone : zone);
}

export function stringifyIPAddr(b: Uint8Array, zone: string | null=null): string {
  if (b.length === 4) {
    if (zone !== null)
      throw new Error(`IPv4 addresses cannot be stringified with zone specifiers`);
    return stringifyIPv4Addr(b);
  }
  if (b.length === 16)
    return stringifyIPv6Addr(b, zone);
  throw new Error(`only Uint8Arrays which are 4 or 16 bytes in length can be converted to IP address strings`);
}


/* Zone Names
 * ----------
 */
export function validateZoneName(z: string): boolean {
  return !!z.match(re_zone);
}

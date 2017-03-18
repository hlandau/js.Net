import * as chai from "chai";
import * as IPFuncs from "hlandau.Net/IPFuncs";
chai.should();

function decHex(c: number): number {
  if (c >= 0x30 && c <= 0x39)
    return c - 0x30;
  if (c >= 0x41 && c <= 0x46)
    return c - 0x37; //- 0x41 + 10;
  if (c >= 0x61 && c <= 0x7a)
    return c - 0x57; //- 0x61 + 10;
  throw new Error(`invalid hex character`);
}

function fromHex(s: string): Uint8Array {
  const a = new Uint8Array(s.length/2);
  for (let i=0; i<s.length/2; ++i)
    a[i] = (decHex(s.charCodeAt(i*2))<<4) + decHex(s.charCodeAt(i*2+1));
  return a;
}

interface ITestAddress {
  s: string;
  b: Uint8Array;
  z?: string;
}

const addresses: ITestAddress[] = [
  {s: '0.0.0.0',                                        b: fromHex('00000000')},
  {s: '255.255.255.255',                                b: fromHex('ffffffff')},
  {s: '1.2.3.4',                                        b: fromHex('01020304')},
  {s: '127.0.0.1',                                      b: fromHex('7f000001')},
  {s: '::',                                             b: fromHex('00000000000000000000000000000000')},
  {s: '::1',                                            b: fromHex('00000000000000000000000000000001')},
  {s: '::12ab',                                         b: fromHex('000000000000000000000000000012ab')},
  {s: '::1234:2345',                                    b: fromHex('00000000000000000000000012342345')},
  {s: '::1234:2345:3456',                               b: fromHex('00000000000000000000123423453456')},
  {s: '::1234:2345:3456:4567',                          b: fromHex('00000000000000001234234534564567')},
  {s: '::1234:2345:3456:4567:5678',                     b: fromHex('00000000000012342345345645675678')},
  {s: '::1234:2345:3456:4567:5678:6789',                b: fromHex('00000000123423453456456756786789')},
  {s: '::1234:2345:3456:4567:5678:6789:7890',           b: fromHex('00001234234534564567567867897890')},
  {s: '1234:2345:3456:4567:5678:6789:7890:8901',        b: fromHex('12342345345645675678678978908901')},
  {s: '1234:2345:3456:4567:5678:6789:127.129.128.221',  b: fromHex('1234234534564567567867897f8180dd')},
  {s: '1::',                                            b: fromHex('00010000000000000000000000000000')},
  {s: '1:2::',                                          b: fromHex('00010002000000000000000000000000')},
  {s: '1:2:3::',                                        b: fromHex('00010002000300000000000000000000')},
  {s: '1:2:3:4::',                                      b: fromHex('00010002000300040000000000000000')},
  {s: '1:2:3:4:5::',                                    b: fromHex('00010002000300040005000000000000')},
  {s: '1:2:3:4:5:6::',                                  b: fromHex('00010002000300040005000600000000')},
  {s: '1:2:3:4:5:6:7::',                                b: fromHex('00010002000300040005000600070000')},
  {s: '2001::beef',                                     b: fromHex('2001000000000000000000000000beef')},
  {s: '2001:1::beef',                                   b: fromHex('2001000100000000000000000000beef')},
  {s: '2001::1:beef',                                   b: fromHex('2001000000000000000000000001beef')},
  {s: '2001:1::1:beef',                                 b: fromHex('2001000100000000000000000001beef')},
  {s: 'fe80::1',                                        b: fromHex('fe800000000000000000000000000001')},
  {s: 'fe80::1:2:3:4%eth0',                             b: fromHex('fe800000000000000001000200030004'), z: 'eth0'},
];

describe('IPFuncs', () => {
  describe('#parseIPAddr', () => {
    it('should parse addresses correctly', () => {
      for (const addr of addresses) {
        const [b, z] = IPFuncs.parseIPAddr(addr.s);
        b.should.deep.equal(addr.b);
        if (addr.z !== undefined)
          (z || '.').should.equal(addr.z);
        else if (z)
          z.should.equal(null);
      }
    });
  });
});

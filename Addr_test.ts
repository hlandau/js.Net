import * as chai from "chai";
import {IPAddr, TCPAddr, UDPAddr} from "hlandau.Net/Addr";
import {NetLocish} from "hlandau.Net/NetLoc";
chai.should();

interface ConstructItem {
  ip: string;
  port: number;
  zone?: string;

  d: string;
}

interface ResolveItem {
  s: NetLocish;
  d?: string;
  ip?: string;
  port?: number;
  zone?: string;
}

describe('IPAddr', () => {
  describe('#resolve', () => {
    it('should parse IP strings correctly', () => {
      const items: ResolveItem[] = [
        {s: '127.0.0.1', d: '127.0.0.1', ip: '127.0.0.1'},
        {s: '::1', d: '::1', ip: '::1', zone: ''},
        {s: 'fe80::1%eth0', d: 'fe80::1%eth0', ip: 'fe80::1', zone: 'eth0'},
      ];

      for (const item of items) {
        const a = IPAddr.resolve(item.s as string);
        a.should.be.instanceof(IPAddr);
        a.network.should.equal('ip');
        a.toString().should.equal(item.d);
        a.ip.should.equal(item.ip);
        a.zone.should.equal(item.zone || '');
      }
    });
  });
});

describe('L4Addr', () => {
  describe('#construct', () => {
    it('should construct correctly', () => {
      const items: ConstructItem[] = [
        {ip: '127.0.0.1', port: 8080, d: '127.0.0.1:8080'},
        {ip: '::1', port: 8080, d: '[::1]:8080'},
        {ip: 'fe80::1', port: 8080, zone: 'eth0', d: '[fe80::1%eth0]:8080'},
      ];

      for (const Addr of [TCPAddr,UDPAddr]) {
        for (const item of items) {
          const a = new Addr(item.ip, item.port, item.zone || '');
          a.should.be.instanceof(Addr);
          a.network.should.equal(Addr === TCPAddr ? 'tcp' : 'udp');
          a.toString().should.equal(item.d);
          a.ip.should.equal(item.ip);
          a.port.should.equal(item.port);
          a.zone.should.equal(item.zone || '');
        }
      }
    });
  });

  describe('#resolve', () => {
    it('should parse IP:port strings correctly', () => {

      const items: ResolveItem[] = [
        {s: '127.0.0.1:8080', ip: '127.0.0.1', port: 8080, zone: ''},
        {s: ['127.0.0.1','8080'], ip: '127.0.0.1', port: 8080, zone: '', d: '127.0.0.1:8080'},
        {s: '[::1]:8080', ip: '::1', port: 8080, zone: ''},
        {s: ['::1','8080'], ip: '::1', port: 8080, zone: '', d: '[::1]:8080'},
        {s: '[fe80::1%eth0]:8080', ip: 'fe80::1', port: 8080, zone: 'eth0'},
        {s: ['fe80::1%eth0','8080'], ip: 'fe80::1', port: 8080, zone: 'eth0', d: '[fe80::1%eth0]:8080'},
      ];

      for (const Addr of [TCPAddr,UDPAddr]) {
        for (const item of items) {
          const a = Addr.resolve('tcp', item.s);
          a.should.be.instanceof(Addr);
          a.network.should.equal(Addr === TCPAddr ? 'tcp' : 'udp');
          a.toString().should.equal(item.d || item.s);
          if (item.ip !== undefined)
            a.ip.should.equal(item.ip);
          if (item.port !== undefined)
            a.port.should.equal(item.port);
          if (item.zone !== undefined)
            a.zone.should.equal(item.zone);
        }
      }
    });
  });
});

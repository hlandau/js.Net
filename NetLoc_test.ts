import * as chai from "chai";
import * as NetLoc from "hlandau.Net/NetLoc";
chai.should();

interface SplitItem {
  s: string;
  d: NetLoc.NetLoc;
}

describe('NetLoc', () => {
  describe('#split', () => {
    it('should split and join strings correctly', () => {
      const items: SplitItem[] = [
        {s: '127.0.0.1:8080', d: ['127.0.0.1','8080']},
        {s: '[::1]:8080', d: ['::1', '8080']},
        {s: '[fe80::1%eth0]:8080', d: ['fe80::1%eth0', '8080']},
      ];

      for (const item of items) {
        const d = NetLoc.split(item.s);
        d.should.deep.equal(item.d);
        NetLoc.join(d).should.deep.equal(item.s);
      }
    });
  });
});

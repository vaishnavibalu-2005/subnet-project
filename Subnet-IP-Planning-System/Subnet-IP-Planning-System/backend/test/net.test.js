const t = require('node:test'), a = require('node:assert'), n = require('../src/net');
t('ipv4 valid/invalid (regex and DFA agree)', () => {
  for (const [v, ok] of [['192.168.1.1', 1], ['255.255.255.255', 1], ['256.1.1.1', 0], ['1.2.3', 0], ['01.2.3.4', 0], ['1.2.3.4.5', 0], ['a.b.c.d', 0], ['1..2.3', 0]]) {
    const r = n.validate('ipv4', v); a.strictEqual(r.valid, !!ok, v); a.strictEqual(r.dfa.accepted, !!ok, v);
  }
});
t('mask', () => { a.ok(n.validate('mask', '255.255.255.0').valid); a.ok(!n.validate('mask', '255.0.255.0').valid); });
t('calc /26', () => { const s = n.parseSubnet('192.168.1.77/26'); a.deepStrictEqual([s.network, s.broadcast, s.firstHost, s.lastHost, s.totalHosts, s.usableHosts, s.mask], ['192.168.1.64', '192.168.1.127', '192.168.1.65', '192.168.1.126', 64, 62, '255.255.255.192']); });
t('calc via mask, /31, /32, /0', () => { a.strictEqual(n.parseSubnet('10.0.0.5', '255.255.255.0').cidr, '10.0.0.0/24'); a.strictEqual(n.parseSubnet('1.1.1.1/31').usableHosts, 2); a.strictEqual(n.parseSubnet('1.1.1.1/32').usableHosts, 1); a.strictEqual(n.parseSubnet('0.0.0.0/0').totalHosts, 2 ** 32); });
t('overlap', () => { const r = n.checkOverlaps(['10.0.0.0/24', '10.0.0.128/25', '10.0.1.0/24', '300.0.0.0/8']); a.strictEqual(r.overlaps.length, 1); a.strictEqual(r.overlaps[0].relation, 'A contains B'); a.strictEqual(r.invalid.length, 1); });

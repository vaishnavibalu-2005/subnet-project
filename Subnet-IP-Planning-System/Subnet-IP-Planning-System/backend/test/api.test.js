const t = require('node:test'), a = require('node:assert'); const app = require('../src/app');
t('API flow', async () => {
  const s = app.listen(0); const B = `http://localhost:${s.address().port}/api`;
  const j = async (p, m = 'GET', b) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) }); return [r.status, await r.json()]; };
  try {
    a.strictEqual((await j('/validate/ipv4', 'POST', { value: '999.1.1.1' }))[1].valid, false);
    const [cs, c] = await j('/configs', 'POST', { name: 'LAN', cidr: '192.168.1.0/30' }); a.strictEqual(cs, 201);
    a.strictEqual((await j('/configs', 'POST', { name: 'X', cidr: '192.168.1.0/24' }))[0], 409);
    a.strictEqual((await j('/allocate', 'POST', { configId: c.id }))[1].allocations[0].ip, '192.168.1.1');
    a.strictEqual((await j('/allocate', 'POST', { configId: c.id, ip: '192.168.1.1' }))[0], 409);
    a.strictEqual((await j('/allocate', 'POST', { configId: c.id, ip: '192.168.1.3' }))[0], 400);
    a.strictEqual((await j('/allocate', 'POST', { configId: c.id, ip: '192.168.1.2' }))[0], 201);
    a.strictEqual((await j('/allocate', 'POST', { configId: c.id }))[0], 409);
    a.strictEqual((await j('/configs/' + c.id, 'DELETE'))[0], 200);
    a.ok((await j('/history'))[1].length > 3);
  } finally { s.close(); }
});

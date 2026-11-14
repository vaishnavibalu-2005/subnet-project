const express = require('express');
const cors = require('cors');
const net = require('./net');
const store = require('./store');
const app = express();
const origins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '100kb' }));
const w = fn => (req, res, next) => fn(req, res).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const log = (type, input, valid, summary) => store.addHist({ type, input: String(input).slice(0, 500), valid, summary });

app.get('/api/health', (q, r) => r.json({ ok: true, storage: store.mode() }));
app.post('/api/validate/ipv4', w(async (q, r) => {
  const { value, type = 'ipv4' } = q.body || {};
  if (typeof value !== 'string') return bad(r, 'value (string) is required');
  const out = net.validate(type, value); if (out.error) return bad(r, out.error);
  await log('validate-' + type, value, out.valid, out.message); r.json(out);
}));
app.post('/api/subnet/calculate', w(async (q, r) => {
  const { cidr, ip, mask } = q.body || {};
  const s = net.parseSubnet(cidr || ip, mask);
  if (s.error) { await log('calculate', cidr || ip || '', false, s.error); return bad(r, s.error); }
  await log('calculate', s.input, true, `${s.cidr}: ${s.usableHosts} usable hosts`); r.json(s);
}));
app.post('/api/subnet/overlap', w(async (q, r) => {
  const { subnets } = q.body || {};
  if (!Array.isArray(subnets) || subnets.length < 2) return bad(r, 'Provide an array "subnets" with at least 2 entries');
  if (subnets.length > 200) return bad(r, 'Maximum 200 subnets');
  const out = net.checkOverlaps(subnets.map(String));
  await log('overlap', subnets.join(', '), !out.hasOverlap && !out.invalid.length, `${out.overlaps.length} overlap(s), ${out.invalid.length} invalid`); r.json(out);
}));
const cfgBody = (b = {}) => {
  const name = String(b.name || '').trim(); if (!name) return { error: 'name is required' };
  const s = net.parseSubnet(b.cidr); if (s.error) return { error: s.error };
  return { data: { name, cidr: s.cidr, notes: String(b.notes || '') } };
};
app.get('/api/configs', w(async (q, r) => r.json(await store.listConfigs())));
app.get('/api/configs/:id', w(async (q, r) => { const c = await store.getConfig(q.params.id); c ? r.json(c) : bad(r, 'Not found', 404); }));
app.post('/api/configs', w(async (q, r) => {
  const { data, error } = cfgBody(q.body); if (error) return bad(r, error);
  const all = await store.listConfigs(); const ov = net.checkOverlaps([data.cidr, ...all.map(c => c.cidr)]).overlaps.filter(o => o.a === net.parseSubnet(data.cidr).cidr);
  if (ov.length && !q.body.allowOverlap) return bad(r, `Overlaps with saved config ${ov[0].b} (${ov[0].relation})`, 409);
  const c = await store.createConfig(data); await log('save-config', data.cidr, true, `Saved "${data.name}"`); r.status(201).json(c);
}));
app.put('/api/configs/:id', w(async (q, r) => {
  const { data, error } = cfgBody(q.body); if (error) return bad(r, error);
  const old = await store.getConfig(q.params.id); if (!old) return bad(r, 'Not found', 404);
  const bounds = net.parseSubnet(data.cidr); const outside = old.allocations.filter(a => !(net.toInt(a.ip) >= bounds.firstInt && net.toInt(a.ip) <= bounds.lastInt));
  if (outside.length) return bad(r, `Allocated host ${outside[0].ip} would fall outside ${data.cidr}; release it first`, 409);
  const c = await store.updateConfig(q.params.id, data); await log('update-config', data.cidr, true, `Updated "${data.name}"`); r.json(c);
}));
app.delete('/api/configs/:id', w(async (q, r) => { (await store.deleteConfig(q.params.id)) ? (await log('delete-config', q.params.id, true, 'Deleted'), r.json({ deleted: true })) : bad(r, 'Not found', 404); }));

// Host allocation: auto-picks next free host if ip omitted; blocks duplicates & out-of-range
app.post('/api/allocate', w(async (q, r) => {
  const { configId, ip, label = '' } = q.body || {};
  const c = await store.getConfig(String(configId || '')); if (!c) return bad(r, 'Config not found', 404);
  const s = net.parseSubnet(c.cidr); const used = new Set(c.allocations.map(a => a.ip)); let pick = ip && String(ip).trim();
  if (pick) {
    if (!net.IPV4_RE.test(pick)) return bad(r, 'Invalid IPv4: ' + net.validate('ipv4', pick).message);
    const n = net.toInt(pick);
    if (n < s.firstInt || n > s.lastInt) return bad(r, `${pick} is not a usable host in ${s.cidr} (usable ${s.firstHost} - ${s.lastHost})`);
    if (used.has(pick)) return bad(r, `${pick} is already allocated in this network`, 409);
  } else {
    for (let n = s.firstInt; n <= s.lastInt && n < s.firstInt + 70000; n++) if (!used.has(net.toIp(n))) { pick = net.toIp(n); break; }
    if (!pick) return bad(r, 'No free hosts left in this network', 409);
  }
  const u = await store.updateConfig(c.id, { allocations: [...c.allocations, { ip: pick, label: String(label).slice(0, 100) }] });
  await log('allocate', pick, true, `${pick} -> ${c.name}`); r.status(201).json(u);
}));
app.delete('/api/allocate/:configId/:ip', w(async (q, r) => {
  const c = await store.getConfig(q.params.configId); if (!c) return bad(r, 'Config not found', 404);
  if (!c.allocations.some(a => a.ip === q.params.ip)) return bad(r, 'Allocation not found', 404);
  r.json(await store.updateConfig(c.id, { allocations: c.allocations.filter(a => a.ip !== q.params.ip) }));
}));
app.get('/api/history', w(async (q, r) => r.json(await store.listHist())));
app.delete('/api/history', w(async (q, r) => { await store.clearHist(); r.json({ cleared: true }); }));
app.use((q, r) => bad(r, 'Route not found', 404));
app.use((e, q, r, n) => { console.error(e); if (e.type === 'entity.parse.failed') return bad(r, 'Malformed JSON'); bad(r, e.message || 'Server error', 500); });
module.exports = app;

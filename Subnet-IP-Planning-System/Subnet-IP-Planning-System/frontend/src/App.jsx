import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, ShieldCheck, Calculator, GitCompare, Server, Save, History, BookOpen, Menu, Trash2, Pencil, Loader2, Network } from 'lucide-react';
import { api } from './api.js';

const PAGES = [['dash', 'Dashboard', LayoutDashboard], ['val', 'IPv4 Validator', ShieldCheck], ['calc', 'Subnet Calculator', Calculator], ['ov', 'Overlap Checker', GitCompare], ['alloc', 'Host Allocation', Server], ['cfg', 'Saved Configs', Save], ['hist', 'Validation History', History], ['about', 'About Project', BookOpen]];
const Msg = ({ m }) => m ? <div className={`msg ${m.t}`}>{m.text}</div> : null;
const Badge = ({ ok, children }) => <span className={`badge ${ok ? 'ok' : 'err'}`}>{children}</span>;
const Btn = ({ busy, children, ...p }) => <button className="btn" disabled={busy} {...p}>{busy && <Loader2 size={16} className="spin" />}{children}</button>;
const KV = ({ o }) => <div className="tw"><table><tbody>{Object.entries(o).map(([k, v]) => <tr key={k}><th>{k}</th><td><code>{String(v)}</code></td></tr>)}</tbody></table></div>;
const detail = s => ({ 'CIDR (normalized)': s.cidr, 'Network address': s.network, 'Broadcast address': s.broadcast, 'Subnet mask': s.mask, 'Wildcard mask': s.wildcard, 'First usable host': s.firstHost, 'Last usable host': s.lastHost, 'Total addresses': s.totalHosts.toLocaleString(), 'Usable hosts': s.usableHosts.toLocaleString() });

function useRun() {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const run = async (fn, okText) => { setBusy(true); setMsg(null); try { const r = await fn(); if (okText) setMsg({ t: 'ok', text: okText }); return r; } catch (e) { setMsg({ t: 'err', text: e.message }); } finally { setBusy(false); } };
  return { busy, msg, run, setMsg };
}
function useData(path) {
  const [d, setD] = useState(null), [err, setErr] = useState(null);
  const load = useCallback(() => api(path).then(x => { setD(x); setErr(null); }).catch(e => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return [d, load, err];
}

function Dashboard() {
  const [cfgs, , e1] = useData('/configs'), [hist, , e2] = useData('/history');
  if (e1 || e2) return <Msg m={{ t: 'err', text: e1 || e2 }} />;
  if (!cfgs || !hist) return <p>Loading…</p>;
  const hosts = cfgs.reduce((a, c) => a + c.allocations.length, 0), bad = hist.filter(h => !h.valid).length;
  return <>
    <div className="grid">{[['Networks', cfgs.length], ['Allocated hosts', hosts], ['Validations run', hist.length], ['Validation errors', bad]].map(([l, v]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}</div>
    <div className="card"><h3>Planning summary</h3>{cfgs.length ? <div className="tw"><table><thead><tr><th>Name</th><th>CIDR</th><th>Usable</th><th>Allocated</th><th>Free</th></tr></thead><tbody>{cfgs.map(c => { const u = parse(c.cidr); return <tr key={c.id}><td>{c.name}</td><td>{c.cidr}</td><td>{u}</td><td>{c.allocations.length}</td><td>{u - c.allocations.length}</td></tr>; })}</tbody></table></div> : <p>No saved networks yet. Use <b>Saved Configs</b> to add one.</p>}</div>
    <div className="card"><h3>Recent errors</h3>{hist.filter(h => !h.valid).slice(0, 5).map(h => <p key={h.id}><code>{h.input}</code> — {h.summary}</p>)}{!bad && <p>No errors recorded.</p>}</div>
  </>;
}
const parse = cidr => { const p = +cidr.split('/')[1], s = 2 ** (32 - p); return p === 32 ? 1 : p === 31 ? 2 : s - 2; };

function Validator() {
  const [type, setType] = useState('ipv4'), [value, setValue] = useState('192.168.1.1'), [res, setRes] = useState(null), { busy, msg, run } = useRun();
  return <>
    <div className="card"><form onSubmit={async e => { e.preventDefault(); setRes(null); setRes(await run(() => api('/validate/ipv4', { method: 'POST', body: { type, value } }))); }}>
      <div className="row"><div style={{ flex: 0.4 }}><label>Validate as</label><select value={type} onChange={e => setType(e.target.value)}><option value="ipv4">IPv4 address</option><option value="mask">Subnet mask</option><option value="cidr">CIDR notation</option></select></div><div><label>Input</label><input value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 256.1.1.1" /></div></div>
      <Btn busy={busy}>Validate</Btn></form><Msg m={msg} /></div>
    {res && <div className="card"><h3>Result: <Badge ok={res.valid}>{res.valid ? 'VALID' : 'INVALID'}</Badge></h3><p>{res.message}</p>
      <p>Regex match: <Badge ok={res.regexMatch}>{String(res.regexMatch)}</Badge> &nbsp; DFA accepted: <Badge ok={res.dfa.accepted}>{String(res.dfa.accepted)}</Badge></p>
      <p><b>How the DFA decided:</b> {res.dfa.reason}. Each character moves the machine between states <code>O&lt;octet&gt;:&lt;digits&gt;d</code>; an illegal move goes to the dead state REJECT.</p>
      <div className="tw"><table><thead><tr><th>#</th><th>Char</th><th>From</th><th>To</th><th>Note</th></tr></thead><tbody>{res.dfa.trace.map((t, i) => <tr key={i}><td>{i + 1}</td><td><code>{t.char}</code></td><td>{t.from}</td><td><b style={{ color: t.to === 'REJECT' ? '#dc2626' : 'inherit' }}>{t.to}</b></td><td>{t.why}</td></tr>)}</tbody></table></div></div>}
  </>;
}

function Calc() {
  const [mode, setMode] = useState('cidr'), [cidr, setCidr] = useState('192.168.1.77/26'), [ip, setIp] = useState('10.0.0.5'), [mask, setMask] = useState('255.255.255.0'), [res, setRes] = useState(null), { busy, msg, run } = useRun();
  return <><div className="card"><form onSubmit={async e => { e.preventDefault(); setRes(null); setRes(await run(() => api('/subnet/calculate', { method: 'POST', body: mode === 'cidr' ? { cidr } : { ip, mask } }))); }}>
    <label>Input type</label><select value={mode} onChange={e => setMode(e.target.value)}><option value="cidr">IP / CIDR</option><option value="mask">IP + Subnet mask</option></select>
    {mode === 'cidr' ? <><label>CIDR</label><input value={cidr} onChange={e => setCidr(e.target.value)} /></> : <div className="row"><div><label>IP</label><input value={ip} onChange={e => setIp(e.target.value)} /></div><div><label>Mask</label><input value={mask} onChange={e => setMask(e.target.value)} /></div></div>}
    <Btn busy={busy}>Calculate</Btn></form><Msg m={msg} /></div>{res && <div className="card"><h3>Subnet details</h3><KV o={detail(res)} /></div>}</>;
}

function Overlap() {
  const [txt, setTxt] = useState('10.0.0.0/24\n10.0.0.128/25\n10.0.1.0/24\n172.16.0.0/33'), [res, setRes] = useState(null), { busy, msg, run } = useRun();
  return <><div className="card"><form onSubmit={async e => { e.preventDefault(); setRes(null); setRes(await run(() => api('/subnet/overlap', { method: 'POST', body: { subnets: txt.split('\n').map(s => s.trim()).filter(Boolean) } }))); }}>
    <label>Subnets (one CIDR per line)</label><textarea value={txt} onChange={e => setTxt(e.target.value)} /><Btn busy={busy}>Check overlaps</Btn></form><Msg m={msg} /></div>
    {res && <><div className="card"><h3>Overlaps <Badge ok={!res.hasOverlap}>{res.hasOverlap ? res.overlaps.length + ' found' : 'none'}</Badge></h3>{res.hasOverlap && <div className="tw"><table><thead><tr><th>A</th><th>B</th><th>Relation</th></tr></thead><tbody>{res.overlaps.map((o, i) => <tr key={i}><td>{o.a}</td><td>{o.b}</td><td>{o.relation}</td></tr>)}</tbody></table></div>}</div>
      {res.invalid.length > 0 && <div className="card"><h3>Invalid entries</h3>{res.invalid.map((i, k) => <p key={k}><code>{i.input}</code> — {i.error}</p>)}</div>}
      <div className="card"><h3>Parsed subnets</h3><div className="tw"><table><thead><tr><th>CIDR</th><th>Network</th><th>Broadcast</th><th>Usable</th></tr></thead><tbody>{res.subnets.map((s, i) => <tr key={i}><td>{s.cidr}</td><td>{s.network}</td><td>{s.broadcast}</td><td>{s.usableHosts}</td></tr>)}</tbody></table></div></div></>}</>;
}

function Alloc() {
  const [cfgs, load, err] = useData('/configs'), [id, setId] = useState(''), [ip, setIp] = useState(''), [label, setLabel] = useState(''), { busy, msg, run } = useRun();
  if (err) return <Msg m={{ t: 'err', text: err }} />;
  if (!cfgs) return <p>Loading…</p>;
  if (!cfgs.length) return <div className="card">Save a network in <b>Saved Configs</b> first.</div>;
  const c = cfgs.find(x => x.id === id) || cfgs[0];
  return <><div className="card"><form onSubmit={async e => { e.preventDefault(); const r = await run(() => api('/allocate', { method: 'POST', body: { configId: c.id, ip: ip.trim() || undefined, label } }), 'Host allocated'); if (r) { setIp(''); setLabel(''); load(); } }}>
    <div className="row"><div><label>Network</label><select value={c.id} onChange={e => setId(e.target.value)}>{cfgs.map(x => <option key={x.id} value={x.id}>{x.name} ({x.cidr})</option>)}</select></div><div><label>IP (blank = next free)</label><input value={ip} onChange={e => setIp(e.target.value)} /></div><div><label>Label</label><input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Web server" /></div></div>
    <Btn busy={busy}>Allocate host</Btn></form><Msg m={msg} /></div>
    <div className="card"><h3>{c.name} — {c.allocations.length} / {parse(c.cidr)} hosts used</h3><div className="tw"><table><thead><tr><th>IP</th><th>Label</th><th></th></tr></thead><tbody>{c.allocations.map(a => <tr key={a.ip}><td>{a.ip}</td><td>{a.label}</td><td><button className="btn sm del" onClick={() => run(() => api(`/allocate/${c.id}/${a.ip}`, { method: 'DELETE' }), 'Released').then(load)}><Trash2 size={14} />Release</button></td></tr>)}</tbody></table></div></div></>;
}

function Configs() {
  const [cfgs, load, err] = useData('/configs'), [f, setF] = useState({ name: '', cidr: '', notes: '' }), [edit, setEdit] = useState(null), { busy, msg, run } = useRun();
  const submit = async e => { e.preventDefault(); const r = await run(() => edit ? api('/configs/' + edit, { method: 'PUT', body: f }) : api('/configs', { method: 'POST', body: f }), edit ? 'Updated' : 'Saved'); if (r) { setF({ name: '', cidr: '', notes: '' }); setEdit(null); load(); } };
  return <><div className="card"><form onSubmit={submit}><div className="row"><div><label>Name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div><div><label>CIDR</label><input value={f.cidr} onChange={e => setF({ ...f, cidr: e.target.value })} placeholder="192.168.10.0/24" /></div><div><label>Notes</label><input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div></div>
    <Btn busy={busy}>{edit ? 'Update config' : 'Save config'}</Btn>{edit && <button type="button" className="btn sec" style={{ marginLeft: 8 }} onClick={() => { setEdit(null); setF({ name: '', cidr: '', notes: '' }); }}>Cancel</button>}</form><Msg m={msg} /></div>
    <div className="card">{err ? <Msg m={{ t: 'err', text: err }} /> : !cfgs ? 'Loading…' : <div className="tw"><table><thead><tr><th>Name</th><th>CIDR</th><th>Hosts</th><th>Notes</th><th></th></tr></thead><tbody>{cfgs.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.cidr}</td><td>{c.allocations.length}</td><td>{c.notes}</td><td><button className="btn sm sec" onClick={() => { setEdit(c.id); setF({ name: c.name, cidr: c.cidr, notes: c.notes || '' }); }}><Pencil size={14} />Edit</button> <button className="btn sm del" onClick={() => window.confirm('Delete ' + c.name + '?') && run(() => api('/configs/' + c.id, { method: 'DELETE' }), 'Deleted').then(load)}><Trash2 size={14} />Delete</button></td></tr>)}{!cfgs.length && <tr><td colSpan="5">Nothing saved yet.</td></tr>}</tbody></table></div>}</div></>;
}

function Hist() {
  const [h, load, err] = useData('/history'), { busy, msg, run } = useRun();
  return <div className="card"><Btn busy={busy} onClick={() => window.confirm('Clear all history?') && run(() => api('/history', { method: 'DELETE' }), 'History cleared').then(load)}><Trash2 size={16} />Clear history</Btn><Msg m={msg} />{err ? <Msg m={{ t: 'err', text: err }} /> : !h ? <p>Loading…</p> : <div className="tw"><table><thead><tr><th>Time</th><th>Action</th><th>Input</th><th>Status</th><th>Summary</th></tr></thead><tbody>{h.map(x => <tr key={x.id}><td>{new Date(x.createdAt).toLocaleString()}</td><td>{x.type}</td><td><code>{x.input}</code></td><td><Badge ok={x.valid}>{x.valid ? 'OK' : 'ERROR'}</Badge></td><td>{x.summary}</td></tr>)}{!h.length && <tr><td colSpan="5">No history yet.</td></tr>}</tbody></table></div>}</div>;
}

const About = () => <>{[['Computer Networks', 'IPv4/mask/CIDR validation, network & broadcast address, usable host range, host counts, numeric overlap detection (start/end integer comparison) and duplicate-free host allocation.'], ['Full Stack Web Development', 'React + Vite frontend, Express REST API, MongoDB (Mongoose) CRUD with in-memory fallback, clean frontend/backend separation.'], ['Formal Languages & Automata Theory', 'IPv4 regex plus a DFA whose states track (octet, digits). The Validator page shows every transition; illegal characters, leading zeros, values over 255, empty octets or wrong octet counts lead to the REJECT state.']].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>)}</>;

export default function App() {
  const [page, setPage] = useState('dash'), [open, setOpen] = useState(false);
  const Comp = { dash: Dashboard, val: Validator, calc: Calc, ov: Overlap, alloc: Alloc, cfg: Configs, hist: Hist, about: About }[page], cur = PAGES.find(p => p[0] === page);
  return <div className="app"><aside className={'side' + (open ? ' open' : '')}><div className="brand"><Network /> Subnet Planner</div>{PAGES.map(([k, l, I]) => <button key={k} className={'nav' + (k === page ? ' on' : '')} onClick={() => { setPage(k); setOpen(false); }}><I size={18} />{l}</button>)}</aside>
    <main className="main"><button className="btn menu" onClick={() => setOpen(!open)}><Menu size={18} />Menu</button><h1>{cur[1]}</h1><p className="sub">Subnet & IP Address Planning Validation System</p><Comp key={page} /></main></div>;
}

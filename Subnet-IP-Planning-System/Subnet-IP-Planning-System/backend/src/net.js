// Networking + FLAT logic. Overlap uses numeric comparison (NOT regex/DFA).
const OCT = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`^${OCT}(?:\\.${OCT}){3}$`);
const CIDR_RE = new RegExp(`^${OCT}(?:\\.${OCT}){3}/(?:3[0-2]|[12]?\\d)$`);
const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const toIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');

// DFA: state = (octet index, digits read in octet). Rejects on first illegal transition.
function dfa(s) {
  let o = 0, d = 0, v = 0; const trace = [];
  const nm = () => `O${o + 1}:${d}d`;
  let cur = 'START';
  for (const ch of s) {
    let to = null, why = '';
    if (/\d/.test(ch)) {
      if (d === 1 && v === 0) why = 'leading zero not allowed';
      else if (v * 10 + Number(ch) > 255) why = 'octet value exceeds 255';
      else { v = v * 10 + Number(ch); d++; to = nm(); }
    } else if (ch === '.') {
      if (d === 0) why = 'empty octet (dot without digits)';
      else if (o === 3) why = 'more than 4 octets';
      else { o++; d = 0; v = 0; to = nm(); }
    } else why = 'illegal character';
    trace.push({ char: ch, from: cur, to: to || 'REJECT', why });
    if (!to) return { accepted: false, trace, reason: `Rejected at '${ch}': ${why}` };
    cur = to;
  }
  const ok = o === 3 && d > 0;
  return { accepted: ok, trace, reason: ok ? `Ended in accepting state ${cur}` : 'Input ended early: an IPv4 address needs 4 octets' };
}
const validMask = s => IPV4_RE.test(s) && (((~toInt(s)) >>> 0) & (((~toInt(s)) >>> 0) + 1)) === 0;

function validate(type, value) {
  value = String(value || '').trim();
  if (type === 'ipv4') { const d = dfa(value); const r = IPV4_RE.test(value); return { valid: r && d.accepted, regexMatch: r, dfa: d, message: r ? 'Valid IPv4 address' : d.reason }; }
  if (type === 'cidr') {
    const [ip = '', p] = value.split('/'); const d = dfa(ip); const r = CIDR_RE.test(value);
    return { valid: r, regexMatch: r, dfa: d, message: r ? 'Valid CIDR notation' : (!d.accepted ? d.reason : 'Prefix must be an integer 0-32 after a single "/"') };
  }
  if (type === 'mask') {
    const d = dfa(value); const r = IPV4_RE.test(value); const ok = r && validMask(value);
    return { valid: ok, regexMatch: r, dfa: d, message: ok ? `Valid mask (/${32 - Math.log2(2 ** 32 - toInt(value))})` : r ? 'Mask ones must be contiguous (e.g. 255.255.255.0)' : d.reason };
  }
  return { error: 'type must be ipv4, mask or cidr' };
}
function calc(ip, p) {
  const a = toInt(ip), size = 2 ** (32 - p), net = Math.floor(a / size) * size, bc = net + size - 1, mask = 2 ** 32 - size;
  let first = net + 1, last = bc - 1, usable = size - 2;
  if (p === 31) { first = net; last = bc; usable = 2; } else if (p === 32) { first = last = net; usable = 1; }
  return { input: `${ip}/${p}`, cidr: `${toIp(net)}/${p}`, prefix: p, network: toIp(net), broadcast: toIp(bc), mask: toIp(mask), wildcard: toIp(2 ** 32 - 1 - mask), firstHost: toIp(first), lastHost: toIp(last), totalHosts: size, usableHosts: usable, start: net, end: bc, firstInt: first, lastInt: last };
}
function parseSubnet(str, mask) {
  str = String(str || '').trim();
  if (str.includes('/')) { if (!CIDR_RE.test(str)) return { error: validate('cidr', str).message }; const [ip, p] = str.split('/'); return calc(ip, Number(p)); }
  if (!IPV4_RE.test(str)) return { error: validate('ipv4', str).message };
  if (!mask) return { error: 'Provide CIDR (a.b.c.d/n) or a subnet mask' };
  if (!validMask(String(mask).trim())) return { error: 'Invalid subnet mask: ' + validate('mask', mask).message };
  return calc(str, 32 - Math.log2(2 ** 32 - toInt(mask.trim())));
}
function checkOverlaps(list) {
  const items = list.map(s => ({ input: s, r: parseSubnet(s) }));
  const invalid = items.filter(i => i.r.error).map(i => ({ input: i.input, error: i.r.error }));
  const ok = items.filter(i => !i.r.error), overlaps = [];
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const a = ok[i].r, b = ok[j].r;
    if (a.start <= b.end && b.start <= a.end) overlaps.push({ a: a.cidr, b: b.cidr, relation: a.start === b.start && a.end === b.end ? 'identical' : a.start <= b.start && a.end >= b.end ? 'A contains B' : b.start <= a.start && b.end >= a.end ? 'B contains A' : 'partial overlap' });
  }
  return { subnets: ok.map(i => i.r), invalid, overlaps, hasOverlap: overlaps.length > 0 };
}
module.exports = { IPV4_RE, CIDR_RE, toInt, toIp, dfa, validate, calc, parseSubnet, checkOverlaps, validMask };

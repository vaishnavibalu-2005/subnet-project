const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export async function api(path, { method = 'GET', body } = {}) {
  let r;
  try { r = await fetch(`${BASE}/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Cannot reach the backend. Is it running and is VITE_API_URL correct?'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

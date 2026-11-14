const mongoose = require('mongoose');
let mongo = false;
const mem = { configs: [], history: [] }; let seq = 1;
const alloc = { ip: String, label: String };
const Config = mongoose.models.Config || mongoose.model('Config', new mongoose.Schema({ name: { type: String, required: true }, cidr: { type: String, required: true }, notes: String, allocations: [alloc] }, { timestamps: true }));
const Hist = mongoose.models.History || mongoose.model('History', new mongoose.Schema({ type: String, input: String, valid: Boolean, summary: String }, { timestamps: true }));
const m = d => d && { ...d, id: String(d._id), allocations: (d.allocations || []).map(({ ip, label }) => ({ ip, label })) };
const mh = d => d && { ...d, id: String(d._id) };
const now = () => new Date().toISOString();
module.exports = {
  useMongo: () => { mongo = true; }, mode: () => (mongo ? 'mongodb' : 'memory'),
  async listConfigs() { return mongo ? (await Config.find().sort('-createdAt').lean()).map(m) : [...mem.configs].reverse(); },
  async getConfig(id) { if (mongo) return mongoose.isValidObjectId(id) ? m(await Config.findById(id).lean()) : null; return mem.configs.find(c => c.id === id) || null; },
  async createConfig(d) { if (mongo) return m((await Config.create(d)).toObject()); const c = { id: String(seq++), allocations: [], ...d, createdAt: now(), updatedAt: now() }; mem.configs.push(c); return c; },
  async updateConfig(id, d) { if (mongo) return mongoose.isValidObjectId(id) ? m(await Config.findByIdAndUpdate(id, d, { new: true, runValidators: true }).lean()) : null; const c = mem.configs.find(x => x.id === id); if (!c) return null; Object.assign(c, d, { updatedAt: now() }); return c; },
  async deleteConfig(id) { if (mongo) return mongoose.isValidObjectId(id) && !!(await Config.findByIdAndDelete(id)); const n = mem.configs.length; mem.configs = mem.configs.filter(c => c.id !== id); return mem.configs.length < n; },
  async addHist(d) { try { if (mongo) await Hist.create(d); else mem.history.push({ id: String(seq++), ...d, createdAt: now() }); } catch (e) { console.warn('history save failed', e.message); } },
  async listHist() { return mongo ? (await Hist.find().sort('-createdAt').limit(200).lean()).map(mh) : [...mem.history].reverse().slice(0, 200); },
  async clearHist() { if (mongo) await Hist.deleteMany({}); else mem.history = []; },
};

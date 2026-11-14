require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const store = require('./src/store');
const PORT = process.env.PORT || 5000;
(async () => {
  if (process.env.MONGODB_URI) {
    try { await mongoose.connect(process.env.MONGODB_URI); store.useMongo(); console.log('MongoDB connected'); }
    catch (e) { console.warn('MongoDB failed, using in-memory fallback:', e.message); }
  } else console.warn('MONGODB_URI not set: using in-memory fallback storage');
  app.listen(PORT, () => console.log(`API on :${PORT} (storage: ${store.mode()})`));
})();

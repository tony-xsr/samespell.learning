/**
 * LeanWithAI learntools API — bản gọn chạy trên server chung với samespell.
 *
 * Chỉ đọc/cập nhật từ vựng (route sinh từ leanwithAI bằng scripts/sync-from-leanwithai.js).
 * Không cron, không socket.io, không AI, không admin.
 *
 * Bảo vệ: mọi request /api/* phải có token
 *   Authorization: Bearer <LEARNTOOLS_TOKEN>     (app iOS, extension)
 *   hoặc ?token=<LEARNTOOLS_TOKEN>                (khi không đặt được header)
 * /health công khai, không lộ dữ liệu.
 * /api/music/*  nhạc nền cho Player (music.json + *.m4a), thư mục mount từ host — ./deploy.sh learntools-music
 *
 * Env: MONGODB_URI, LEARNTOOLS_TOKEN, PORT (mặc định 3000), MUSIC_DIR (mặc định ./music)
 */
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leanwithai';
const TOKEN = process.env.LEARNTOOLS_TOKEN || '';

if (!TOKEN && process.env.NODE_ENV === 'production') {
  console.error('LỖI: thiếu LEARNTOOLS_TOKEN — không chạy API công khai mà không có token.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// CORS: extension (chrome-extension://…) và trang web gọi từ origin khác. Dữ liệu đã có token chặn.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

function tokenOk(given) {
  if (!TOKEN) return true; // chạy local không đặt token
  if (typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.use('/api', (req, res, next) => {
  const auth = req.get('authorization') || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : req.query.token;
  if (tokenOk(given)) return next();
  res.status(401).json({ error: 'Thiếu hoặc sai token' });
});

// Nhạc nền: file tĩnh, hỗ trợ Range; m4a không đổi tên khi đổi nội dung nên cache vừa phải, music.json luôn tươi.
app.use('/api/music', express.static(process.env.MUSIC_DIR || path.join(__dirname, 'music'), {
  index: false,
  maxAge: '7d',
  setHeaders: (res, file) => { if (file.endsWith('.json')) res.setHeader('Cache-Control', 'no-cache'); },
}));

app.use(express.json({ limit: '1mb' }));
// ?exclude= chứa id không phải ObjectId (dữ liệu cũ/thử nghiệm ở client) làm route gốc ném CastError → 500.
app.use('/api/learntools', (req, res, next) => {
  if (typeof req.query.exclude === 'string') {
    req.query.exclude = req.query.exclude.split(',').filter(id => /^[a-f0-9]{24}$/i.test(id.trim())).join(',');
  }
  next();
});
app.use('/api/learntools', require('./src/routes/learntools'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.path}]`, err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Lỗi server' });
});

/**
 * Index cho các truy vấn nóng (lấy thẻ đến hạn, đếm, streak). Model gốc thiếu chúng: trên VPS
 * dict-card phải sort 110k mục → 6 giây. createIndex là idempotent, chạy mỗi lần khởi động.
 */
async function ensureIndexes() {
  const db = mongoose.connection.db;
  const specs = {
    vocabs: [
      { next_review_at: 1 },
      { user_id: 1, language: 1, next_review_at: 1 },
      { user_id: 1, deck_name: 1, next_review_at: 1 },
      { language: 1, next_review_at: 1 },
      { status: 1, user_id: 1 },
      { 'listen.hard_at': -1 },
      { user_id: 1, deck_name: 1, 'listen.count': 1 },
      { user_id: 1, deck_name: 1, 'listen.next_at': 1 },
    ],
    dictionaryentries: [
      { 'spaced_review.next_review': 1 },
      { language: 1, 'spaced_review.next_review': 1 },
      { source_deck: 1, 'spaced_review.next_review': 1 },
      { source_deck: 1, language: 1 },
      { 'listen.hard_at': -1 },
      { source_deck: 1, 'listen.count': 1 },
      { source_deck: 1, 'listen.next_at': 1 },
    ],
    reviewlogs: [{ t: 1 }],  // {user_id,t} đã có sẵn (unique) từ model
    ankireviews: [{ user_id: 1, rating: 1 }],
    bookmarkedcards: [{ user_id: 1, created_at: -1 }],
  };
  for (const [col, keys] of Object.entries(specs)) {
    for (const key of keys) {
      await db.collection(col).createIndex(key).catch(e => console.warn(`index ${col}`, JSON.stringify(key), e.message));
    }
  }
}

async function start() {
  for (let i = 1; ; i++) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
      break;
    } catch (e) {
      if (i >= 30) { console.error('Không kết nối được MongoDB:', e.message); process.exit(1); }
      console.log(`Chờ MongoDB… (${i})`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const t0 = Date.now();
  await ensureIndexes();
  console.log(`index OK (${Date.now() - t0}ms)`);
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`learntools-api :${PORT} · DB ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')} · token ${TOKEN ? 'bật' : 'TẮT'}`);
  });
  const stop = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

start();

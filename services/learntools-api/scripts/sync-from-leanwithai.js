#!/usr/bin/env node
/**
 * Sinh lại bản API GỌN từ backend gốc của LeanWithAI.
 *
 *   node scripts/sync-from-leanwithai.js                       (mặc định ../../../leanwithAI/backend)
 *   node scripts/sync-from-leanwithai.js /đường/dẫn/leanwithAI/backend
 *
 * Chỉ lấy những gì cần để ĐỌC và CẬP NHẬT từ vựng (lấy thẻ, chấm điểm, bộ thẻ, thống kê, lưu thẻ,
 * tra từ, quiz). KHÔNG lấy: admin, AI enhance, TTS, import Anki, cron, socket.io, homework…
 *
 * Route được chép NGUYÊN VĂN (cả comment phía trên) từ routes/learntools.js. Nếu một route được giữ
 * mà dùng tới thứ đã bị bỏ (callAI, tts, upload…), script DỪNG và báo — không sinh ra route hỏng.
 *
 * KHÔNG sửa tay các file trong src/ — sửa ở leanwithAI rồi chạy lại script này.
 * Riêng server.js (token, health, kết nối DB) là code của thư mục này, sửa thoải mái.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', '..', 'leanwithAI', 'backend'));
const OUT = path.join(__dirname, '..', 'src');

// Route giữ lại (method + path đúng như trong learntools.js)
const KEEP = [
  'get /decks', 'get /dict-decks', 'get /weak-cards', 'get /upcoming',
  'get /card', 'post /review', 'get /dict-card', 'post /dict-review', 'post /master', 'get /card-batch', 'get /deck-progress', 'post /listen-log', 'get /listen-queue', 'get /listen-week', 'get /app-state', 'post /app-state',
  'post /add-vocab',
  'get /stats', 'post /review-log', 'get /review-log', 'get /review-days', 'get /shown-today', 'get /forecast',
  'get /bookmarks', 'post /bookmark', 'delete /bookmarks/:id',
  'post /quiz/start', 'post /quiz/:sessionId/answer', 'post /quiz/:sessionId/end', 'get /quiz/session/:sessionId',
  'get /weak-drill', 'get /milestones', 'get /streak', 'get /dict-search',
  'get /leeches', 'post /suspend', 'get /related-words',
  'get /user-stats', 'post /user-stats/xp', 'post /user-stats/immersion',
];

// Hàm trợ giúp ở cấp file mà các route trên cần
const HELPERS = ['extractKeywords', 'overlapScore', 'pickByStrategy', 'escapeRegex', 'toVocabCard', 'toDictCard', 'applyTagFilter'];

// Thứ đã bị lược bỏ — route nào còn nhắc tới là lỗi
const FORBIDDEN = [
  'callAI', 'tts.', 'pinyinSv', 'explain(', 'enhanceQueue', 'enhanceOne', 'startBulk', 'cancelBulk',
  'getBulkProgress', 'pingProvider', 'upload.', 'VocalNote', 'MiningHistory', 'tokenizeText', 'mineWords',
  'fetchYtTranscript', 'levenshtein', 'CHAT_LANG_NAMES', 'fs.', 'os.', 'multer',
];

const MODELS = ['Vocab', 'DictionaryEntry', 'ReviewLog', 'BookmarkedCard', 'UserStats', 'AnkiReview'];

function read(rel) { return fs.readFileSync(path.join(SRC, 'src', rel), 'utf8'); }

/** Từ dòng bắt đầu, lấy tới dòng `});` / `}` đóng ở cột 0. Kèm khối comment `//` liền phía trên. */
function takeBlock(lines, start, closer) {
  let end = start;
  while (end < lines.length && !closer.test(lines[end])) end++;
  if (end >= lines.length) throw new Error('Không tìm thấy điểm kết thúc cho: ' + lines[start]);
  let top = start;
  while (top > 0 && /^\s*(\/\/|\/\*|\*)/.test(lines[top - 1])) top--;
  return lines.slice(top, end + 1).join('\n');
}

function main() {
  if (!fs.existsSync(path.join(SRC, 'src', 'routes', 'learntools.js'))) {
    console.error('LỖI: không thấy ' + path.join(SRC, 'src/routes/learntools.js'));
    process.exit(1);
  }
  const lines = read('routes/learntools.js').split('\n');

  // ── Route ──
  const found = new Map();
  lines.forEach((l, i) => {
    const m = l.match(/^router\.(get|post|put|delete)\('([^']+)'/);
    if (m) {
      const key = `${m[1]} ${m[2]}`;
      if (KEEP.includes(key)) found.set(key, takeBlock(lines, i, /^\}\);\s*$/));
    }
  });
  const missing = KEEP.filter(k => !found.has(k));
  if (missing.length) { console.error('LỖI: không thấy route trong learntools.js: ' + missing.join(', ')); process.exit(1); }

  // ── Helper ──
  const helpers = HELPERS.map(name => {
    const i = lines.findIndex(l => new RegExp(`^(async )?function ${name}\\(`).test(l));
    if (i < 0) throw new Error('Không thấy hàm ' + name);
    // Hàm 1 dòng (escapeRegex) kết thúc ngay trên dòng đó
    return /\}\s*$/.test(lines[i]) && (lines[i].match(/\{/g) || []).length === (lines[i].match(/\}/g) || []).length
      ? lines[i] : takeBlock(lines, i, /^\}\s*$/);
  });

  const body = [...helpers, ...KEEP.map(k => found.get(k))].join('\n\n');
  const bad = FORBIDDEN.filter(f => body.includes(f));
  if (bad.length) {
    console.error('LỖI: route được giữ đang dùng phần đã lược bỏ: ' + bad.join(', '));
    console.error('→ Bỏ route đó khỏi KEEP hoặc chép thêm phần phụ thuộc.');
    process.exit(1);
  }

  const router = `/**
 * FILE SINH TỰ ĐỘNG bởi scripts/sync-from-leanwithai.js — KHÔNG SỬA TAY.
 * Nguồn: leanwithAI/backend/src/routes/learntools.js (${new Date().toISOString().slice(0, 10)})
 * Chỉ gồm ${KEEP.length} route đọc/cập nhật từ vựng.
 */
const express = require('express');
const Vocab           = require('../models/Vocab');
const DictionaryEntry = require('../models/DictionaryEntry');
const ReviewLog       = require('../models/ReviewLog');
const BookmarkedCard  = require('../models/BookmarkedCard');
const UserStats       = require('../models/UserStats');
const AnkiReview      = require('../models/AnkiReview');
const { recordReview } = require('../services/srs');
const {
  buildQuizQuestions, createSession, getSession, checkAnswer, endSession,
} = require('../services/ankiQuizService');

const router = express.Router();

${body}

module.exports = router;
`;

  // ── SRS: chỉ hàm recordReview (ankiService gốc kéo theo sql.js, adm-zip… cho import) ──
  const ak = read('services/ankiService.js').split('\n');
  const ri = ak.findIndex(l => /^async function recordReview\(/.test(l));
  if (ri < 0) throw new Error('Không thấy recordReview trong ankiService.js');
  const srs = `/**
 * FILE SINH TỰ ĐỘNG — chỉ hàm recordReview (SM-2) chép từ leanwithAI/backend/src/services/ankiService.js.
 */
const Vocab = require('../models/Vocab');
const AnkiReview = require('../models/AnkiReview');

${takeBlock(ak, ri, /^\}\s*$/)}

module.exports = { recordReview };
`;

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const d of ['routes', 'models', 'services']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'routes', 'learntools.js'), router);
  fs.writeFileSync(path.join(OUT, 'services', 'srs.js'), srs);
  fs.copyFileSync(path.join(SRC, 'src/services/ankiQuizService.js'), path.join(OUT, 'services/ankiQuizService.js'));
  for (const m of MODELS) fs.copyFileSync(path.join(SRC, 'src/models', m + '.js'), path.join(OUT, 'models', m + '.js'));
  // Script xử lý dữ liệu chạy trong container (docker exec … node scripts/<tên>)
  for (const f of ['build-tts-back.js', 'clean-notes.js', 'backup-learntools.js', 'restore-learntools.js']) {
    fs.copyFileSync(path.join(SRC, 'src/scripts', f), path.join(__dirname, f));
  }

  // Model / service được chép không được kéo thêm gì ngoài mongoose
  for (const f of [...MODELS.map(m => 'models/' + m + '.js'), 'services/ankiQuizService.js']) {
    const reqs = [...fs.readFileSync(path.join(OUT, f), 'utf8').matchAll(/require\('([^']+)'\)/g)].map(x => x[1]);
    const extra = reqs.filter(r => r !== 'mongoose' && !r.startsWith('../models/'));
    if (extra.length) { console.error(`LỖI: ${f} cần thêm ${extra.join(', ')}`); process.exit(1); }
  }

  console.log(`✅  Đã sinh src/ từ ${SRC}`);
  console.log(`    ${KEEP.length} route · ${MODELS.length} model · srs.js · ankiQuizService.js`);
}

main();

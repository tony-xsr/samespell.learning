#!/usr/bin/env node
/**
 * Dọn dữ liệu bẩn của dictionaryentries thành bản GỌN để hiển thị — KHÔNG sửa trường gốc.
 *
 *   node src/scripts/clean-notes.js            → mục chưa xử lý với quy tắc hiện tại
 *   node src/scripts/clean-notes.js --force    → làm lại tất cả
 *   node src/scripts/clean-notes.js --dry --sample 10
 *
 * Sinh thêm:
 *   memory_tip_clean     memory_tip bỏ mã CSS (#I_C{…}), `1` `4`, danh sách "Từ ghép: …" dài, cắt ≤ 400 ký tự
 *   translation_en_clean ''  khi translation_en là khối "1.English…\n中文…" cào từ web (không phải nghĩa), còn lại = bản sạch
 *   examples_extra       ≤ 2 cặp { sentence, translation_en } ngắn nhất chứa từ, lấy từ khối cào web đó
 *   notes_rule_v         phiên bản quy tắc
 * /dict-card (toDictCard) dùng bản _clean khi có.
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const RULE_V = 1;
const SCRIPT = { zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/ };
const len = (s) => [...s].length;

function cleanTip(tip, word) {
  let t = String(tip || '')
    .replace(/#[A-Za-z_]+\{[^}]*\}/g, ' ')        // CSS rác
    .replace(/`\d+`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[sound:[^\]]+\]/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*Từ ghép\s*:[\s\S]*$/i, '')       // danh sách từ ghép dài dằng dặc
    .replace(/\s+/g, ' ')
    .trim();
  // Bỏ tiền tố lặp lại chính từ đó ("因此 因此 [yīncǐ] …" → "[yīncǐ] …")
  if (word) while (t.startsWith(word)) t = t.slice(word.length).trim();
  t = t
    .replace(/\[([^\]]*)\]/g, '($1)')                      // [ ] phá cú pháp tag [vn: …] → ( )
    .replace(/\s*(Bộ:|Số nét:|Hán Việt:|Từ ghép:)/g, '\n$1 ')
    .replace(/\s(\d{1,2})\.\s/g, '\n$1. ')                   // nghĩa đánh số xuống dòng
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (len(t) > 400) {
    const head = [...t].slice(0, 400).join('');
    const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('。'), head.lastIndexOf('.'));
    t = (end > 150 ? head.slice(0, end + 1) : head.replace(/\s+\S*$/, '')) + ' …';
  }
  return t;
}

/** "1.English sentence\n   中文句子\n 2.…" → [{ en, tgt }] */
function scrapedPairs(te, lang) {
  const S = SCRIPT[lang];
  if (!S) return null;
  const raw = String(te || '');
  if (!/^\s*1\./.test(raw) || !S.test(raw)) return null;
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < lines.length; i++) {
    const en = lines[i].replace(/^\d+\.\s*/, '');
    const next = lines[i + 1] || '';
    if (/^\d+\./.test(lines[i]) && !S.test(en) && S.test(next)) { pairs.push({ en, tgt: next }); i++; }
  }
  return pairs;
}

function build(e) {
  const out = { notes_rule_v: RULE_V };
  if (e.memory_tip) out.memory_tip_clean = cleanTip(e.memory_tip, e.word);
  const pairs = scrapedPairs(e.translation_en, e.language);
  if (pairs) {
    out.translation_en_clean = '';
    const word = e.word || '';
    out.examples_extra = pairs
      .filter(p => len(p.tgt) <= 45 && len(p.en) <= 160)
      .sort((a, b) => (b.tgt.includes(word) - a.tgt.includes(word)) || (len(a.tgt) - len(b.tgt)))
      .slice(0, 2)
      .map(p => ({ sentence: p.tgt, translation_en: p.en }));
  } else if (e.translation_en) {
    out.translation_en_clean = String(e.translation_en).replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  return out;
}

async function main() {
  const force = process.argv.includes('--force');
  const dry = process.argv.includes('--dry');
  const sampleIdx = process.argv.indexOf('--sample');
  const sample = sampleIdx > 0 ? Number(process.argv[sampleIdx + 1]) || 5 : 0;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/leanwithai', { serverSelectionTimeoutMS: 10000 });
  const col = mongoose.connection.db.collection('dictionaryentries');
  const match = { $or: [{ memory_tip: { $nin: [null, ''] } }, { translation_en: { $nin: [null, ''] } }] };
  if (!force) match.notes_rule_v = { $ne: RULE_V };
  const total = await col.countDocuments(match);
  console.log(`clean-notes v${RULE_V} · ${total} mục${dry ? ' (CHẠY THỬ)' : ''}`);
  let done = 0, shown = 0, batch = [];
  for await (const e of col.find(match, { projection: { word: 1, language: 1, memory_tip: 1, translation_en: 1 } })) {
    const set = build(e);
    if (sample && shown < sample) {
      shown++;
      console.log(`\n• ${e.word}\n  tip:  ${(set.memory_tip_clean ?? '').slice(0, 160)}\n  en:   ${JSON.stringify(set.translation_en_clean)}\n  ex:   ${JSON.stringify(set.examples_extra || [])}`);
    }
    if (!dry) batch.push({ updateOne: { filter: { _id: e._id }, update: { $set: set } } });
    if (batch.length >= 1000) { await col.bulkWrite(batch, { ordered: false }); batch = []; }
    done++;
    if (dry && sample && shown >= sample) break;
  }
  if (batch.length) await col.bulkWrite(batch, { ordered: false });
  console.log(`Xong ${done} mục.`);
  await mongoose.disconnect();
}

main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });

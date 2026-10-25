#!/usr/bin/env node
/**
 * Sinh trường `tts_back` cho dictionaryentries — "kịch bản đọc" NGẮN cho chế độ học thụ động.
 *
 *   node src/scripts/build-tts-back.js                       → mọi mục chưa xử lý với quy tắc hiện tại
 *   node src/scripts/build-tts-back.js --decks HSK4-5-6,Kore2026
 *   node src/scripts/build-tts-back.js --lang zh
 *   node src/scripts/build-tts-back.js --force               → chạy lại cả mục đã xử lý
 *   node src/scripts/build-tts-back.js --dry --sample 5      → chỉ in thử, không ghi
 *   node src/scripts/build-tts-back.js --report              → chỉ in % đã xử lý theo bộ
 *
 * KHÔNG sửa trường gốc nào (translation_en, examples, back_field, memory_tip… giữ nguyên để hiển thị).
 * Chỉ ghi thêm: tts_back (chuỗi tag như ai_back) + tts_rule_v (phiên bản quy tắc).
 * tts_back = '' nghĩa là đã xử lý nhưng không tìm được gì đáng đọc (client chỉ đọc mặt trước).
 * Mục có tts_source='ai' (do ai-fill-tts.js bù) được bỏ qua, trừ khi --force.
 *
 * Kịch bản: [vn: nghĩa ngắn] [ex_<lang>: 1 câu ví dụ ngắn] [ex_vn: dịch câu đó nếu có]
 * Nguồn câu ví dụ, theo thứ tự ưu tiên:
 *   1. examples[] (câu sạch do AI sinh, có bản dịch)
 *   2. back_field 🎵 câu hát + 📖 bản dịch (các bộ *song)
 *   3. translation_en dạng "1.English…\n中文…" (bộ HSK/Chinese cào từ web) → câu đích ngắn nhất chứa từ
 * Đổi quy tắc → tăng RULE_V → chạy lại (mục cũ tự được xử lý lại).
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const RULE_V = 5;   // v2: bỏ cặp "chữ (âm Hán Việt)"; v3: 🌸 = bản dịch câu hát; v4: bỏ nghĩa tiếng Anh (chỉ đọc tiếng Việt)
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leanwithai';

const SCRIPT = {
  zh: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/,
  ko: /[가-힯]/,
};
// Độ dài tối đa câu ví dụ để đọc tự nhiên (ký tự CJK / Hangul, hoặc ký tự Latin)
const MAX_EX = { zh: 28, ja: 32, ko: 40 };
const MAX_EX_LATIN = 90;

function clean(s) {
  return String(s || '')
    .replace(/\[sound:[^\]]+\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/#[A-Za-z_]+\{[^}]*\}/g, ' ')   // CSS rác: #I_C{width:18px;…}
    .replace(/`\d+`/g, ' ')
    .replace(/[\[\]]/g, ' ')                  // tránh phá cú pháp tag
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const hasTarget = (s, lang) => (SCRIPT[lang] ? SCRIPT[lang].test(s) : /[a-zA-Z]/.test(s));
const len = (s) => [...s].length;
const maxEx = (lang) => MAX_EX[lang] || MAX_EX_LATIN;

const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const MARKS = '🎵📖🔍🧠💡🧩📘📌🔹🔸🉐🌸📝👉✨⭐🔥';
const NOT_MARK = `[^${MARKS}\\n]`;

/** Thẻ "câu" (mặt trước là cả câu/cụm) → mặt sau chỉ cần đọc bản dịch, không cần ví dụ. */
function isSentenceCard(word, lang) {
  const w = String(word || '').trim();
  if (SCRIPT[lang] && lang !== 'ko') return len(w.replace(/[^぀-ヿ一-鿿]/g, '')) > 6;
  return /\s/.test(w) || /[.?!。？！]/.test(w);
}

/** Cắt gọn: giữ nguyên nếu ≤ max, nếu không cắt ở cuối câu / dấu phẩy gần nhất. */
function cut(s, max) {
  let c = clean(s).replace(/^\d+[.)]\s*/, '').replace(/^[-–:→\s]+/, '')
    .replace(/([.!?…;)])(?=\p{Lu})/gu, '$1 ')                         // "nữa.Cần" → "nữa. Cần"
    .replace(/\s*\p{Lu}[\p{L}]*(?:\s\p{L}+){0,3}\s*[:：]\s*$/u, '')  // đuôi nhãn cụt "Chiết tự:" / "Ví dụ:"
    .replace(/([.!?…])\s*(?:Cần mình|Bạn có muốn|Mình có thể)[^.!?]*[.!?]?$/u, '$1') // đuôi chatbot (chỉ khi đứng SAU một câu khác)
    .trim();
  if (len(c) <= max) return c;
  const head = [...c].slice(0, max).join('');
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('!'), head.lastIndexOf('?'), head.lastIndexOf('…'));
  if (end > max * 0.4) return head.slice(0, end + 1).trim();
  const comma = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'));
  if (comma > max * 0.4) return head.slice(0, comma).trim();
  return head.replace(/\s+\S*$/, '').trim();
}

/** Nghĩa của TỪ: tối đa 3 nghĩa đầu, ≤ 60 ký tự. */
function shortMeaning(s) {
  const c = clean(s).replace(/^\d+[.)]\s*/, '');
  if (!c) return '';
  return cut(c.split(/\s*[;,，；/|]\s*/).filter(Boolean).slice(0, 3).join(', '), 60);
}

const isViText = (s, lang) => VI.test(s) && !hasTarget(s, lang === 'en' ? 'zh' : lang) && !looksPinyin(s);
/** Pinyin/romaji có dấu dễ bị nhầm là tiếng Việt: dấu thanh riêng của pinyin, "q" không đi với "u", ≥2 từ có f/j/w/z. */
function looksPinyin(s) {
  if (/[ǎǐǒǔǖǘǚǜāēīōū]/.test(s)) return true;
  if (/q[iíìǐīỉĩị]/i.test(s) || /zh[aeiouàáâãèéêìíòóôõùúǎǐǒǔ]/i.test(s)) return true;   // "qi…", "zh…" chỉ có trong pinyin   // "qi…" chỉ có trong pinyin (tiếng Việt luôn là "qu"; "QR", "Uniqlo" không tính)
  // ≥2 từ VIẾT THƯỜNG có f/j/w/z (pinyin/romaji); tên riêng viết hoa như "Yaizu", "Omaezaki" không tính
  return s.split(/\s+/).filter(w => /^\p{Ll}/u.test(w) && /[fjwz]/.test(w)).length >= 2;
}
/** Câu dịch "dùng được": bắt đầu như đầu câu, đủ dài, không phải đoạn giới thiệu/giải thích. */
const INTRO = /^(Dưới đây|Việc |Đây là|Danh sách|Lưu ý|Ví dụ|Cách dùng|Giải thích|Trong tiếng|Từ này|Cụm từ|Cấu trúc|Kết hợp|Bạn có muốn|Nếu bạn|Hy vọng|Tóm lại|Tuyệt|Cùng phân tích|Chắc chắn rồi|Dĩ nhiên|Được rồi|Rất hay)/i;
const LABEL_ONLY = /^(Nghĩa|Dịch|Ví dụ|Ghi chú|Nghĩa là|Ý nghĩa|Từ vựng|Ngữ pháp|Cách dùng|Giải thích|Phân tích|Lưu ý)[.:…]?$/i;
const goodSentence = (c) => len(c) >= 6 && !LABEL_ONLY.test(c.trim())
  && /^["“'‘(]?[\p{Lu}0-9]/u.test(c)
  && !INTRO.test(c)
  && !/[:：,，"“]$/.test(c)
  && !/\p{Ll}\p{Lu}/u.test(c);   // chữ dính liền kiểu tiêu đề bảng "Hán NômTiếng Việt"

/** Cắt phần đầu "sạch": dừng ở chữ đích, ở chỗ dính chữ "khoảnDùng", bỏ ngoặc kép bao quanh. */
function firstPart(str, lang) {
  let c = String(str || '').split(/→|➤|➡️/)[0];
  if (SCRIPT[lang]) { const i = c.search(SCRIPT[lang]); if (i >= 0) c = c.slice(0, i); }
  const g = c.search(/\p{Ll}\p{Lu}/u);
  if (g >= 0) c = c.slice(0, g + 1);
  c = clean(c).replace(/^["“'‘]+|["”'’]+$/g, '').replace(/["“”]/g, '').trim();
  return c;
}

/**
 * Lấy nghĩa/bản dịch từ back_field (ghi chú tự do import từ Anki). Thử lần lượt:
 *   🔍 <từ> (漢): nghĩa  →  "Nghĩa: …"  →  📖/🌸/→ <bản dịch>  →  đoạn tiếng Việt đầu tiên
 */
/**
 * back_field đôi khi là ghi chú của thẻ KHÁC (import Anki lệch dòng): có chữ ngoại ngữ nhưng không chứa
 * từ đang học → không tin được. Ghi chú thuần tiếng Việt (chỉ là bản dịch) thì vẫn dùng.
 */
function backFieldMatches(bf, word, lang) {
  const S = SCRIPT[lang];
  if (!S || !bf) return true;
  const raw = String(bf).replace(/\s+/g, '');
  if (!S.test(raw)) return true;
  // Chữ "mang nghĩa" của từ: chữ Hán (zh/ja) hoặc âm tiết Hangul (ko) — kana/trợ từ quá phổ biến nên bỏ
  const CORE = lang === 'ko' ? /[\uac00-\ud7af]/ : /[\u4e00-\u9fff\u3400-\u4dbf]/;
  const chars = [...new Set([...String(word)].filter(ch => CORE.test(ch)))];
  if (!chars.length) return true;
  const hit = chars.filter(ch => raw.includes(ch)).length;
  return hit >= 1 && hit / chars.length >= 0.25;
}

function meaningFromBackField(bf, word, lang, sentence) {
  const raw = String(bf || '');
  if (!raw.trim() || !backFieldMatches(raw, word, lang)) return '';
  const max = sentence ? 120 : 60;
  const fin = (x) => (sentence ? cut(x, max) : shortMeaning(x));
  const ok = (x) => x && len(x) >= 2 && isViText(x, lang) && !LABEL_ONLY.test(x.trim());
  const esc = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SKIP = `[${MARKS}\\s👉➡️]*`;

  // a. 🔍 <từ> (漢): nghĩa  (thẻ từ)
  if (!sentence) {
    const m = raw.match(new RegExp(`${esc}\\s*(?:\\([^)]*\\))?\\s*[:：]\\s*(${NOT_MARK}+)`, 'u'));
    const x = m && firstPart(m[1], lang);
    if (ok(x)) return fin(x);
  }
  // b. Nhãn: "Nghĩa: …", "Nghĩa tiếng Việt: …", "Dịch: …", "… có nghĩa là …"
  for (const re of [
    new RegExp(`(?:Nghĩa(?: tiếng Việt| là)?|Dịch(?: nghĩa)?|Ý nghĩa|Ý là)\\s*[:：]${SKIP}(${NOT_MARK}+)`, 'iu'),
    new RegExp(`có nghĩa là\\s*(${NOT_MARK}+)`, 'iu'),
  ]) {
    const m = raw.match(re);
    const x = m && firstPart(m[1].split(/\s\(|\.\s/)[0], lang);
    if (ok(x)) return fin(x);
  }
  // c. Bản dịch sau 📖 / 🌸 / → — ưu tiên dấu nằm SAU chỗ xuất hiện của câu/từ
  const key = [...String(word)].slice(0, 6).join('');
  const from = Math.max(0, raw.indexOf(key));
  for (const part of [raw.slice(from), raw]) {
    const m = part.match(new RegExp(`(?:📖|🌸|→|➡️)${SKIP}(${NOT_MARK}+)`, 'u'));
    const x = m && firstPart(m[1], lang);
    if (ok(x) && goodSentence(x)) return fin(x);
  }
  // d. Thẻ ngữ pháp: "Động từ + 기에: Vì, bởi vì."  (dòng đầu có chữ đích, nghĩa sau dấu ':')
  if (SCRIPT[lang]) {
    const m = raw.match(new RegExp(`^[^\\n:：]*${SCRIPT[lang].source}[^\\n:：]*[:：]\\s*([^\\n]+)`, 'mu'));
    const x = m && firstPart(m[1], lang);
    if (ok(x)) return fin(x);
  }
  // e. Đoạn tiếng Việt đầu tiên: tách ở emoji, xuống dòng, nhãn, ngoặc phiên âm và chữ đích
  const STOP = /\n|\p{Extended_Pictographic}|→|Từ vựng|Ngữ pháp|Hán Việt|Hán Hàn|Chiết tự|Phân tích|Ghi chú|\([^)]*\)|\s{3,}/u;
  const segs = raw.split(STOP).flatMap(x => (x || '').split(SCRIPT[lang] ? new RegExp(SCRIPT[lang].source + '+', 'u') : /$^/));
  for (const seg of segs) {
    const c = clean(seg);
    if (len(c) <= 140 && isViText(c, lang) && goodSentence(c)) return fin(c);
  }
  return '';
}

/** Cắt câu dài lấy mệnh đề đầu chứa từ (nếu vừa độ dài). */
function trimSentence(s, word, lang) {
  const c = clean(s).replace(/^\d+[.)]\s*/, '');
  if (len(c) <= maxEx(lang)) return c;
  const pieces = c.split(/(?<=[。！？!?.；;])/).map(x => x.trim()).filter(Boolean);
  const hit = pieces.find(p => p.includes(word) && len(p) <= maxEx(lang)) || pieces.find(p => len(p) <= maxEx(lang) && hasTarget(p, lang));
  return hit || '';
}

function pickExample(e) {
  const lang = e.language;
  const word = e.word || '';
  const cands = [];

  // 1. examples[]
  for (const ex of e.examples || []) {
    const s = trimSentence(ex.sentence, word, lang);
    if (s && hasTarget(s, lang) && len(s) >= 3) {
      const full = clean(ex.sentence).replace(/^\d+[.)]\s*/, '');
      cands.push({ s, vi: s === full ? clean(ex.translation_vi) : '', score: 0 });
    }
  }
  // 2. back_field: 🎵 câu hát 📖 bản dịch
  const bf = backFieldMatches(e.back_field, word, lang) ? String(e.back_field || '') : '';
  const song = bf.match(/🎵\s*([^🎵📖🌸🔍🧠💡\n]+)(?:[📖🌸]\s*([^🎵📖🌸🔍🧠💡\n]+))?/u);
  if (song) {
    const s = clean(song[1]);
    if (s && hasTarget(s, lang) && len(s) <= maxEx(lang) + 10) cands.push({ s, vi: clean(song[2] || ''), score: 1 });
  }
  // 2b. back_field: "Ví dụ: <câu đích> … → <dịch>"  hoặc  "<câu đích> (<dịch>)"
  if (SCRIPT[lang] && bf) {
    const T = SCRIPT[lang].source;
    const vd = bf.match(new RegExp(`Ví dụ\\s*[:：]?[${MARKS}\\s]*([^\\n→]*?${T}[^\\n→]*?[。.!?！？])[^→\\n]*(?:→\\s*([^\\n${MARKS}]+))?`, 'u'));
    if (vd) {
      const s1 = trimSentence(vd[1], word, lang);
      if (s1 && hasTarget(s1, lang)) cands.push({ s: s1, vi: firstPart(vd[2] || '', lang), score: 1 });
    }
    const par = bf.match(new RegExp(`((?:${T})[^\\n()]*?)\\s*\\(([^)]*)\\)`, 'u'));
    // Chỉ nhận khi là CÂU + bản dịch câu — tránh cặp "谈 (tán)" (chữ + âm Hán Việt)
    if (par && isViText(par[2], lang) && !looksPinyin(par[2]) && /\s/.test(clean(par[2])) && len(clean(par[2])) >= 8) {
      const s2 = trimSentence(par[1], word, lang);
      if (s2 && s2 !== word && len(s2) >= Math.max(4, len(word) + 2)) cands.push({ s: s2, vi: clean(par[2]), score: 1 });
    }
  }
  // 3. translation_en dạng song ngữ cào web
  const te = String(e.translation_en || '');
  if (SCRIPT[lang] && te.length > 80 && SCRIPT[lang].test(te)) {
    const lines = te.split(/\n/).map(l => clean(l).replace(/^\d+[.)]\s*/, '')).filter(l => hasTarget(l, lang));
    const pool = lines
      .map(l => trimSentence(l, word, lang))
      .filter(l => l && len(l) >= 5 && !/[a-zA-Z]{3,}/.test(l))
      .sort((a, b) => (b.includes(word) - a.includes(word)) || (len(a) - len(b)));
    if (pool[0]) cands.push({ s: pool[0], vi: '', score: 2 });
  }

  for (let i = cands.length - 1; i >= 0; i--) if (len(cands[i].s) < Math.max(4, len(word) + 1)) cands.splice(i, 1);
  cands.sort((a, b) => a.score - b.score || (b.vi ? 1 : 0) - (a.vi ? 1 : 0));
  const best = cands[0];
  if (!best) return null;
  if (best.vi) { best.vi = cut(best.vi.replace(/^[.…\s]+/, ''), 120); if (!goodSentence(best.vi)) best.vi = ''; }
  if (best.vi && len(best.vi) > 120) best.vi = '';
  return best;
}

function buildTtsBack(e) {
  const lang = e.language;
  const word = e.word || '';
  const sentence = isSentenceCard(word, lang);
  const mTag = 'vn';
  let meaning = e.translation_vi ? (sentence ? cut(e.translation_vi, 120) : shortMeaning(e.translation_vi)) : '';
  if (!meaning) meaning = meaningFromBackField(e.back_field, word, lang, sentence);
  // Không đọc tạm nghĩa tiếng Anh: mặt trước = ngoại ngữ, mặt sau = tiếng Việt. Thiếu thì để AI bù (ai-fill-tts.js).
  // Thẻ câu: mặt trước đã là ví dụ → chỉ đọc bản dịch
  const ex = sentence ? null : pickExample(e);
  const parts = [];
  if (meaning) parts.push(`[${mTag}: ${meaning}]`);
  if (ex && ex.s !== word) {
    parts.push(`[ex_${lang}: ${ex.s}]`);
    if (ex.vi) parts.push(`[ex_vn: ${cut(ex.vi, 120)}]`);
  }
  return { tts: parts.join(' '), hasMeaning: !!meaning, hasExample: !!ex };
}

function docThamSo(argv) {
  const o = { decks: null, lang: '', force: false, dry: false, sample: 0, report: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--decks') o.decks = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--lang') o.lang = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--dry') o.dry = true;
    else if (a === '--sample') o.sample = Number(argv[++i]) || 5;
    else if (a === '--report') o.report = true;
    else if (a === '--uri') o.uri = argv[++i];
  }
  return o;
}

async function report(col, match) {
  const rows = await col.aggregate([
    { $match: match },
    { $group: {
      _id: { d: '$source_deck', l: '$language' },
      n: { $sum: 1 },
      done: { $sum: { $cond: [{ $eq: ['$tts_rule_v', RULE_V] }, 1, 0] } },
      ex: { $sum: { $cond: [{ $regexMatch: { input: { $ifNull: ['$tts_back', ''] }, regex: '\\[ex_' } }, 1, 0] } },
      mean: { $sum: { $cond: [{ $regexMatch: { input: { $ifNull: ['$tts_back', ''] }, regex: '^\\[(vn|en):' } }, 1, 0] } },
    } },
    { $sort: { '_id.l': 1, '_id.d': 1 } },
  ]).toArray();
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';
  console.log('\n' + 'Bộ thẻ'.padEnd(34) + 'Lang  Tổng    Đã xử lý  Có nghĩa  Có ví dụ');
  for (const r of rows) {
    console.log(`${String(r._id.d || '(không tên)').slice(0, 33).padEnd(34)}${(r._id.l || '').padEnd(6)}${String(r.n).padStart(6)}  ${pct(r.done, r.n).padStart(8)}  ${pct(r.mean, r.n).padStart(8)}  ${pct(r.ex, r.n).padStart(8)}`);
  }
}

async function main() {
  const o = docThamSo(process.argv);
  await mongoose.connect(o.uri || URI, { serverSelectionTimeoutMS: 10000 });
  const col = mongoose.connection.db.collection('dictionaryentries');

  const scope = {};
  if (o.decks) scope.source_deck = { $in: o.decks };
  if (o.lang) scope.language = o.lang;

  if (o.report) { await report(col, scope); return mongoose.disconnect(); }

  const match = { ...scope };
  if (!o.force) {
    match.tts_rule_v = { $ne: RULE_V };
    match.tts_source = { $nin: ['ai', 'claude'] };   // bản do AI / do Claude viết tay không bị quy tắc ghi đè
  }
  const total = await col.countDocuments(match);
  console.log(`Quy tắc v${RULE_V} · ${total} mục cần xử lý${o.dry ? ' (CHẠY THỬ)' : ''}`);

  const cursor = col.find(match, {
    projection: { word: 1, language: 1, translation_vi: 1, translation_en: 1, back_field: 1, examples: 1, source_deck: 1 },
  });
  let done = 0, shown = 0, lastPct = -1, batch = [];
  const flush = async () => {
    if (batch.length && !o.dry) await col.bulkWrite(batch, { ordered: false });
    batch = [];
  };
  for await (const e of cursor) {
    const r = buildTtsBack(e);
    if (o.sample && shown < o.sample) {
      shown++;
      console.log(`\n• ${e.source_deck} | ${e.word}\n  → ${r.tts || '(trống)'}`);
    }
    batch.push({ updateOne: { filter: { _id: e._id }, update: { $set: { tts_back: r.tts, tts_rule_v: RULE_V } } } });
    if (batch.length >= 1000) await flush();
    done++;
    const p = Math.floor((done / total) * 100);
    if (p !== lastPct && p % 10 === 0) { lastPct = p; console.log(`  … ${p}% (${done}/${total})`); }
    if (o.dry && o.sample && shown >= o.sample) break;
  }
  await flush();
  if (!o.dry) await report(col, scope);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async e => { console.error('LỖI: ' + e.message); try { await mongoose.disconnect(); } catch {} process.exit(1); });
}

module.exports = {
  buildTtsBack, RULE_V, SCRIPT, clean, cut, len, hasTarget, isViText, looksPinyin, isSentenceCard, maxEx,
};

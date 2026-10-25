/**
 * ankiQuizService.js
 * Generates quiz questions from AI-enhanced Anki cards.
 * No extra AI calls — all data is parsed from ai_front / ai_back tags.
 *
 * Question types:
 *   word_meaning — show word, pick Vietnamese meaning
 *   reverse      — show Vietnamese meaning, pick target-language word
 *   fill_blank   — complete the example sentence (pick word from 4 choices)
 */

const Vocab = require('../models/Vocab');

// ── Tag parser ─────────────────────────────────────────────────────────────────
const TAG_RE = /\[(ko|ja|zh|en|vi|vn|fr|es|ex_ko|ex_ja|ex_zh|ex_en|ex_vi|ex_vn|ex_fr|ex_es):\s*([^\]]+)\]/g;

function parseTags(str) {
  const tags = {};
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(str)) !== null) {
    const tag = m[1].trim();
    if (!tags[tag]) tags[tag] = m[2].trim();
  }
  return tags;
}

function getNative(tags, lang) {
  return tags[lang] || null;
}
function getMeaning(tags) {
  return tags['vn'] || tags['vi'] || null;
}
function getExample(tags, lang) {
  return tags[`ex_${lang}`] || null;
}
function getExampleVn(tags) {
  return tags['ex_vn'] || tags['ex_vi'] || null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(correct, distractors) {
  const unique = [...new Set(distractors.filter(d => d && d !== correct))];
  const pool   = shuffle(unique).slice(0, 3);
  while (pool.length < 3) pool.push('—');
  const all = shuffle([correct, ...pool]);
  return { choices: all, answer_index: all.indexOf(correct) };
}

// ── Question builders ──────────────────────────────────────────────────────────
function buildWordMeaning(card, tags, lang, distMeanings) {
  const native  = getNative(tags, lang) || card.ai_front;
  const meaning = getMeaning(tags);
  if (!native || !meaning) return null;
  const { choices, answer_index } = makeChoices(meaning, distMeanings);
  return {
    type:         'word_meaning',
    question:     native,
    hint:         'Nghĩa tiếng Việt của từ trên là?',
    choices,
    answer_index,
    explanation:  `${native} = ${meaning}` + (getExample(tags, lang) ? `\n📝 ${getExample(tags, lang)}` : ''),
    word:         native,
    lang,
    deck_name:    card.deck_name,
  };
}

function buildReverse(card, tags, lang, distNatives) {
  const native  = getNative(tags, lang) || card.ai_front;
  const meaning = getMeaning(tags);
  if (!native || !meaning) return null;
  const { choices, answer_index } = makeChoices(native, distNatives);
  return {
    type:         'reverse',
    question:     meaning,
    hint:         'Từ nào trong ngôn ngữ đích có nghĩa này?',
    choices,
    answer_index,
    explanation:  `"${meaning}" → ${native}` + (getExampleVn(tags) ? `\n📝 ${getExampleVn(tags)}` : ''),
    word:         native,
    lang,
    deck_name:    card.deck_name,
  };
}

function buildFillBlank(card, tags, lang, distNatives) {
  const native  = getNative(tags, lang) || card.ai_front;
  const example = getExample(tags, lang);
  if (!native || !example) return null;

  // Blank out the target word in the example sentence
  const escaped = native.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blanked  = example.replace(new RegExp(escaped, 'i'), '_____');
  if (blanked === example) return null; // word not in sentence

  const { choices, answer_index } = makeChoices(native, distNatives);
  const exVn = getExampleVn(tags);
  return {
    type:         'fill_blank',
    question:     blanked,
    hint:         exVn ? `(${exVn})` : 'Điền từ còn thiếu vào chỗ trống',
    choices,
    answer_index,
    explanation:  `✅ ${example}\n💡 ${native} = ${getMeaning(tags) || ''}`,
    word:         native,
    lang,
    deck_name:    card.deck_name,
  };
}

// ── Main builder ───────────────────────────────────────────────────────────────
async function buildQuizQuestions(opts = {}) {
  const { user_id, decks, lang, count = 10 } = opts;

  const query = {
    status:         { $nin: ['removed', 'mastered'] },
    ai_enhanced_at: { $exists: true },
  };
  if (user_id)              query.user_id   = user_id;
  if (lang)                 query.language  = lang;
  if (decks && decks.length) query.deck_name = { $in: decks };

  const poolSize = Math.max(count * 5, 100);
  const raw = await Vocab.find(query).sort({ next_review_at: 1 }).limit(poolSize).lean();

  // Parse each card once
  const pool = raw.map(card => {
    const tags    = parseTags(card.ai_back || '');
    const native  = getNative(tags, card.language) || card.ai_front;
    const meaning = getMeaning(tags);
    return { card, tags, native, meaning };
  }).filter(p => p.native && p.meaning);

  if (pool.length < 4) return [];

  const quizCards = shuffle(pool).slice(0, Math.min(count, pool.length));
  const questions = [];

  for (let i = 0; i < quizCards.length; i++) {
    const { card, tags } = quizCards[i];
    const cardLang  = card.language || lang || 'ko';
    const others    = pool.filter(p => p.card._id.toString() !== card._id.toString());
    const distMeaning = shuffle(others.map(p => p.meaning)).slice(0, 6);
    const distNative  = shuffle(others.map(p => p.native)).slice(0, 6);

    // Rotate question types: 0=word_meaning, 1=reverse, 2=fill_blank
    const typeIdx = i % 3;
    let q =
      typeIdx === 1 ? buildReverse(card, tags, cardLang, distNative) :
      typeIdx === 2 ? buildFillBlank(card, tags, cardLang, distNative) :
                     buildWordMeaning(card, tags, cardLang, distMeaning);

    // Fallback to word_meaning if chosen type failed
    if (!q) q = buildWordMeaning(card, tags, cardLang, distMeaning);
    if (!q) continue;

    q.card_id = card._id.toString();
    questions.push(q);
  }

  return questions;
}

// ── In-memory session store ────────────────────────────────────────────────────
const sessionCache = new Map();

function createSession(questions) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  sessionCache.set(id, { questions, answers: [], startedAt: Date.now() });
  setTimeout(() => sessionCache.delete(id), 60 * 60 * 1000); // 1hr TTL
  return id;
}

function getSession(id) {
  return sessionCache.get(id) || null;
}

function checkAnswer(sessionId, questionIndex, selectedIndex) {
  const sess = sessionCache.get(sessionId);
  if (!sess) return null;
  const q = sess.questions[questionIndex];
  if (!q) return null;
  const correct = selectedIndex === q.answer_index;
  sess.answers[questionIndex] = { question_index: questionIndex, selected_index: selectedIndex, correct };
  return {
    correct,
    correct_answer_index: q.answer_index,
    explanation: q.explanation,
    word: q.word,
    lang: q.lang,
  };
}

function endSession(sessionId) {
  const sess = sessionCache.get(sessionId);
  if (!sess) return null;
  const total    = sess.questions.length;
  const answered = sess.answers.filter(Boolean).length;
  const correct  = sess.answers.filter(a => a && a.correct).length;
  const score    = total ? Math.round((correct / total) * 100) : 0;
  const duration = Math.round((Date.now() - sess.startedAt) / 1000);
  const grade    = score >= 95 ? 'S' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  sessionCache.delete(sessionId);
  return { score, grade, correct, wrong: answered - correct, total, duration_seconds: duration };
}

module.exports = { buildQuizQuestions, createSession, getSession, checkAnswer, endSession };

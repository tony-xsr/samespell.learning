/**
 * FILE SINH TỰ ĐỘNG bởi scripts/sync-from-leanwithai.js — KHÔNG SỬA TAY.
 * Nguồn: leanwithAI/backend/src/routes/learntools.js (2026-10-23)
 * Chỉ gồm 40 route đọc/cập nhật từ vựng.
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

// ---------------------------------------------------------------------------
// Smart Card Sequencing helpers (Feature 22)
// ---------------------------------------------------------------------------
function extractKeywords(text = '') {
  return text.replace(/\[[\w_]+:/g, ' ').replace(/\]/g, ' ')
    .split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9가-힣ぁ-ゖァ-ヺ一-鿿]/g, ''))
    .filter(w => w.length >= 2);
}

function overlapScore(text = '', keywords = []) {
  const t = text.toLowerCase();
  return keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
}

async function pickByStrategy(mode, lastCard, baseQuery) {
  const q = { ...baseQuery };
  // Exclude the last card on top of any existing $nin list
  const existingNin = q._id?.$nin || [];
  q._id = { $nin: [...existingNin, lastCard._id] };

  if (mode === 'semantic_cluster') {
    const keywords = extractKeywords((lastCard.ai_back || '') + ' ' + (lastCard.back || ''));
    if (!keywords.length) return null;
    const pool = await Vocab.find({ ...q, deck_name: lastCard.deck_name }).limit(60).lean();
    if (!pool.length) return null;
    pool.sort((a, b) =>
      overlapScore((b.ai_back || '') + (b.back || ''), keywords) -
      overlapScore((a.ai_back || '') + (a.back || ''), keywords)
    );
    return pool[0].ai_back || pool[0].back ? pool[0] : null;
  }

  if (mode === 'phonetic_contrast') {
    const pron = (lastCard.pronunciation || '').toLowerCase().slice(0, 3);
    if (pron.length < 2) return null;
    const escaped = pron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Vocab.findOne({ ...q, pronunciation: { $regex: `^${escaped}`, $options: 'i' } }).lean();
  }

  if (mode === 'morphology_family') {
    const prefix = lastCard.front.slice(0, 2);
    if (!prefix) return null;
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Vocab.findOne({ ...q, front: { $regex: `^${escaped}` } }).lean();
  }

  if (mode === 'spaced_contrast') {
    // Different deck → ensures cross-deck variety
    return Vocab.findOne({ ...q, deck_name: { $ne: lastCard.deck_name } })
      .sort({ next_review_at: 1 }).lean();
  }

  return null;
}

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ---------------------------------------------------------------------------
// Card shapes shared by /card, /dict-card and /card-batch (what the extension / app render).
// ---------------------------------------------------------------------------
function toVocabCard(card) {
  return {
    _id:               card._id,
    owner_user_id:     card.user_id,
    front:             card.front,
    back:              card.back,
    ai_front:          card.ai_front  || null,
    ai_back:           card.ai_back   || null,
    ai_card_type:      card.ai_card_type || null,
    language:          card.language,
    deck_name:         card.deck_name,
    pronunciation:     card.pronunciation || null,
    example_sentences: card.example_sentences || [],
    interval_days:     card.interval_days,
    ease_factor:       card.ease_factor   || 2.5,
    synonyms:          card.synonyms || [],
    confusable_with:   (card.confusable_with || []).slice(0, 3).map(c => ({ word: c.word, reason: c.reason })),
    antonym:           card.antonym || null,
    word_family:       card.word_family || [],
    level:             card.level || null,
    tts_back:          card.tts_back ?? null,
    listen_count:      card.listen?.count || 0,
    hard_count:        card.listen?.hard || 0,
    listen_stage:      card.listen?.stage || 0,
  };
}

function toDictCard(entry) {
  // Build ai_back in the tagged format card.js already understands.
  // *_clean (scripts/clean-notes.js) replaces scraped-web translation_en and CSS-polluted memory_tip.
  const lt = entry.language;
  const en  = entry.translation_en_clean ?? entry.translation_en;
  const tip = entry.memory_tip_clean ?? entry.memory_tip;
  let aiBack = '';
  if (entry.translation_vi) aiBack += `[vn: ${entry.translation_vi}] `;
  if (en)                   aiBack += `[en: ${en}] `;
  if (entry.reading)        aiBack += `[ro: ${entry.reading}] `;
  if (entry.examples?.length) {
    const ex = entry.examples[0];
    if (ex.sentence)       aiBack += `[ex_${lt}: ${ex.sentence}] `;
    if (ex.translation_vi) aiBack += `[ex_vn: ${ex.translation_vi}] `;
  } else if (entry.examples_extra?.length) {
    const ex = entry.examples_extra[0];
    aiBack += `[ex_${lt}: ${ex.sentence}] `;
    if (ex.translation_en) aiBack += `[en: ${ex.translation_en}] `;
  }
  if (tip) aiBack += `[vn: 💡 ${tip}]`;
  aiBack = aiBack.trim();

  return {
    _id:               entry._id,
    source:            'dict',
    front:             entry.word,
    // back_field = mặt sau gốc import từ Anki (bộ *song, Kore*…) — trước đây bị bỏ qua nên thẻ trống
    back:              [entry.translation_vi, en].filter(Boolean).join(' / ') || entry.back_field || entry.word,
    ai_front:          entry.word,
    ai_back:           aiBack || null,
    ai_card_type:      'vocab',
    language:          entry.language,
    level:             entry.level,
    deck_name:         entry.source_deck || 'Dictionary',
    pronunciation:     entry.reading    || null,
    example_sentences: (entry.examples || []).map(e => e.sentence).filter(Boolean),
    interval_days:     entry.spaced_review?.interval_days || 1,
    ease_factor:       entry.spaced_review?.ease_factor   || 2.5,
    collocations:      entry.collocations || [],
    memory_tip:        tip || null,
    // Kịch bản đọc ngắn cho học thụ động (scripts/build-tts-back.js). null = chưa xử lý.
    tts_back:          entry.tts_back ?? null,
    listen_count:      entry.listen?.count || 0,
    hard_count:        entry.listen?.hard || 0,
    listen_stage:      entry.listen?.stage || 0,
  };
}

// ---------------------------------------------------------------------------
// GET /api/learntools/card-batch?card_source=dict|vocab&user_id=&decks=&lang=&limit=200
// Many full cards at once (same shape as /card, /dict-card) — for offline listening packs.
// Due / never-reviewed first, then the soonest upcoming. limit ≤ 500.
// ---------------------------------------------------------------------------
// Tag filters shared by /card, /dict-card, /listen-queue, /card-batch (the badges the apps show on a card):
//   ?bands=top500,top2000,top5000,adv   frequency band from `level` (same mapping as the apps' freqBand)
//   ?ai=1                               only cards with AI-enhanced back (✨AI)
// Mutates q: conditions go into q.$and so an existing $or (due filter) is kept.
function applyTagFilter(q, query) {
  const BANDS = {
    top500:  ['TOPIK1', 'N5', 'HSK1', 'A1'],
    top2000: ['TOPIK2', 'N4', 'HSK2', 'A2'],
    top5000: ['TOPIK3', 'N3', 'HSK3', 'B1'],
  };
  const conds = [];
  const bands = String(query.bands || '').split(',').map(b => b.trim()).filter(Boolean);
  if (bands.length) {
    const or = [];
    const levels = bands.flatMap(b => BANDS[b] || []);
    if (levels.length) or.push({ level: { $in: levels } });
    if (bands.includes('adv')) or.push({ level: { $nin: [...BANDS.top500, ...BANDS.top2000, ...BANDS.top5000, null, '', 'unknown'] } });
    if (or.length) conds.push({ $or: or });
  }
  if (query.ai === '1') conds.push({ ai_back: { $nin: [null, ''] } });
  if (conds.length) q.$and = [...(q.$and || []), ...conds];
  return q;
}

// ---------------------------------------------------------------------------
// GET /api/learntools/decks?user_id=&lang=
// Returns deck list with due counts.
// user_id omitted → all users' decks (so admin-imported decks show up).
// ---------------------------------------------------------------------------
router.get('/decks', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const now = new Date();

    const matchStage = { status: { $ne: 'removed' } };
    if (user_id) matchStage.user_id = user_id;
    if (lang)    matchStage.language = lang;

    const agg = await Vocab.aggregate([
      { $match: matchStage },
      { $group: {
        _id:     { deck: '$deck_name', lang: '$language', owner: '$user_id' },
        total:   { $sum: 1 },
        due:     { $sum: { $cond: [{ $lte: ['$next_review_at', now] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$ai_enhanced_at', null] }, null] }, 1, 0] } },
      }},
      { $sort: { '_id.deck': 1 } },
    ]);

    res.json({
      decks: agg.map(d => ({
        deck_name: d._id.deck  || 'default',
        language:  d._id.lang,
        owner:     d._id.owner,
        total:     d.total,
        due:       d.due,
        pending:   d.pending,
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/dict-decks?lang=
// Returns deck list from DictionaryEntry.source_deck with due counts.
// Used by the extension when card_source = 'dict'.
// ---------------------------------------------------------------------------
router.get('/dict-decks', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const now = new Date();
    const match = { source_deck: { $exists: true, $ne: null } };
    if (lang) match.language = lang;

    const agg = await DictionaryEntry.aggregate([
      { $match: match },
      { $group: {
        _id:   { deck: '$source_deck', lang: '$language' },
        total: { $sum: 1 },
        due:   { $sum: { $cond: [{
          $or: [
            { $lte: ['$spaced_review.next_review', now] },
            { $eq:  [{ $ifNull: ['$spaced_review.next_review', null] }, null] },
          ],
        }, 1, 0] }},
      }},
      { $sort: { '_id.deck': 1 } },
    ]);

    res.json({
      decks: agg.map(d => ({
        deck_name: d._id.deck,
        language:  d._id.lang,
        total:     d.total,
        due:       d.due,
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/weak-cards?user_id=&lang=&decks=&limit=20
// Cards with low ease_factor (struggled repeatedly). Used for drill sessions.
// ---------------------------------------------------------------------------
router.get('/weak-cards', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const deckNames = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    const limit     = Math.min(Number(req.query.limit) || 20, 50);

    const query = {
      status:      { $nin: ['removed', 'mastered'] },
      ease_factor: { $lt: 2.0 }, // below default 2.5 = hit Again at least 3 times
    };
    if (user_id)      query.user_id   = user_id;
    if (lang)         query.language  = lang;
    if (deckNames?.length) query.deck_name = { $in: deckNames };

    const cards = await Vocab.find(query)
      .sort({ ease_factor: 1 }) // weakest first
      .limit(limit)
      .lean();

    res.json({
      cards: cards.map(c => ({
        _id:          c._id,
        front:        c.front,
        back:         c.back,
        ai_front:     c.ai_front  || null,
        ai_back:      c.ai_back   || null,
        ai_card_type: c.ai_card_type || null,
        language:     c.language,
        deck_name:    c.deck_name,
        interval_days: c.interval_days,
        ease_factor:  c.ease_factor || 2.5,
        source:       'vocab',
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/upcoming?user_id=&decks=&lang=&limit=10&card_source=dict
// Next N cards due (today and overdue), sorted by next_review_at.
// ---------------------------------------------------------------------------
router.get('/upcoming', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const deckNames   = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    const limit       = Math.min(Number(req.query.limit) || 10, 30);
    const card_source = req.query.card_source || 'vocab';
    const endOfDay    = new Date(); endOfDay.setHours(23, 59, 59, 999);

    if (card_source === 'dict') {
      const q = {
        $or: [
          { 'spaced_review.next_review': { $lte: endOfDay } },
          { 'spaced_review.next_review': null },
        ],
      };
      if (lang)             q.language    = lang;
      if (deckNames?.length) q.source_deck = { $in: deckNames };
      const entries = await DictionaryEntry.find(q)
        .sort({ 'spaced_review.next_review': 1 })
        .limit(limit)
        .select('word language source_deck spaced_review')
        .lean();
      return res.json({ cards: entries.map(e => ({
        _id:           e._id,
        front:         e.word,
        language:      e.language,
        deck_name:     e.source_deck || 'Dictionary',
        next_review_at: e.spaced_review?.next_review || null,
        interval_days: e.spaced_review?.interval_days || 1,
      }))});
    }

    const q = {
      status:         { $nin: ['removed', 'mastered'] },
      next_review_at: { $lte: endOfDay },
    };
    if (user_id)       q.user_id   = user_id;
    if (lang)          q.language  = lang;
    if (deckNames?.length) q.deck_name = { $in: deckNames };
    const cards = await Vocab.find(q)
      .sort({ next_review_at: 1 })
      .limit(limit)
      .select('front language deck_name next_review_at interval_days')
      .lean();
    res.json({ cards: cards.map(c => ({
      _id:           c._id,
      front:         c.front,
      language:      c.language,
      deck_name:     c.deck_name,
      next_review_at: c.next_review_at,
      interval_days: c.interval_days,
    }))});
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/card?user_id=&decks=deck1,deck2&lang=en
// Returns the single most-overdue card.
// user_id omitted → draw from all users.
// decks omitted   → all decks.
// ---------------------------------------------------------------------------
router.get('/card', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;

    const deckParam = req.query.decks;
    const deckNames = deckParam ? deckParam.split(',').map(d => d.trim()).filter(Boolean) : null;

    const excludeIds = req.query.exclude
      ? req.query.exclude.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const baseQuery = {
      status: { $nin: ['removed', 'mastered'] },
      next_review_at: { $lte: new Date() },
    };
    if (user_id)          baseQuery.user_id  = user_id;
    if (lang)             baseQuery.language = lang;
    if (excludeIds.length) baseQuery._id     = { $nin: excludeIds };
    applyTagFilter(baseQuery, req.query);

    const lastDeck      = req.query.last_deck    || '';
    const strategyMode  = req.query.strategy_mode || '';
    const lastCardId    = req.query.last_card_id  || '';
    let card = null;

    // ── Strategy-based selection (Feature 22) ──────────────────────────────
    if (strategyMode && lastCardId) {
      try {
        const lastCard = await Vocab.findById(lastCardId).lean();
        if (lastCard) {
          const picked = await pickByStrategy(strategyMode, lastCard, baseQuery);
          if (picked) card = picked;
        }
      } catch { /* fall through to normal selection */ }
    }

    if (card) {
      // Strategy found a card — skip normal selection
    } else if (deckNames && deckNames.length > 1) {
      const candidates = [];
      for (const deck of deckNames) {
        const c = await Vocab.findOne({ ...baseQuery, deck_name: deck }).sort({ next_review_at: 1 });
        if (c) candidates.push(c);
      }
      if (candidates.length) {
        const others = candidates.filter(c => c.deck_name !== lastDeck);
        const pool   = others.length ? others : candidates;
        card = pool[Math.floor(Math.random() * pool.length)];
      }
    } else {
      if (deckNames && deckNames.length === 1) baseQuery.deck_name = deckNames[0];
      card = await Vocab.findOne(baseQuery).sort({ next_review_at: 1 });
    }

    if (!card) return res.json({ card: null });

    res.json({ card: toVocabCard(card) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/review
// Body: { vocab_id, rating, reviewer_user_id? }
// rating: 0=Again  1=Hard  2=Good  3=Easy
//
// If reviewer_user_id is provided and differs from the card owner:
//   - Upsert a personal Vocab copy under reviewer_user_id
//   - Run SRS on that personal copy (so reviewer builds own schedule)
//   - Also run SRS on the original (shared deck stays up to date too)
// If no reviewer_user_id: just update the original card.
// ---------------------------------------------------------------------------
router.post('/review', async (req, res, next) => {
  try {
    const { vocab_id, rating, reviewer_user_id } = req.body;
    if (!vocab_id || rating === undefined) {
      return res.status(400).json({ error: 'vocab_id and rating required' });
    }
    // Same stale-rating guard as /dict-review (offline replay from another device)
    if (Number(req.body.t) > 0) {
      const cur = await Vocab.findById(vocab_id).select('last_review_at').lean();
      if (cur?.last_review_at && Number(req.body.t) < new Date(cur.last_review_at).getTime() - 60_000) {
        return res.json({ ok: true, skipped: 'stale', last_review_at: cur.last_review_at });
      }
    }
    const ratingNum = Number(rating);
    if (![0, 1, 2, 3].includes(ratingNum)) {
      return res.status(400).json({ error: 'rating must be 0(Again) 1(Hard) 2(Good) 3(Easy)' });
    }

    // Always update the original card's SRS
    const original = await recordReview(vocab_id, ratingNum >= 2, ratingNum);
    if (!original) return res.status(404).json({ error: 'Card not found' });

    // If a reviewer is configured and is different from the card owner,
    // also track their personal progress on a copy of the card.
    if (reviewer_user_id && reviewer_user_id !== original.user_id) {
      let personal = await Vocab.findOne({
        user_id:  reviewer_user_id,
        front:    original.front,
        language: original.language,
        deck_name: original.deck_name,
      });
      if (!personal) {
        personal = await Vocab.create({
          user_id:           reviewer_user_id,
          front:             original.front,
          back:              original.back,
          pronunciation:     original.pronunciation,
          example_sentences: original.example_sentences,
          language:          original.language,
          deck_name:         original.deck_name,
          tags:              original.tags,
          level:             original.level,
          source:            'anki',
          status:            'active',
          interval_days:     1,
          ease_factor:       2.5,
        });
      }
      await recordReview(personal._id, ratingNum >= 2, ratingNum);
    }

    // Log this review so stats heatmap shows today's activity
    const logUserId = reviewer_user_id || original.user_id;
    if (logUserId) {
      const t = Math.floor(Date.now() / 1000);
      ReviewLog.updateOne(
        { user_id: logUserId, t },
        { $setOnInsert: { user_id: logUserId, t, d: original.deck_name || '', l: original.language || '' } },
        { upsert: true }
      ).catch(() => {});
    }

    res.json({
      ok:             true,
      next_review_at: original.next_review_at,
      interval_days:  original.interval_days,
      status:         original.status,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/dict-card?lang=&decks=
// Serve one DictionaryEntry due for review (card_source = 'dict').
// Response shape matches /card so card.js renders it identically.
// ---------------------------------------------------------------------------
router.get('/dict-card', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const deckNames = req.query.decks
      ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean)
      : null;

    const excludeIds = req.query.exclude
      ? req.query.exclude.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // null matches both null and missing (never-reviewed entries are always due)
    const baseQuery = {
      $or: [
        { 'spaced_review.next_review': { $lte: new Date() } },
        { 'spaced_review.next_review': null },
      ],
    };
    if (lang)              baseQuery.language = lang;
    if (excludeIds.length) baseQuery._id      = { $nin: excludeIds };
    applyTagFilter(baseQuery, req.query);

    const lastDeck = req.query.last_deck || '';
    let entry = null;

    if (deckNames && deckNames.length > 1) {
      // Fetch one due candidate per deck, then pick randomly for true fairness.
      // Exclude last_deck from the pool when other decks also have due cards.
      const candidates = [];
      for (const deck of deckNames) {
        const c = await DictionaryEntry.findOne({ ...baseQuery, source_deck: deck })
          .sort({ 'spaced_review.next_review': 1 });
        if (c) candidates.push(c);
      }
      if (candidates.length) {
        const others = candidates.filter(c => (c.source_deck || 'Dictionary') !== lastDeck);
        const pool   = others.length ? others : candidates;
        entry = pool[Math.floor(Math.random() * pool.length)];
      }
    } else {
      if (deckNames?.length === 1) baseQuery.source_deck = deckNames[0];
      entry = await DictionaryEntry.findOne(baseQuery)
        .sort({ 'spaced_review.next_review': 1 });
    }

    if (!entry) return res.json({ card: null });

    res.json({ card: toDictCard(entry) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/dict-review
// Body: { entry_id, rating }   rating: 0=Again 1=Hard 2=Good 3=Easy
// Applies SM-2 to DictionaryEntry.spaced_review.
// ---------------------------------------------------------------------------
router.post('/dict-review', async (req, res, next) => {
  try {
    const { entry_id, rating, user_id } = req.body;
    // t = when the rating was made (ms). Several devices share one card: an offline rating replayed late must not
    // overwrite a newer rating from another device → stale ones are acknowledged but not applied.
    const at = Number(req.body.t) > 0 ? new Date(Math.min(Number(req.body.t), Date.now())) : new Date();
    if (!entry_id || rating === undefined) {
      return res.status(400).json({ error: 'entry_id and rating required' });
    }
    const ratingNum = Number(rating);
    if (![0, 1, 2, 3].includes(ratingNum)) {
      return res.status(400).json({ error: 'rating must be 0-3' });
    }

    const entry = await DictionaryEntry.findById(entry_id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const lastAt = entry.spaced_review?.last_review_at;
    if (lastAt && at < new Date(lastAt).getTime() - 60_000) return res.json({ ok: true, skipped: 'stale', last_review_at: lastAt });

    const sr      = entry.spaced_review || {};
    let interval  = sr.interval_days || 1;
    let ease      = sr.ease_factor   || 2.5;
    let count     = sr.review_count  || 0;
    const oldEase = ease; // always calculate intervals with OLD ease

    if (ratingNum === 0) {          // Again — reset
      ease     = Math.max(1.3, oldEase - 0.2);
      interval = 1;
    } else if (ratingNum === 1) {   // Hard — advance slowly, ease penalty
      ease     = Math.max(1.3, oldEase - 0.15);
      interval = Math.max(1, Math.ceil(interval * 1.2));
      count++;
    } else if (ratingNum === 3) {   // Easy — big jump, ease bonus
      ease             = Math.min(2.8, oldEase + 0.1);
      const goodDays   = Math.max(1, Math.round(interval * oldEase));
      interval         = Math.max(goodDays + 1, Math.round(interval * oldEase * 1.3));
      count++;
    } else {                        // Good (2) — standard SM-2
      ease     = Math.max(1.3, oldEase + 0.1);
      interval = Math.max(1, Math.round(interval * oldEase));
      count++;
    }

    const next_review = new Date(Date.now() + interval * 86400000);
    await DictionaryEntry.updateOne({ _id: entry._id }, { $set: {
      'spaced_review.interval_days': interval,
      'spaced_review.ease_factor':   parseFloat(ease.toFixed(4)),
      'spaced_review.next_review':   next_review,
      'spaced_review.review_count':  count,
      'spaced_review.last_review_at': at,
    }});

    // Log this review so stats heatmap shows today's activity
    if (user_id) {
      const t = Math.floor(Date.now() / 1000);
      ReviewLog.updateOne(
        { user_id, t },
        { $setOnInsert: { user_id, t, d: entry.source_deck || '', l: entry.language || '' } },
        { upsert: true }
      ).catch(() => {});
    }

    res.json({ ok: true, next_review_at: next_review, interval_days: interval });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/master
// Body: { card_id, source }   source: 'vocab' | 'dict'
// Marks a card as mastered so it never appears as a popup again.
// ---------------------------------------------------------------------------
router.post('/master', async (req, res, next) => {
  try {
    const { card_id, source } = req.body;
    if (!card_id) return res.status(400).json({ error: 'card_id required' });

    const farFuture = new Date('2099-01-01');
    if (source === 'dict') {
      await DictionaryEntry.findByIdAndUpdate(card_id, {
        'spaced_review.next_review':   farFuture,
        'spaced_review.interval_days': 9999,
      });
    } else {
      await Vocab.findByIdAndUpdate(card_id, {
        status:         'mastered',
        next_review_at: farFuture,
      });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/card-batch', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const deckNames = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    if (req.query.card_source === 'vocab') {
      const q = { status: { $nin: ['removed', 'mastered'] } };
      if (user_id) q.user_id = user_id;
      if (lang) q.language = lang;
      if (deckNames?.length) q.deck_name = { $in: deckNames };
      applyTagFilter(q, req.query);
      const cards = await Vocab.find(q).sort({ next_review_at: 1 }).limit(limit).lean();
      return res.json({ cards: cards.map(toVocabCard) });
    }
    const q = {};
    if (lang) q.language = lang;
    if (deckNames?.length) q.source_deck = { $in: deckNames };
    applyTagFilter(q, req.query);
    const entries = await DictionaryEntry.find(q).sort({ 'spaced_review.next_review': 1 }).limit(limit).lean();
    res.json({ cards: entries.map(toDictCard) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/deck-progress?card_source=dict|vocab&user_id=&lang=&decks=
// Per deck: total, seen (reviewed ≥ 1×), mature (interval ≥ 21 days), due, and the 14-day pace
// (distinct cards touched per day, from reviewlogs) → estimated date to have seen every card.
// ---------------------------------------------------------------------------
router.get('/deck-progress', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const deckNames = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    const now = new Date();
    let rows;
    if (req.query.card_source === 'vocab') {
      const m = { status: { $ne: 'removed' } };
      if (user_id) m.user_id = user_id;
      if (lang) m.language = lang;
      if (deckNames?.length) m.deck_name = { $in: deckNames };
      rows = await Vocab.aggregate([
        { $match: m },
        { $group: {
          _id: { deck: '$deck_name', lang: '$language' },
          total:  { $sum: 1 },
          seen:   { $sum: { $cond: [{ $ifNull: ['$last_review_at', false] }, 1, 0] } },
          mature: { $sum: { $cond: [{ $or: [{ $gte: ['$interval_days', 21] }, { $eq: ['$status', 'mastered'] }] }, 1, 0] } },
          due:    { $sum: { $cond: [{ $and: [{ $lte: ['$next_review_at', now] }, { $ne: ['$status', 'mastered'] }] }, 1, 0] } },
        } },
      ]);
    } else {
      const m = { source_deck: { $exists: true, $ne: null } };
      if (lang) m.language = lang;
      if (deckNames?.length) m.source_deck = { $in: deckNames };
      rows = await DictionaryEntry.aggregate([
        { $match: m },
        { $group: {
          _id: { deck: '$source_deck', lang: '$language' },
          total:  { $sum: 1 },
          seen:   { $sum: { $cond: [{ $gt: [{ $ifNull: ['$spaced_review.review_count', 0] }, 0] }, 1, 0] } },
          mature: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$spaced_review.interval_days', 0] }, 21] }, 1, 0] } },
          due:    { $sum: { $cond: [{ $or: [
            { $eq: [{ $ifNull: ['$spaced_review.next_review', null] }, null] },
            { $lte: ['$spaced_review.next_review', now] },
          ] }, 1, 0] } },
        } },
      ]);
    }

    // 14-day pace per deck from the card-show log (same deck names as source_deck / deck_name)
    const since = Math.floor(Date.now() / 1000) - 14 * 86400;
    const logMatch = { t: { $gte: since } };
    if (user_id) logMatch.user_id = user_id;
    const pace = await ReviewLog.aggregate([
      { $match: logMatch },
      { $group: { _id: '$d', cards: { $addToSet: '$ci' }, shows: { $sum: 1 } } },
      { $project: { cards: { $size: '$cards' }, shows: 1 } },
    ]);
    const paceMap = Object.fromEntries(pace.map(p => [p._id || '', p]));

    const decks = rows.map(r => {
      const deck = r._id.deck || '(không tên)';
      const p = paceMap[deck];
      const perDay = p ? p.cards / 14 : 0;
      const unseen = Math.max(0, r.total - r.seen);
      const daysLeft = perDay > 0 ? Math.ceil(unseen / perDay) : null;
      return {
        deck, language: r._id.lang, total: r.total, seen: r.seen, mature: r.mature, due: r.due,
        per_day: Math.round(perDay * 10) / 10,
        shows_14d: p ? p.shows : 0,
        days_left: daysLeft,
        finish_date: daysLeft !== null ? new Date(Date.now() + daysLeft * 86400000).toISOString().slice(0, 10) : null,
      };
    }).sort((a, b) => b.total - a.total);
    res.json({ decks });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/listen-log  { events: [{ card_id, source, t, rating }] }   (app sends batches, offline-first)
// Passive-listening schedule, separate from the Anki SRS (listen.stage → listen.next_at):
//   heard (rating null / ≥2) on a NEW day → stage+1, next listen after LISTEN_DAYS[stage] days (1, 3, 7, 16, 35, 60)
//   heard again the same day (< 12 h)     → stage unchanged (replaying in one session doesn't "learn" it)
//   Khó / Không nhớ (rating 0/1)           → stage 1, back tomorrow
// Events are applied in time order (ordered bulk) so an offline batch replays like it happened.
// ---------------------------------------------------------------------------
router.post('/listen-log', async (req, res, next) => {
  try {
    const LISTEN_DAYS = [1, 1, 3, 7, 16, 35, 60];
    const DAY = 86400000;
    const events = (Array.isArray(req.body?.events) ? req.body.events.slice(0, 2000) : [])
      .filter(e => e && /^[a-f0-9]{24}$/i.test(String(e.card_id)))
      .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
    const ops = { dict: [], vocab: [] };
    for (const e of events) {
      const at = new Date(Number(e.t) || Date.now());
      const hard = e.rating === 0 || e.rating === 1;
      const same = { $and: [{ $ne: [{ $ifNull: ['$listen.last_at', null] }, null] }, { $lt: [{ $subtract: [at, '$listen.last_at'] }, DAY / 2] }] };
      const stage = hard ? 1 : { $cond: [same, { $max: [1, { $ifNull: ['$listen.stage', 1] }] }, { $min: [6, { $add: [{ $ifNull: ['$listen.stage', 0] }, 1] }] }] };
      const update = [
        { $set: {
          'listen.count': { $add: [{ $ifNull: ['$listen.count', 0] }, 1] },
          'listen.hard': { $add: [{ $ifNull: ['$listen.hard', 0] }, hard ? 1 : 0] },
          'listen.hard_at': hard ? { $max: [at, { $ifNull: ['$listen.hard_at', at] }] } : '$listen.hard_at',
          'listen.stage': stage,
          'listen._same': hard ? false : same,
          'listen.last_at': { $max: [at, { $ifNull: ['$listen.last_at', at] }] },
        } },
        { $set: {
          'listen.next_at': hard ? new Date(at.getTime() + DAY) : { $cond: [
            '$listen._same',
            { $ifNull: ['$listen.next_at', new Date(at.getTime() + DAY)] },
            { $add: [at, { $multiply: [{ $arrayElemAt: [LISTEN_DAYS, '$listen.stage'] }, DAY] }] },
          ] },
        } },
        { $unset: 'listen._same' },
      ];
      (e.source === 'vocab' ? ops.vocab : ops.dict).push({ updateOne: { filter: { _id: e.card_id }, update } });
    }
    const [d, v] = await Promise.all([
      ops.dict.length ? DictionaryEntry.bulkWrite(ops.dict, { ordered: true }) : null,
      ops.vocab.length ? Vocab.bulkWrite(ops.vocab, { ordered: true }) : null,
    ]);
    res.json({ ok: true, saved: (d?.modifiedCount || 0) + (v?.modifiedCount || 0), received: events.length });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/listen-queue?card_source=dict|vocab&user_id=&decks=&lang=&limit=100&exclude=&mix=2
// Order for passive listening / offline packs — never "all of yesterday's 100 words before anything new":
//   1. Khó/Quên in the last 3 days, not heard in the last 2 h           (≤ 20% of the queue)
//   2. then interleaved, `mix` reviews : 1 new  (mix 1–4, default 2)
//        review = listen.next_at reached (oldest first); cards heard before the schedule existed count as due a day later
//        new    = never heard: Anki-due first (today's SRS cards), then the rest of the decks
//      when one side runs out the other fills the queue. Nothing heard in the last 6 h is replayed (except 1.).
//   3. still short → the cards heard longest ago (so passive listening never stops on a small selection)
// ---------------------------------------------------------------------------
router.get('/listen-queue', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const mix = Math.min(Math.max(Number(req.query.mix) || 2, 1), 4);
    const decks = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    const exclude = (req.query.exclude || '').split(',').filter(id => /^[a-f0-9]{24}$/i.test(id));
    const now = new Date();
    const ago = (h) => new Date(now.getTime() - h * 3600000);
    const vocab = req.query.card_source === 'vocab';
    const Model = vocab ? Vocab : DictionaryEntry;

    const base = {};
    if (exclude.length) base._id = { $nin: exclude };
    if (lang) base.language = lang;
    if (vocab) {
      base.status = { $nin: ['removed', 'mastered'] };
      if (user_id) base.user_id = user_id;
      if (decks?.length) base.deck_name = { $in: decks };
    } else if (decks?.length) base.source_deck = { $in: decks };
    // "Đã thuộc" (POST /master → interval 9999) never comes back in passive listening
    if (!vocab) base.$and = [...(base.$and || []), { 'spaced_review.interval_days': { $not: { $gte: 9999 } } }];
    applyTagFilter(base, req.query);

    const unheard = { $or: [{ 'listen.count': { $exists: false } }, { 'listen.count': 0 }] };
    const ankiDue = vocab
      ? { next_review_at: { $lte: now } }
      : { $or: [{ 'spaced_review.next_review': null }, { 'spaced_review.next_review': { $lte: now } }] };
    const ankiSort = vocab ? { next_review_at: 1 } : { 'spaced_review.next_review': 1 };
    const and = (...c) => ({ ...base, $and: [...(base.$and || []), ...c] });

    const hard = await Model.find(and({ 'listen.hard_at': { $gte: ago(72) } }, { 'listen.last_at': { $lt: ago(2) } }))
      .sort({ 'listen.hard_at': -1 }).limit(Math.ceil(limit * 0.2)).lean();
    const reviews = await Model.find(and(
      { 'listen.last_at': { $lt: ago(6) } },
      { $or: [{ 'listen.next_at': { $lte: now } }, { 'listen.next_at': { $exists: false }, 'listen.count': { $gte: 1 }, 'listen.last_at': { $lte: ago(24) } }] },
    )).sort({ 'listen.next_at': 1, 'listen.last_at': 1 }).limit(limit).lean();
    const fresh = await Model.find(and(unheard, ankiDue)).sort(ankiSort).limit(limit).lean();
    if (fresh.length < limit) {
      const ids = fresh.map(c => c._id);
      fresh.push(...await Model.find(and(unheard, { _id: { $nin: [...ids, ...exclude] } })).limit(limit - fresh.length).lean());
    }

    const picked = [];
    const seen = new Set();
    const take = (c) => { const id = String(c._id); if (c && !seen.has(id) && picked.length < limit) { seen.add(id); picked.push(c); return true; } return false; };
    hard.forEach(take);
    let r = 0, n = 0;
    while (picked.length < limit && (r < reviews.length || n < fresh.length)) {
      for (let k = 0; k < mix && r < reviews.length && picked.length < limit; k++) take(reviews[r++]);
      if (n < fresh.length) take(fresh[n++]);
      else while (r < reviews.length && picked.length < limit) take(reviews[r++]);
      if (r >= reviews.length) while (n < fresh.length && picked.length < limit) take(fresh[n++]);
    }
    // Never run dry (small decks, everything heard today, long walks): fill with the cards heard longest ago
    if (picked.length < limit) {
      const more = await Model.find(and({ _id: { $nin: [...picked.map(c => c._id), ...exclude] } }))
        .sort({ 'listen.last_at': 1 }).limit(limit - picked.length).lean();
      more.forEach(take);
    }
    res.json({ cards: picked.map(c => (vocab ? toVocabCard(c) : toDictCard(c))) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/listen-week?card_source=dict|vocab&user_id=&decks=&lang=
// "Tuần này đã nghe được gì" (Stats tab):
//   heard    distinct cards heard in the last 7 days, plays = their total listen count, by language
//   improved cards marked Khó/Quên in the last 14 days and since heard OK on a later day (stage ≥ 2, last_at > hard_at)
//   examples up to 5 short example sentences from cards heard this week (improved / hard ones first) to replay
// ---------------------------------------------------------------------------
router.get('/listen-week', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const decks = req.query.decks ? req.query.decks.split(',').map(d => d.trim()).filter(Boolean) : null;
    const vocab = req.query.card_source === 'vocab';
    const Model = vocab ? Vocab : DictionaryEntry;
    const since = new Date(Date.now() - 7 * 86400000);
    const base = { 'listen.last_at': { $gte: since } };
    if (lang) base.language = lang;
    if (vocab) { if (user_id) base.user_id = user_id; if (decks?.length) base.deck_name = { $in: decks }; }
    else if (decks?.length) base.source_deck = { $in: decks };

    const [byLang] = await Promise.all([
      Model.aggregate([{ $match: base }, { $group: { _id: '$language', heard: { $sum: 1 }, plays: { $sum: '$listen.count' } } }]),
    ]);
    const improved = await Model.find({
      ...base, 'listen.hard_at': { $gte: new Date(Date.now() - 14 * 86400000) }, 'listen.stage': { $gte: 2 },
      $expr: { $gt: ['$listen.last_at', '$listen.hard_at'] },
    }).sort({ 'listen.last_at': -1 }).limit(30).lean();

    const exRe = vocab ? null : /\[ex_(ko|ja|zh|en):/;
    const pool = await Model.find({ ...base, ...(exRe ? { tts_back: exRe } : { ai_back: /\[ex_(ko|ja|zh|en):/ }) })
      .sort({ 'listen.hard': -1, 'listen.last_at': -1 }).limit(60).lean();
    const improvedIds = new Set(improved.map(c => String(c._id)));
    const examples = [];
    for (const c of [...pool].sort((a, b) => improvedIds.has(String(b._id)) - improvedIds.has(String(a._id)))) {
      const src = (vocab ? c.ai_back : c.tts_back) || '';
      const ex = src.match(/\[ex_(ko|ja|zh|en):\s*([^\]]+)\]/);
      if (!ex || [...ex[2]].length > 40) continue;
      const vn = src.match(/\[ex_(?:vn|vi):\s*([^\]]+)\]/);
      examples.push({ card_id: String(c._id), word: c.word || c.ai_front || c.front, language: c.language, sentence: ex[2].trim(), translation: vn ? vn[1].trim() : '' });
      if (examples.length >= 5) break;
    }

    res.json({
      heard: byLang.reduce((n, x) => n + x.heard, 0),
      plays: byLang.reduce((n, x) => n + (x.plays || 0), 0),
      by_lang: byLang.map(x => ({ language: x._id, heard: x.heard, plays: x.plays || 0 })),
      improved: improved.map(c => ({ card_id: String(c._id), word: c.word || c.ai_front || c.front, language: c.language, hard: c.listen?.hard || 0 })),
      examples,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET  /api/learntools/app-state?profile=default   → { state, updated_at }   (iOS app: settings / playlists backup)
// POST /api/learntools/app-state { profile, state } → { ok, updated_at }
// Reinstalling or deleting the app wipes its local storage; the app restores from here on a fresh install.
// Stored as one document per profile in collection `appstates` (no model — opaque JSON, ≤ 1 MB body).
// ---------------------------------------------------------------------------
router.get('/app-state', async (req, res, next) => {
  try {
    const profile = String(req.query.profile || 'default').slice(0, 64);
    const doc = await DictionaryEntry.db.collection('appstates').findOne({ _id: profile });
    res.json(doc ? { state: doc.state, updated_at: doc.updated_at } : { state: null });
  } catch (err) { next(err); }
});

router.post('/app-state', async (req, res, next) => {
  try {
    const profile = String(req.body?.profile || 'default').slice(0, 64);
    const state = req.body?.state;
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'state required' });
    const updated_at = new Date();
    await DictionaryEntry.db.collection('appstates').updateOne({ _id: profile }, { $set: { state, updated_at } }, { upsert: true });
    res.json({ ok: true, updated_at });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/add-vocab
// Body: { user_id, front, back?, deck_name, language }
// Creates a new vocab card (from right-click Add Card feature).
// ---------------------------------------------------------------------------
router.post('/add-vocab', async (req, res, next) => {
  try {
    const { user_id, front, back, deck_name, language } = req.body;
    if (!front || !deck_name || !language) {
      return res.status(400).json({ error: 'front, deck_name, language required' });
    }
    const vocab = await Vocab.create({
      user_id:      user_id || 'default',
      front,
      back:         back || '',
      deck_name,
      language,
      status:       'active',
      interval_days: 1,
      ease_factor:  2.5,
      next_review_at: new Date(),
      source:       'manual',
    });
    res.json({ ok: true, card_id: vocab._id });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/stats?user_id=&lang=
// Quick stats. user_id omitted → counts across all users.
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const { user_id, lang } = req.query;
    const decks = req.query['deck[]']
      ? (Array.isArray(req.query['deck[]']) ? req.query['deck[]'] : [req.query['deck[]']])
      : [];
    const now = new Date();

    const baseAll = { status: { $nin: ['removed'] } };
    if (user_id) baseAll.user_id = user_id;
    if (lang)    baseAll.language = lang;

    const dueAll = { status: { $nin: ['removed', 'mastered'] }, next_review_at: { $lte: now } };
    if (user_id) dueAll.user_id  = user_id;
    if (lang)    dueAll.language = lang;

    const baseSel = { ...baseAll };
    const dueSel  = { ...dueAll };
    if (decks.length) { baseSel.deck_name = { $in: decks }; dueSel.deck_name = { $in: decks }; }

    const [dueAllCount, totalAllCount, dueSelCount, totalSelCount] = await Promise.all([
      Vocab.countDocuments(dueAll),
      Vocab.countDocuments(baseAll),
      decks.length ? Vocab.countDocuments(dueSel)  : null,
      decks.length ? Vocab.countDocuments(baseSel) : null,
    ]);

    res.json({
      due_all:      dueAllCount,
      total_all:    totalAllCount,
      due_selected:   dueSelCount   ?? dueAllCount,
      total_selected: totalSelCount ?? totalAllCount,
      has_selection: decks.length > 0,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/review-log
// Body: { user_id, events: [{t, d, l}] }
// Batch-saves card-show events. Idempotent (upsert by user_id+t).
// ---------------------------------------------------------------------------
router.post('/review-log', async (req, res, next) => {
  try {
    const { user_id, events } = req.body;
    if (!user_id || !Array.isArray(events) || !events.length) {
      return res.json({ ok: true, saved: 0 });
    }
    const ops = events
      .filter(e => e && typeof e.t === 'number')
      .map(e => ({
        updateOne: {
          filter: { user_id, t: e.t },
          update: { $setOnInsert: { user_id, t: e.t, d: e.d || '', l: e.l || '', ci: e.ci || '' } },
          upsert: true,
        },
      }));
    if (!ops.length) return res.json({ ok: true, saved: 0 });
    const r = await ReviewLog.bulkWrite(ops, { ordered: false });
    res.json({ ok: true, saved: r.upsertedCount });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/review-log?user_id=&since=
// Returns review events for the last 90 days (or since unix timestamp).
// ---------------------------------------------------------------------------
router.get('/review-log', async (req, res, next) => {
  try {
    const { user_id, since } = req.query;
    if (!user_id) return res.json({ events: [] });
    const sinceTs = since ? Number(since) : Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
    // Sort DESC so the 10K limit keeps the NEWEST events, not the oldest.
    const events = await ReviewLog.find({ user_id, t: { $gte: sinceTs } })
      .sort({ t: -1 })
      .limit(10000)
      .select('t d l -_id')
      .lean();
    events.reverse(); // return chronological order to the client
    res.json({ events });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/review-days?user_id=&days=365&tz_offset=420
// Returns per-day review counts via aggregation — no event-count limit.
// tz_offset = client's minutes ahead of UTC (e.g. Vietnam = 420).
// Used by stats page for streak + heatmap so 10K raw-event cap can't truncate.
// ---------------------------------------------------------------------------
router.get('/review-days', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.json({ byDay: {} });
    const days     = Math.min(Number(req.query.days)      || 365, 730);
    const tzOffset = Number(req.query.tz_offset) || 0; // minutes ahead of UTC
    const cutoff   = Math.floor(Date.now() / 1000) - days * 24 * 3600;

    const agg = await ReviewLog.aggregate([
      { $match: { user_id, t: { $gte: cutoff } } },
      { $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $toDate: { $multiply: [{ $add: ['$t', tzOffset * 60] }, 1000] } },
          },
        },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    const byDay = {};
    for (const e of agg) byDay[e._id] = e.count;
    res.json({ byDay });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/shown-today?user_id=&tz_offset=420
// Returns card IDs shown to this user today (across all devices).
// tz_offset = client's minutes ahead of UTC (e.g. Vietnam = 420).
// Used by each device to build a combined exclude list before fetching a card.
// ---------------------------------------------------------------------------
router.get('/shown-today', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.json({ card_ids: [] });

    const tzOffset = Number(req.query.tz_offset) || 0; // minutes ahead of UTC
    // Calculate start-of-today in the user's local timezone as a UTC unix timestamp
    const nowMs        = Date.now();
    const tzOffsetMs   = tzOffset * 60 * 1000;
    const nowInUserTz  = nowMs + tzOffsetMs;
    const d            = new Date(nowInUserTz);
    d.setUTCHours(0, 0, 0, 0);               // midnight in user's tz (stored as UTC)
    const todayStartTs = Math.floor((d.getTime() - tzOffsetMs) / 1000); // back to UTC seconds

    const events = await ReviewLog.find({
      user_id,
      t:  { $gte: todayStartTs },
      ci: { $exists: true, $nin: ['', null] },
    }).select('ci -_id').lean();

    const card_ids = [...new Set(events.map(e => e.ci))];
    res.json({ card_ids });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/forecast?user_id=&days=90&decks=
// Returns per-day due-card counts for the next N days.
// Response: { forecast: [{ date: "YYYY-MM-DD", count: N }, ...] }
// ---------------------------------------------------------------------------
router.get('/forecast', async (req, res, next) => {
  try {
    const { user_id, days = 90 } = req.query;
    const daysNum = Math.min(Number(days) || 90, 365);
    const now = new Date();
    const end = new Date(now.getTime() + daysNum * 24 * 3600 * 1000);

    const deckParam = req.query.decks;
    const deckList  = deckParam ? deckParam.split(',').map(d => d.trim()).filter(Boolean) : null;

    // ── Vocab cards ──────────────────────────────────────────────────────────
    const vocabMatch = {
      status:         { $nin: ['removed', 'mastered'] },
      next_review_at: { $gte: now, $lte: end },
    };
    if (user_id)             vocabMatch.user_id   = user_id;
    if (deckList?.length)    vocabMatch.deck_name = { $in: deckList };

    const vocabAgg = await Vocab.aggregate([
      { $match: vocabMatch },
      { $group: {
        _id:   { $dateToString: { format: '%Y-%m-%d', date: '$next_review_at' } },
        count: { $sum: 1 },
      }},
    ]);

    // ── Dict cards (spaced_review.next_review, shared — no user_id) ─────────
    const dictMatch = {
      'spaced_review.next_review': { $gte: now, $lte: end },
    };
    if (deckList?.length) dictMatch.source_deck = { $in: deckList };

    const dictAgg = await DictionaryEntry.aggregate([
      { $match: dictMatch },
      { $group: {
        _id:   { $dateToString: { format: '%Y-%m-%d', date: '$spaced_review.next_review' } },
        count: { $sum: 1 },
      }},
    ]);

    // ── Merge both into a single date map ────────────────────────────────────
    const dateMap = {};
    for (const d of vocabAgg) dateMap[d._id] = (dateMap[d._id] || 0) + d.count;
    for (const d of dictAgg)  dateMap[d._id] = (dateMap[d._id] || 0) + d.count;

    const forecast = Object.entries(dateMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ forecast });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/bookmarks?user_id=&lang=&limit=50
// Returns user's bookmarked cards, newest first.
// ---------------------------------------------------------------------------
router.get('/bookmarks', async (req, res, next) => {
  try {
    const { user_id, lang, limit = 50 } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const query = { user_id };
    if (lang) query.language = lang;
    const docs = await BookmarkedCard
      .find(query)
      .sort({ created_at: -1 })
      .limit(Number(limit));
    res.json(docs);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/bookmark
// Body: { user_id, card_id, source, language, word, deck_name, front, back, ai_back }
// Saves a card to the user's bookmarks (idempotent by user_id+source_id).
// ---------------------------------------------------------------------------
router.post('/bookmark', async (req, res, next) => {
  try {
    const { user_id, card_id, source, language, word, deck_name, front, ai_front, back, ai_back } = req.body;
    if (!user_id || !word) return res.status(400).json({ error: 'user_id and word required' });

    await BookmarkedCard.findOneAndUpdate(
      { user_id, source_id: String(card_id) },
      { user_id, source_id: String(card_id), language: language || 'en', word,
        source: source || 'vocab', deck_name: deck_name || '',
        front: front || '', ai_front: ai_front || '',
        back: back || '', ai_back: ai_back || '' },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// DELETE /api/learntools/bookmarks/:id?user_id=
// Removes a bookmarked card by its MongoDB _id.
// ---------------------------------------------------------------------------
router.delete('/bookmarks/:id', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    await BookmarkedCard.deleteOne({ _id: req.params.id, user_id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/quiz/start
// Body: { user_id?, decks?, lang?, count=10 }
// Returns { session_id, questions[] } — questions without answer_index
// ---------------------------------------------------------------------------
router.post('/quiz/start', async (req, res, next) => {
  try {
    const { user_id, lang } = req.body;
    const count = Math.min(Number(req.body.count) || 10, 30);
    const decks = req.body.decks
      ? req.body.decks.split(',').map(d => d.trim()).filter(Boolean)
      : null;

    const questions = await buildQuizQuestions({ user_id, decks, lang, count });
    if (!questions.length) {
      return res.status(404).json({ error: 'No enhanced cards found. Please run AI enhancement first.' });
    }

    const session_id = createSession(questions);

    // Strip answer_index before sending to client (security)
    const safeQuestions = questions.map(q => ({
      type:       q.type,
      question:   q.question,
      hint:       q.hint,
      choices:    q.choices,
      word:       q.word,
      lang:       q.lang,
      deck_name:  q.deck_name,
    }));

    res.json({ session_id, questions: safeQuestions, total: safeQuestions.length });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/quiz/:sessionId/answer
// Body: { question_index, selected_index }
// Returns { correct, correct_answer_index, explanation, word, lang }
// ---------------------------------------------------------------------------
router.post('/quiz/:sessionId/answer', (req, res) => {
  const { question_index, selected_index } = req.body;
  const result = checkAnswer(req.params.sessionId, Number(question_index), Number(selected_index));
  if (!result) return res.status(404).json({ error: 'Session not found or question index invalid' });
  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /api/learntools/quiz/:sessionId/end
// Returns { score, grade, correct, wrong, total, duration_seconds }
// ---------------------------------------------------------------------------
router.post('/quiz/:sessionId/end', (req, res) => {
  const summary = endSession(req.params.sessionId);
  if (!summary) return res.status(404).json({ error: 'Session not found' });
  res.json({ summary });
});

// ---------------------------------------------------------------------------
// GET /api/learntools/quiz/session/:sessionId
// Returns current session state (progress check / resume)
// ---------------------------------------------------------------------------
router.get('/quiz/session/:sessionId', (req, res) => {
  const sess = getSession(req.params.sessionId);
  if (!sess) return res.status(404).json({ error: 'Session not found' });
  res.json({
    total:    sess.questions.length,
    answered: sess.answers.filter(Boolean).length,
  });
});

/* ── GET /api/learntools/weak-drill ── */
router.get('/weak-drill', async (req, res, next) => {
  try {
    const { user_id, lang, limit = 10 } = req.query;
    const q = { status: { $nin: ['removed', 'mastered'] } };
    if (user_id) q.user_id = user_id;
    if (lang)    q.language = lang;

    const cards = await Vocab.find(q)
      .sort({ ease_factor: 1, interval_days: 1 })
      .limit(Number(limit))
      .select('_id front back ai_back language deck_name ease_factor interval_days next_review_at')
      .lean();

    res.json({ ok: true, cards, count: cards.length });
  } catch (err) { next(err); }
});

/* ── GET /api/learntools/milestones ── */
router.get('/milestones', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    const LEVELS = [500, 1000, 2000, 3000, 5000];
    const q = { status: 'mastered' };
    if (user_id) q.user_id = user_id;

    const agg = await Vocab.aggregate([
      { $match: q },
      { $group: { _id: '$language', count: { $sum: 1 } } },
    ]);

    const langs = agg.map(({ _id: lang, count }) => ({
      lang,
      count,
      reached:        LEVELS.filter(m => count >= m),
      next_milestone: LEVELS.find(m => count < m) ?? null,
    }));

    res.json({ ok: true, langs, milestones: LEVELS });
  } catch (err) { next(err); }
});

/* ── GET /api/learntools/streak ── */
router.get('/streak', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    const tzOffsetMin = parseInt(req.query.tz_offset || 0); // e.g. +420 for GMT+7

    const ninetyDaysAgoTs = Math.floor((Date.now() - 90 * 86400000) / 1000);
    const q = { t: { $gte: ninetyDaysAgoTs } };
    if (user_id) q.user_id = user_id;

    const logs = await ReviewLog.find(q).select('t').lean();

    const toLocalDate = (tSec) =>
      new Date(tSec * 1000 + tzOffsetMin * 60000).toISOString().slice(0, 10);

    const dateMap = {};
    logs.forEach(({ t }) => { const d = toLocalDate(t); dateMap[d] = (dateMap[d] || 0) + 1; });

    // Current streak (start from today; if today empty, start from yesterday)
    const nowLocal  = new Date(Date.now() + tzOffsetMin * 60000);
    const todayStr  = nowLocal.toISOString().slice(0, 10);
    const getStr    = (d) => d.toISOString().slice(0, 10);

    const cursor = new Date(nowLocal);
    if (!dateMap[todayStr]) cursor.setDate(cursor.getDate() - 1); // grace: today not yet reviewed

    let current_streak = 0;
    while (dateMap[getStr(cursor)]) {
      current_streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Last 60 days for heatmap
    const days = [];
    for (let i = 59; i >= 0; i--) {
      const d = new Date(nowLocal);
      d.setDate(d.getDate() - i);
      const key = getStr(d);
      days.push({ date: key, count: dateMap[key] || 0 });
    }

    res.json({ ok: true, current_streak, days });
  } catch (err) { next(err); }
});

router.get('/dict-search', async (req, res, next) => {
  try {
    const { q, lang, user_id } = req.query;
    const limit = Math.min(Number(req.query.limit || 8), 20);
    if (!q || q.trim().length < 1) return res.json({ ok: true, results: [] });

    const regex  = new RegExp(escapeRegex(q.trim()), 'i');
    const filter = { $or: [{ word: regex }, { translation_vi: regex }, { reading: regex }] };
    if (lang) filter.language = lang;

    const entries = await DictionaryEntry.find(filter)
      .limit(limit)
      .select('word language level reading part_of_speech translation_vi ai_back')
      .lean();

    let ownedSet = new Set();
    if (user_id && entries.length) {
      const fronts = entries.map(e => e.word);
      const owned  = await Vocab.find({ user_id, front: { $in: fronts } }, 'front').lean();
      ownedSet = new Set(owned.map(v => v.front));
    }

    res.json({ ok: true, results: entries.map(e => ({ ...e, in_deck: ownedSet.has(e.word) })) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/leeches?user_id=&lang=&threshold=6
// Cards that have been rated "Again" (rating=0) >= threshold times in lifetime.
// ---------------------------------------------------------------------------
router.get('/leeches', async (req, res, next) => {
  try {
    const { user_id, lang, threshold = 6 } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const thresh = Math.max(1, Number(threshold));

    const aggMatch = { user_id, rating: 0 };
    if (lang) aggMatch.language = lang;

    const leechVocabIds = await AnkiReview.aggregate([
      { $match: aggMatch },
      { $group: { _id: '$vocab_id', count: { $sum: 1 } } },
      { $match: { count: { $gte: thresh } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    if (!leechVocabIds.length) return res.json({ leeches: [], count: 0 });

    const ids = leechVocabIds.map(l => l._id);
    const countMap = Object.fromEntries(leechVocabIds.map(l => [String(l._id), l.count]));

    const cards = await Vocab.find({ _id: { $in: ids } })
      .select('front back language deck_name ease_factor interval_days status')
      .lean();

    const leeches = cards.map(c => ({ ...c, again_count: countMap[String(c._id)] || 0 }))
      .sort((a, b) => b.again_count - a.again_count);

    res.json({ leeches, count: leeches.length });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/learntools/suspend
// Body: { card_id }  — moves a leech card to 'removed' status.
// ---------------------------------------------------------------------------
router.post('/suspend', async (req, res, next) => {
  try {
    const { card_id } = req.body;
    if (!card_id) return res.status(400).json({ error: 'card_id required' });

    const result = await Vocab.findByIdAndUpdate(card_id, {
      status: 'removed', updated_at: new Date(),
    });
    if (!result) return res.status(404).json({ error: 'Card not found' });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/learntools/related-words?card_id=&user_id=&limit=3  (Feature 25)
// Returns top N vocab cards semantically related to the given card.
// ---------------------------------------------------------------------------
router.get('/related-words', async (req, res, next) => {
  try {
    const { card_id, user_id, limit = 3 } = req.query;
    if (!card_id) return res.json({ words: [] });

    const card = await Vocab.findById(card_id).select('front ai_front ai_back back language deck_name').lean();
    if (!card) return res.json({ words: [] });

    const keywords = extractKeywords((card.ai_back || '') + ' ' + (card.back || ''));
    if (!keywords.length) return res.json({ words: [] });

    const q = {
      _id: { $ne: card._id },
      language: card.language,
      status: { $nin: ['removed', 'mastered'] },
    };
    if (user_id)       q.user_id   = user_id;
    if (card.deck_name) q.deck_name = card.deck_name;

    const pool = await Vocab.find(q).select('_id front ai_front ai_back back').limit(60).lean();
    pool.sort((a, b) =>
      overlapScore((b.ai_back || '') + (b.back || ''), keywords) -
      overlapScore((a.ai_back || '') + (a.back || ''), keywords)
    );

    const words = pool.slice(0, Number(limit))
      .filter(c => overlapScore((c.ai_back || '') + (c.back || ''), keywords) > 0)
      .map(c => ({ _id: c._id, front: (c.ai_front || c.front || '').replace(/\[sound:[^\]]+\]/gi, '').trim().slice(0, 25) }));

    res.json({ words });
  } catch (err) { next(err); }
});

// ── User Stats (XP + Immersion) — multi-device sync ──────────────────────────
// GET /user-stats?user_id=  → { xp_total, immersion_today }
router.get('/user-stats', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const doc = await UserStats.findOne({ user_id }).lean();
    const todayKey = new Date().toLocaleDateString('en-CA');
    const immersion_today = doc?.immersion?.find(d => d.date === todayKey) || null;
    res.json({ xp_total: doc?.xp_total || 0, immersion_today });
  } catch (err) { next(err); }
});

// POST /user-stats/xp  { user_id, add }  → { xp_total }
router.post('/user-stats/xp', async (req, res, next) => {
  try {
    const { user_id, add } = req.body;
    if (!user_id || typeof add !== 'number' || add <= 0) return res.status(400).json({ error: 'user_id + positive add required' });
    const doc = await UserStats.findOneAndUpdate(
      { user_id },
      { $inc: { xp_total: add } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ xp_total: doc.xp_total });
  } catch (err) { next(err); }
});

// POST /user-stats/immersion  { user_id, date, field: 'card_sec'|'radio_sec', add }
router.post('/user-stats/immersion', async (req, res, next) => {
  try {
    const { user_id, date, field, add } = req.body;
    if (!user_id || !date || !field || typeof add !== 'number' || add <= 0)
      return res.status(400).json({ error: 'user_id, date, field, add required' });
    if (!['card_sec', 'radio_sec'].includes(field))
      return res.status(400).json({ error: 'field must be card_sec or radio_sec' });

    // Upsert the day entry and increment the field atomically
    const setKey   = `immersion.$[day].${field}`;
    const result = await UserStats.findOneAndUpdate(
      { user_id, 'immersion.date': date },
      { $inc: { [setKey]: add } },
      { arrayFilters: [{ 'day.date': date }], new: true }
    );
    if (!result) {
      // Day entry doesn't exist yet — push new entry
      await UserStats.findOneAndUpdate(
        { user_id },
        { $push: { immersion: { date, card_sec: field === 'card_sec' ? add : 0, radio_sec: field === 'radio_sec' ? add : 0 } } },
        { upsert: true }
      );
    }
    // Trim immersion to last 90 days to avoid unbounded growth
    await UserStats.updateOne({ user_id }, [
      { $set: { immersion: { $slice: ['$immersion', -90] } } }
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

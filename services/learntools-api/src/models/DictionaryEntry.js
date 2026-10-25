const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema({
  sentence:       { type: String },
  translation_vi: { type: String },
  translation_en: { type: String },
  style:          { type: String, default: 'neutral' }, // formal | conversational | question | negative
  audio_url:      { type: String },
}, { _id: false });

const dictionaryEntrySchema = new mongoose.Schema({
  language:       { type: String, required: true, enum: ['en','ko','ja','zh','es','fr','vi'], index: true },
  level:          { type: String, required: true, index: true },  // HSK1-6, N5-N1, TOPIK1-6, A1-C2
  word:           { type: String, required: true },
  reading:        { type: String },   // furigana / romanization / pinyin
  part_of_speech: { type: String },   // noun, verb, adjective, …
  translation_vi: { type: String },
  translation_en: { type: String },
  examples:       [exampleSchema],
  collocations:   [String],           // common phrases/collocations
  memory_tip:     { type: String },   // mnemonic or usage note

  // ── Enriched fields ──────────────────────────────────────────────────────────
  difficulty:     { type: Number, min: 1, max: 10 }, // 1=very easy … 10=very hard
  mindmap: {
    synonyms:     [String],  // same-meaning words
    antonyms:     [String],  // opposite-meaning words
    related:      [String],  // semantically close words
    word_family:  [String],  // derivations: run→runner, running, ran
  },
  spaced_review: {
    interval_days: { type: Number, default: 1 },  // SM-2 initial
    ease_factor:   { type: Number, default: 2.5 },
    next_review:   { type: Date },
    review_count:  { type: Number, default: 0 },
    last_review_at: { type: Date },               // when the latest applied rating was MADE (device time) — stale offline replays are skipped
  },

  audio_url:      { type: String },   // word pronunciation audio (from Anki media)
  image_url:      { type: String },   // word image (from Anki media)

  tags:           [String],
  frequency_rank: { type: Number },
  source_deck:    { type: String },   // original Anki deck name this entry was imported from
  back_field:     { type: String },   // raw value of the "Answer/Back" field chosen at import time
  tts_back:       { type: String },   // kịch bản đọc ngắn (scripts/build-tts-back.js); null = chưa xử lý
  tts_rule_v:     { type: Number },   // phiên bản quy tắc đã sinh tts_back
  tts_source:     { type: String },   // 'ai' khi do ai-fill-tts.js sinh (quy tắc không ghi đè)
  // Bản GỌN để hiển thị (scripts/clean-notes.js) — trường gốc giữ nguyên
  memory_tip_clean:     { type: String },
  translation_en_clean: { type: String },
  examples_extra:       [{ sentence: String, translation_en: String, _id: false }],
  notes_rule_v:         { type: Number },
  // Nghe thụ động (app iOS Player / mọi lần chấm): số lần nghe, số lần Khó/Quên — ưu tiên + lịch nghe lại trong /listen-queue
  listen: {
    count:   { type: Number, default: 0 },
    hard:    { type: Number, default: 0 },
    last_at: { type: Date },
    hard_at: { type: Date },
    stage:   { type: Number },   // listening schedule step (listen-log): 1 → 1 day, 2 → 3, 3 → 7, 4 → 16, 5 → 35, 6 → 60
    next_at: { type: Date },     // when /listen-queue brings it back as a review
  },
  generated_date: { type: String },   // YYYY-MM-DD
  generated_by:   { type: String },   // AI provider: 'z', 'gemini', 'openai', 'groq', 'together', 'ollama', 'anki_import'
  created_at:     { type: Date, default: Date.now },

  // ── AI enhance fields (mirrored from Vocab when anki card is enhanced) ────────
  ai_front:       { type: String },   // clean target-language word/phrase
  ai_back:        { type: String },   // structured tagged content [ko:][vn:][ex_ko:]…
  ai_card_type:   { type: String },   // 'vocab' | 'grammar' | 'phrase'
  ai_enhanced_at: { type: Date },
  ai_model:       { type: String },
  ai_provider:    { type: String },   // which provider did the enhancement
});

// No duplicate words per language
dictionaryEntrySchema.index({ language: 1, word: 1 }, { unique: true });
dictionaryEntrySchema.index({ language: 1, level: 1, created_at: -1 });

module.exports = mongoose.model('DictionaryEntry', dictionaryEntrySchema);

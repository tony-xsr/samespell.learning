const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user_id:   { type: String, required: true },
  language:  { type: String, required: true },   // 'ko', 'ja', 'zh', 'en', …
  word:      { type: String, required: true },    // display word / front
  source_id: { type: String },                    // Vocab._id or DictionaryEntry._id
  source:    { type: String, enum: ['vocab', 'dict'], default: 'vocab' },
  deck_name: { type: String, default: '' },
  front:     { type: String, default: '' },
  ai_front:  { type: String, default: '' },
  back:      { type: String, default: '' },
  ai_back:   { type: String, default: '' },
  created_at:{ type: Date,   default: Date.now },
});

schema.index({ user_id: 1, language: 1, created_at: -1 });
// Prevent duplicate bookmarks for the same card
schema.index({ user_id: 1, source_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('BookmarkedCard', schema);

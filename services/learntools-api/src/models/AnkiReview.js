const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user_id:     { type: String, required: true, index: true },
  vocab_id:    { type: mongoose.Schema.Types.ObjectId },
  language:    { type: String },
  deck_name:   { type: String },
  rating:      { type: Number },   // 0=Again 1=Hard 2=Good 3=Easy
  correct:     { type: Boolean },
  reviewed_at: { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ user_id: 1, reviewed_at: -1 });

module.exports = mongoose.model('AnkiReview', schema);

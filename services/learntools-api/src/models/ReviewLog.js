const mongoose = require('mongoose');

const reviewLogSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  t:       { type: Number, required: true }, // unix timestamp (seconds)
  d:       { type: String, default: '' },    // deck_name
  l:       { type: String, default: '' },    // language
  ci:      { type: String, default: '' },    // card_id — for cross-device deduplication
});

reviewLogSchema.index({ user_id: 1, t: 1 }, { unique: true });
reviewLogSchema.index({ user_id: 1, t: -1 });

module.exports = mongoose.model('ReviewLog', reviewLogSchema);

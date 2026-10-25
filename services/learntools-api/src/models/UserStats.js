const mongoose = require('mongoose');

const immersionDaySchema = new mongoose.Schema({
  date:      { type: String, required: true }, // 'YYYY-MM-DD'
  card_sec:  { type: Number, default: 0 },
  radio_sec: { type: Number, default: 0 },
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
  user_id:  { type: String, required: true, unique: true, index: true },
  xp_total: { type: Number, default: 0 },
  immersion: { type: [immersionDaySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('UserStats', userStatsSchema);

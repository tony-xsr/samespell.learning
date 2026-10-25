/**
 * FILE SINH TỰ ĐỘNG — chỉ hàm recordReview (SM-2) chép từ leanwithAI/backend/src/services/ankiService.js.
 */
const Vocab = require('../models/Vocab');
const AnkiReview = require('../models/AnkiReview');

/**
 * Update SRS stats after a review
 */
// rating: 0=Again, 1=Hard, 2=Good, 3=Easy  (Anki SM-2 style)
async function recordReview(vocabId, correct, rating) {
  const vocab = await Vocab.findById(vocabId);
  if (!vocab) return null;

  const hasRating = rating !== undefined && rating !== null;
  const r        = hasRating ? Number(rating) : (correct ? 2 : 0);
  const oldEase  = vocab.ease_factor; // use OLD ease for all interval calculations

  if (r === 0) {                          // Again — reset to 1 day
    vocab.incorrect_attempts += 1;
    vocab.ease_factor   = Math.max(1.3, oldEase - 0.2);
    vocab.interval_days = 1;
    if (vocab.status === 'mastered') vocab.status = 'active';

  } else if (r === 1) {                   // Hard — advance slowly, ease penalty
    vocab.ease_factor   = Math.max(1.3, oldEase - 0.15);
    vocab.interval_days = Math.max(1, Math.ceil(vocab.interval_days * 1.2));

  } else if (r === 3) {                   // Easy — big jump, ease bonus
    vocab.correct_attempts += 1;
    vocab.ease_factor        = Math.min(2.8, oldEase + 0.1);
    const goodDays           = Math.max(1, Math.round(vocab.interval_days * oldEase));
    vocab.interval_days      = Math.max(goodDays + 1, Math.round(vocab.interval_days * oldEase * 1.3));

  } else {                                // Good (2) — standard SM-2
    vocab.correct_attempts += 1;
    vocab.ease_factor   = Math.max(1.3, oldEase + 0.1);
    vocab.interval_days = Math.max(1, Math.round(vocab.interval_days * oldEase));
  }

  // Status transitions
  if (vocab.status === 'new') vocab.status = 'active';
  if (vocab.interval_days >= 21 && r >= 2) vocab.status = 'mastered';

  vocab.last_review_at = new Date();
  vocab.next_review_at = new Date(Date.now() + vocab.interval_days * 24 * 60 * 60 * 1000);
  vocab.updated_at     = new Date();
  await vocab.save();

  // Log review for analytics
  try {
    await AnkiReview.create({
      user_id:   vocab.user_id,
      vocab_id:  vocab._id,
      language:  vocab.language,
      deck_name: vocab.deck_name,
      rating:    r,
      correct:   r >= 2,
    });
  } catch (e) { console.error('[AnkiReview log]', e.message); }

  return vocab;
}

module.exports = { recordReview };

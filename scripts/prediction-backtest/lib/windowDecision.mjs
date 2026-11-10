/**
 * Backtest window chosen for #1002.
 *
 * Production publish stays on the #721 window (1 year, merge cap 120).
 * This module does not change those constants.
 */

/** Trailing years of completed shows. Not the full catalog. */
export const BACKTEST_WINDOW_YEARS = 3;

/**
 * Hard cap on cached shows, most recent first in the runner.
 * A dense future stretch must not grow this into the full catalog.
 */
export const BACKTEST_SHOW_CAP = 180;

/** Priors required before a night is scored. Fills most of the 50-show rate. */
export const BACKTEST_MIN_TRAIN = 40;

/** Live artifact: functions/pickRecommendationsHistory.js */
export const PRODUCTION_HISTORY_YEARS = 1;
export const PRODUCTION_MERGED_LIMIT = 120;

/**
 * Older production cap from #721, kept as a comparison slice.
 * The live merge limit is PRODUCTION_MERGED_LIMIT.
 */
export const LEGACY_HISTORY_LIMIT = 80;

/** Scorecard / Make Picks floor for a title missing from playProbBySong. */
export const UNSEEN_PLAY_PROB_FLOOR = 0.01;

/** High-odds cut used in the player comparison. Matches the long-shot playProb gate. */
export const HIGH_ODDS_MIN = 0.4;

/** Safe-band cut from MODEL_WEIGHTS.safePlayProbMin. Reported, not retuned. */
export const SAFE_ODDS_MIN = 0.55;

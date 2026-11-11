/**
 * Rolling-origin backtest loop (#648 / #649).
 */
import { priorShows } from "./features.mjs";
import { runBaseline } from "./baselines.mjs";
import {
  rankCombinedPlayOnly,
  rankCombinedForSlot,
  MODEL_VERSION,
} from "./model.mjs";
import {
  playedSongRecallAtK,
  exactSlotHitAtK,
  rankBrierScore,
  simulatedPickCardOutcome,
  top3Concentration,
  aggregateNights,
  crossSlotOverlap,
} from "./metrics.mjs";
import { playedKeys } from "./dataset.mjs";
import { POSITIONAL_SLOTS, normalizeTitle } from "./shared.mjs";
import {
  addPairs,
  countAtLeast,
  emptyCalibration,
  finishCalibration,
  pairsFromRanking,
  playProbTopShare,
} from "./calibration.mjs";
import {
  HIGH_ODDS_MIN,
  SAFE_ODDS_MIN,
  UNSEEN_PLAY_PROB_FLOOR,
} from "./windowDecision.mjs";

export const BASELINE_NAMES = [
  "global_popularity",
  "gap_ascending",
  "recent_frequency",
];

export const MODEL_NAME = "combined_explainable";

/**
 * Exact-slot hit using per-slot rankings (combined model).
 * @param {Record<string, string>} slots
 * @param {Record<string, { songKey: string }[]>} rankedBySlot
 * @param {number} k
 */
function exactSlotHitAtKPerSlot(slots, rankedBySlot, k) {
  /** @type {Record<string, number>} */
  const bySlot = {};
  let sum = 0;
  let n = 0;
  for (const slot of POSITIONAL_SLOTS) {
    const truth = normalizeTitle(slots?.[slot]);
    if (!truth) continue;
    const top = new Set(
      (rankedBySlot[slot] || []).slice(0, k).map((r) => r.songKey)
    );
    const hit = top.has(truth) ? 1 : 0;
    bySlot[slot] = hit;
    sum += hit;
    n += 1;
  }
  return { bySlot, mean: n ? sum / n : 0 };
}

/**
 * @param {import('./features.mjs').ShowRecord[]} historySortedAsc
 * @param {{
 *   minTrainShows?: number,
 *   maxTrainShows?: number | null,
 *   recentWindow?: number,
 *   baselines?: string[],
 *   includeCombined?: boolean,
 * }} [opts]
 */
export function runRollingBacktest(historySortedAsc, opts = {}) {
  const minTrainShows = opts.minTrainShows ?? 30;
  const maxTrainShows = opts.maxTrainShows ?? null;
  const baselines = opts.baselines ?? BASELINE_NAMES;
  const recentWindow = opts.recentWindow ?? 25;
  const includeCombined = opts.includeCombined !== false;
  const playProbAcc = emptyCalibration();
  const playProbFloorAcc = emptyCalibration();

  /** @type {Record<string, object[]>} */
  const byBaseline = {};
  for (const name of baselines) byBaseline[name] = [];
  if (includeCombined) byBaseline[MODEL_NAME] = [];

  for (let i = 0; i < historySortedAsc.length; i += 1) {
    const target = historySortedAsc[i];
    let priors = priorShows(historySortedAsc, target.showDate);
    if (priors.length < minTrainShows) continue;
    if (maxTrainShows && priors.length > maxTrainShows) {
      priors = priors.slice(priors.length - maxTrainShows);
    }

    const labels = playedKeys(target);
    const slotLabels = target.slots || {};

    for (const name of baselines) {
      const ranked = runBaseline(name, priors, target.showDate, {
        recentWindow,
      });
      const recallAt5 = playedSongRecallAtK(labels, ranked, 5);
      const recallAt10 = playedSongRecallAtK(labels, ranked, 10);
      const slot5 = exactSlotHitAtK(slotLabels, ranked, 5);
      const slot10 = exactSlotHitAtK(slotLabels, ranked, 10);
      const { brier } = rankBrierScore(labels, ranked, 100);
      const sim = simulatedPickCardOutcome(slotLabels, labels, ranked);
      const concentration = top3Concentration(ranked);

      /** @type {Record<string, typeof ranked>} */
      const bySlot = {};
      for (const slot of POSITIONAL_SLOTS) bySlot[slot] = ranked;
      const overlap = crossSlotOverlap(bySlot, 5);

      byBaseline[name].push({
        showDate: target.showDate,
        trainShows: priors.length,
        recallAt5,
        recallAt10,
        slotHitAt5: slot5.mean,
        slotHitAt10: slot10.mean,
        slotHitAt5BySlot: slot5.bySlot,
        brier,
        zeroScoreRate: sim.zeroScore ? 1 : 0,
        top3Concentration: concentration,
        crossSlotOverlapAt5: overlap,
      });
    }

    if (includeCombined) {
      const playRanked = rankCombinedPlayOnly(priors, target.showDate);
      /** @type {Record<string, ReturnType<typeof rankCombinedForSlot>>} */
      const rankedBySlot = {};
      for (const slot of POSITIONAL_SLOTS) {
        rankedBySlot[slot] = rankCombinedForSlot(
          priors,
          target.showDate,
          slot
        );
      }
      const recallAt5 = playedSongRecallAtK(labels, playRanked, 5);
      const recallAt10 = playedSongRecallAtK(labels, playRanked, 10);
      const slot5 = exactSlotHitAtKPerSlot(slotLabels, rankedBySlot, 5);
      const slot10 = exactSlotHitAtKPerSlot(slotLabels, rankedBySlot, 10);
      const { brier } = rankBrierScore(labels, playRanked, 100);
      let exactHits = 0;
      let inSetlistHits = 0;
      const played = new Set(labels.map(normalizeTitle));
      for (const slot of POSITIONAL_SLOTS) {
        const pick = rankedBySlot[slot][0]?.songKey;
        if (!pick) continue;
        const truth = normalizeTitle(slotLabels?.[slot]);
        if (truth && pick === truth) exactHits += 1;
        else if (played.has(pick)) inSetlistHits += 1;
      }
      const zeroScore = exactHits + inSetlistHits === 0;
      const overlap = crossSlotOverlap(rankedBySlot, 5);
      addPairs(playProbAcc, pairsFromRanking(playRanked, labels));
      addPairs(
        playProbFloorAcc,
        pairsFromRanking(playRanked, labels, {
          unseenFloor: UNSEEN_PLAY_PROB_FLOOR,
        })
      );

      byBaseline[MODEL_NAME].push({
        showDate: target.showDate,
        trainShows: priors.length,
        modelVersion: MODEL_VERSION,
        recallAt5,
        recallAt10,
        slotHitAt5: slot5.mean,
        slotHitAt10: slot10.mean,
        slotHitAt5BySlot: slot5.bySlot,
        brier,
        zeroScoreRate: zeroScore ? 1 : 0,
        top3Concentration: top3Concentration(playRanked),
        playProbTop3Share: playProbTopShare(playRanked, 3),
        songsAtHighOdds: countAtLeast(playRanked, HIGH_ODDS_MIN),
        songsAtSafeOdds: countAtLeast(playRanked, SAFE_ODDS_MIN),
        crossSlotOverlapAt5: overlap,
      });
    }
  }

  /** @type {Record<string, object>} */
  const summary = {};
  const names = Object.keys(byBaseline);
  for (const name of names) {
    summary[name] = {
      ...aggregateNights(byBaseline[name]),
      meanCrossSlotOverlapAt5:
        byBaseline[name].length === 0
          ? NaN
          : byBaseline[name].reduce((a, r) => a + r.crossSlotOverlapAt5, 0) /
            byBaseline[name].length,
    };
  }

  const combinedNights = byBaseline[MODEL_NAME] || [];
  const meanOf = (key) => {
    const vals = combinedNights
      .map((row) => row[key])
      .filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  };

  return {
    generatedAt: new Date().toISOString(),
    minTrainShows,
    maxTrainShows,
    recentWindow,
    modelVersion: includeCombined ? MODEL_VERSION : null,
    historyShows: historySortedAsc.length,
    evaluatedNights: Object.values(byBaseline)[0]?.length ?? 0,
    summary,
    playProbCalibration: includeCombined
      ? {
          scored: finishCalibration(playProbAcc),
          withUnseenFloor: finishCalibration(playProbFloorAcc),
          meanPlayProbTop3Share: meanOf("playProbTop3Share"),
          meanSongsAtHighOdds: meanOf("songsAtHighOdds"),
          meanSongsAtSafeOdds: meanOf("songsAtSafeOdds"),
        }
      : null,
    nights: byBaseline,
  };
}

/**
 * Go/no-go: combined model should meet or beat each baseline on slotHit@5 or recall@10.
 * @param {ReturnType<typeof runRollingBacktest>} result
 */
export function evaluateGoNoGo(result) {
  const combined = result.summary[MODEL_NAME];
  if (!combined || !Number.isFinite(combined.slotHitAt5)) {
    return { pass: false, reason: "combined model missing from summary" };
  }
  /** @type {string[]} */
  const wins = [];
  /** @type {string[]} */
  const losses = [];
  for (const name of BASELINE_NAMES) {
    const base = result.summary[name];
    if (!base) continue;
    const beatSlot =
      Number(combined.slotHitAt5) >= Number(base.slotHitAt5) - 1e-9;
    const beatRecall =
      Number(combined.recallAt10) >= Number(base.recallAt10) - 1e-9;
    if (beatSlot || beatRecall) wins.push(name);
    else losses.push(name);
  }
  const pass = losses.length === 0 && wins.length === BASELINE_NAMES.length;
  return {
    pass,
    wins,
    losses,
    reason: pass
      ? `combined_explainable (${MODEL_VERSION}) meets or beats all baselines on slotHit@5 or recall@10`
      : `lags baselines: ${losses.join(", ")}`,
  };
}

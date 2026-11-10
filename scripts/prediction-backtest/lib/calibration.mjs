/**
 * playProb calibration (#1002).
 *
 * The harness Brier in metrics.mjs is a rank pseudo-probability.
 * This module scores the published sigmoid playProb against
 * "did this song play?" labels. Labels are never features.
 */
import { normalizeTitle } from "./shared.mjs";
import { UNSEEN_PLAY_PROB_FLOOR } from "./windowDecision.mjs";

/** Bin edges for reliability. Last edge is exclusive. */
export const RELIABILITY_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.55, 1.01];

/**
 * @param {number} p
 * @returns {number}
 */
export function clampProb(p) {
  if (!Number.isFinite(p)) return 0;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * @returns {{ label: string, lo: number, hi: number }[]}
 */
export function reliabilityBinSpecs() {
  /** @type {{ label: string, lo: number, hi: number }[]} */
  const out = [];
  for (let i = 0; i < RELIABILITY_EDGES.length - 1; i += 1) {
    const lo = RELIABILITY_EDGES[i];
    const hi = RELIABILITY_EDGES[i + 1];
    const hiLabel = hi > 1 ? "100%" : `${Math.round(hi * 100)}%`;
    out.push({
      label: `${Math.round(lo * 100)}–${hiLabel}`,
      lo,
      hi,
    });
  }
  return out;
}

/**
 * @param {{ playProb?: number, songKey: string }[]} ranked
 * @param {string[]} playedTitles
 * @param {{ unseenFloor?: number | null }} [opts]
 *   unseenFloor null/undefined: scored songs only.
 *   number: songs that played but were absent from the ranking get that floor.
 * @returns {{ songKey: string, p: number, y: 0 | 1, unseen?: boolean }[]}
 */
export function pairsFromRanking(ranked, playedTitles, opts = {}) {
  const truth = new Set(
    (playedTitles || []).map(normalizeTitle).filter(Boolean)
  );
  const seen = new Set();
  /** @type {{ songKey: string, p: number, y: 0 | 1, unseen?: boolean }[]} */
  const pairs = [];
  for (const row of ranked || []) {
    const songKey = normalizeTitle(row?.songKey);
    if (!songKey || seen.has(songKey)) continue;
    seen.add(songKey);
    pairs.push({
      songKey,
      p: clampProb(row.playProb),
      y: truth.has(songKey) ? 1 : 0,
    });
  }
  const floor = opts.unseenFloor;
  if (floor != null) {
    for (const songKey of truth) {
      if (seen.has(songKey)) continue;
      pairs.push({
        songKey,
        p: clampProb(floor),
        y: 1,
        unseen: true,
      });
    }
  }
  return pairs;
}

/**
 * @returns {{
 *   sumSq: number,
 *   n: number,
 *   sumY: number,
 *   unseenPlayed: number,
 *   bins: { label: string, lo: number, hi: number, n: number, sumP: number, sumY: number }[],
 * }}
 */
export function emptyCalibration() {
  return {
    sumSq: 0,
    n: 0,
    sumY: 0,
    unseenPlayed: 0,
    bins: reliabilityBinSpecs().map((spec) => ({
      ...spec,
      n: 0,
      sumP: 0,
      sumY: 0,
    })),
  };
}

/**
 * @param {ReturnType<typeof emptyCalibration>} acc
 * @param {{ p: number, y: 0 | 1, unseen?: boolean }[]} pairs
 */
export function addPairs(acc, pairs) {
  for (const pair of pairs) {
    const p = clampProb(pair.p);
    const y = pair.y ? 1 : 0;
    acc.n += 1;
    acc.sumY += y;
    acc.sumSq += (p - y) ** 2;
    if (pair.unseen) acc.unseenPlayed += 1;
    const bin = acc.bins.find((b) => p >= b.lo && p < b.hi);
    if (!bin) continue;
    bin.n += 1;
    bin.sumP += p;
    bin.sumY += y;
  }
}

/**
 * @param {ReturnType<typeof emptyCalibration>} acc
 */
export function finishCalibration(acc) {
  const baseRate = acc.n ? acc.sumY / acc.n : NaN;
  const climatologyBrier =
    acc.n && Number.isFinite(baseRate) ? baseRate * (1 - baseRate) : NaN;
  return {
    brier: acc.n ? acc.sumSq / acc.n : NaN,
    climatologyBrier,
    baseRate,
    n: acc.n,
    unseenPlayed: acc.unseenPlayed,
    bins: acc.bins.map((b) => ({
      label: b.label,
      lo: b.lo,
      hi: b.hi,
      n: b.n,
      meanPredicted: b.n ? b.sumP / b.n : NaN,
      observedRate: b.n ? b.sumY / b.n : NaN,
    })),
  };
}

/**
 * Share of playProb mass sitting in the K highest songs.
 * Unlike top3Concentration, this moves when the sigmoid is peaked.
 * @param {{ playProb?: number }[]} ranked
 * @param {number} [k]
 */
export function playProbTopShare(ranked, k = 3) {
  const probs = (ranked || [])
    .map((r) => clampProb(r.playProb))
    .filter((p) => p > 0);
  const sum = probs.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  const top = [...probs].sort((a, b) => b - a).slice(0, k);
  return top.reduce((a, b) => a + b, 0) / sum;
}

/**
 * @param {{ playProb?: number }[]} ranked
 * @param {number} min
 */
export function countAtLeast(ranked, min) {
  return (ranked || []).filter((r) => clampProb(r.playProb) >= min).length;
}

export { UNSEEN_PLAY_PROB_FLOOR };

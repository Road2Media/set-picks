/**
 * Model playProb vs historical player cards (#1002).
 *
 * Picks are evaluation labels. They are not model features.
 * Same-night consensus is never fed into rankCombined*.
 */
import { priorShows } from "./features.mjs";
import { playedKeys } from "./dataset.mjs";
import {
  rankCombinedForSlot,
  rankCombinedPlayOnly,
} from "./model.mjs";
import {
  addPairs,
  clampProb,
  emptyCalibration,
  finishCalibration,
  pairsFromRanking,
} from "./calibration.mjs";
import { normalizeTitle, POSITIONAL_SLOTS, SLOT_IDS } from "./shared.mjs";
import {
  HIGH_ODDS_MIN,
  SAFE_ODDS_MIN,
  UNSEEN_PLAY_PROB_FLOOR,
} from "./windowDecision.mjs";

/**
 * @param {Record<string, unknown> | null | undefined} picks
 * @returns {boolean}
 */
export function hasFilledPick(picks) {
  if (picks == null || typeof picks !== "object" || Array.isArray(picks)) {
    return false;
  }
  return Object.values(picks).some(
    (v) => v != null && String(v).trim() !== ""
  );
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  let inter = 0;
  for (const key of left) if (right.has(key)) inter += 1;
  const union = left.size + right.size - inter;
  return union ? inter / union : 1;
}

/**
 * @param {string[][]} cards
 */
function meanPairwiseJaccard(cards) {
  if (cards.length < 2) return NaN;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      sum += jaccard(cards[i], cards[j]);
      n += 1;
    }
  }
  return n ? sum / n : NaN;
}

/**
 * One night of cards against an already-fit ranking.
 * @param {{
 *   cards: { picks: Record<string, unknown> }[],
 *   playRanked: { songKey: string, playProb: number }[],
 *   rankedBySlot: Record<string, { songKey: string }[]>,
 *   playedTitles: string[],
 *   slotLabels: Record<string, string>,
 * }} night
 */
export function summarizePickNight(night) {
  const played = new Set(
    (night.playedTitles || []).map(normalizeTitle).filter(Boolean)
  );
  /** @type {Map<string, number>} */
  const playProb = new Map();
  for (const row of night.playRanked || []) {
    const key = normalizeTitle(row.songKey);
    if (!key || playProb.has(key)) continue;
    playProb.set(key, clampProb(row.playProb));
  }

  const cards = (night.cards || []).filter((card) => hasFilledPick(card?.picks));
  /** @type {string[][]} */
  const cardKeys = [];
  /** @type {Map<string, number>} */
  const songCards = new Map();

  let filledSlots = 0;
  let exactHits = 0;
  let positionalFilled = 0;
  let inSetlistFills = 0;
  let zeroScoreCards = 0;
  let top1Matches = 0;
  let pickedP = 0;
  let pickedN = 0;
  let pickedPlayed = 0;
  let cardRecallSum = 0;

  for (const card of cards) {
    const picks = card.picks || {};
    /** @type {string[]} */
    const keys = [];
    let anyPlayed = false;
    const seen = new Set();
    for (const slot of SLOT_IDS) {
      const key = normalizeTitle(picks[slot]);
      if (!key) continue;
      filledSlots += 1;
      const p = playProb.has(key)
        ? playProb.get(key)
        : UNSEEN_PLAY_PROB_FLOOR;
      pickedP += p;
      pickedN += 1;
      const playedSong = played.has(key);
      if (playedSong) {
        pickedPlayed += 1;
        anyPlayed = true;
        inSetlistFills += 1;
      }
      if (POSITIONAL_SLOTS.includes(slot)) {
        positionalFilled += 1;
        const truth = normalizeTitle(night.slotLabels?.[slot]);
        if (truth && key === truth) exactHits += 1;
      }
      const top1 = normalizeTitle(night.rankedBySlot?.[slot]?.[0]?.songKey);
      if (top1 && key === top1) top1Matches += 1;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
        songCards.set(key, (songCards.get(key) || 0) + 1);
      }
    }
    cardKeys.push(keys);
    if (!anyPlayed) zeroScoreCards += 1;
    if (played.size) {
      let hits = 0;
      for (const key of keys) if (played.has(key)) hits += 1;
      cardRecallSum += hits / played.size;
    }
  }

  const modelSlots = {};
  /** @type {string[]} */
  const modelKeys = [];
  let modelExact = 0;
  let modelPositional = 0;
  let modelInSetlist = 0;
  for (const slot of SLOT_IDS) {
    const key = normalizeTitle(night.rankedBySlot?.[slot]?.[0]?.songKey);
    modelSlots[slot] = key;
    if (!key) continue;
    if (!modelKeys.includes(key)) modelKeys.push(key);
    if (played.has(key)) modelInSetlist += 1;
    if (POSITIONAL_SLOTS.includes(slot)) {
      const truth = normalizeTitle(night.slotLabels?.[slot]);
      if (!truth) continue;
      modelPositional += 1;
      if (key === truth) modelExact += 1;
    }
  }
  const modelAnyPlayed = modelKeys.some((key) => played.has(key));

  let maxSongCards = 0;
  for (const count of songCards.values()) {
    if (count > maxSongCards) maxSongCards = count;
  }

  const nCards = cards.length;
  return {
    cards: nCards,
    filledSlots,
    exactHits,
    positionalFilled,
    inSetlistFills,
    zeroScoreCards,
    top1Matches,
    pickedP,
    pickedN,
    pickedPlayed,
    modelExact,
    modelPositional,
    modelInSetlist,
    modelUniqueSongs: modelKeys.length,
    modelZeroScore: modelAnyPlayed ? 0 : 1,
    fieldUniqueSongs: songCards.size,
    maxSongCardShare: nCards ? maxSongCards / nCards : NaN,
    meanCardRecall: nCards && played.size ? cardRecallSum / nCards : NaN,
    meanPairwiseJaccard: meanPairwiseJaccard(cardKeys),
    songCards,
    playProb,
    played,
    nCards,
  };
}

/**
 * @param {import('./features.mjs').ShowRecord[]} historySortedAsc
 * @param {{ showDate: string, cards: { picks: Record<string, unknown>, isGraded?: boolean }[] }[]} pickNights
 * @param {{ minTrainShows?: number, maxTrainShows?: number | null, minCards?: number }} [opts]
 */
export function runPickEffectiveness(historySortedAsc, pickNights, opts = {}) {
  const minTrainShows = opts.minTrainShows ?? 40;
  const maxTrainShows = opts.maxTrainShows ?? null;
  const minCards = opts.minCards ?? 5;

  const byDate = new Map(pickNights.map((night) => [night.showDate, night]));
  const scored = emptyCalibration();
  const withFloor = emptyCalibration();
  /** Song-nights in the model map, for selection vs outcome. */
  const selection = emptyCalibration();
  const selectionSelectSum = selection.bins.map(() => 0);

  let nights = 0;
  let skippedThin = 0;
  let skippedFewCards = 0;
  let cards = 0;
  let gradedCards = 0;
  let filledSlots = 0;
  let exactHits = 0;
  let positionalFilled = 0;
  let inSetlistFills = 0;
  let zeroScoreCards = 0;
  let top1Matches = 0;
  let pickedP = 0;
  let pickedN = 0;
  let pickedPlayed = 0;
  let modelExact = 0;
  let modelPositional = 0;
  let modelInSetlistSlots = 0;
  let modelZero = 0;
  let modelUniqueSum = 0;
  let fieldUniqueSum = 0;
  let maxShareSum = 0;
  let jaccardSum = 0;
  let jaccardN = 0;
  let highN = 0;
  let highPlayed = 0;
  let highSelect = 0;
  let safeN = 0;
  let safePlayed = 0;
  let safeSelect = 0;
  let playerRecallSum = 0;
  let cardRecallSum = 0;
  let modelRecallAt10Sum = 0;

  for (const target of historySortedAsc) {
    const pickNight = byDate.get(target.showDate);
    if (!pickNight) continue;
    const rawCards = Array.isArray(pickNight.cards) ? pickNight.cards : [];
    const filled = rawCards.filter((card) => hasFilledPick(card?.picks));
    if (!filled.length) continue;

    let priors = priorShows(historySortedAsc, target.showDate);
    if (priors.length < minTrainShows) {
      skippedThin += 1;
      continue;
    }
    if (maxTrainShows && priors.length > maxTrainShows) {
      priors = priors.slice(priors.length - maxTrainShows);
    }
    if (filled.length < minCards) {
      skippedFewCards += 1;
      continue;
    }
    gradedCards += filled.filter((card) => card.isGraded === true).length;

    const playRanked = rankCombinedPlayOnly(priors, target.showDate);
    /** @type {Record<string, ReturnType<typeof rankCombinedForSlot>>} */
    const rankedBySlot = {};
    for (const slot of SLOT_IDS) {
      rankedBySlot[slot] =
        slot === "wild"
          ? playRanked
          : rankCombinedForSlot(priors, target.showDate, slot);
    }
    const labels = playedKeys(target);
    const summary = summarizePickNight({
      cards: filled,
      playRanked,
      rankedBySlot,
      playedTitles: labels,
      slotLabels: target.slots || {},
    });

    addPairs(scored, pairsFromRanking(playRanked, labels));
    addPairs(
      withFloor,
      pairsFromRanking(playRanked, labels, {
        unseenFloor: UNSEEN_PLAY_PROB_FLOOR,
      })
    );

    const top10 = new Set(playRanked.slice(0, 10).map((r) => r.songKey));
    const playedSet = summary.played;
    let playedHits = 0;
    for (const key of playedSet) if (top10.has(key)) playedHits += 1;
    modelRecallAt10Sum += playedSet.size ? playedHits / playedSet.size : 0;

    let playerHits = 0;
    for (const [key] of summary.songCards) {
      if (playedSet.has(key)) playerHits += 1;
    }
    // Union of the field, not one card: reported separately from per-card hits.
    playerRecallSum += playedSet.size ? playerHits / playedSet.size : 0;
    cardRecallSum += summary.meanCardRecall || 0;

    for (const [songKey, p] of summary.playProb) {
      const y = playedSet.has(songKey) ? 1 : 0;
      const share = summary.nCards
        ? (summary.songCards.get(songKey) || 0) / summary.nCards
        : 0;
      const pair = [{ p, y }];
      const before = selection.n;
      addPairs(selection, pair);
      const binIndex = selection.bins.findIndex(
        (b) => p >= b.lo && p < b.hi
      );
      if (selection.n > before && binIndex >= 0) {
        selectionSelectSum[binIndex] += share;
      }
      if (p >= HIGH_ODDS_MIN) {
        highN += 1;
        highPlayed += y;
        highSelect += share;
      }
      if (p >= SAFE_ODDS_MIN) {
        safeN += 1;
        safePlayed += y;
        safeSelect += share;
      }
    }

    nights += 1;
    cards += summary.cards;
    filledSlots += summary.filledSlots;
    exactHits += summary.exactHits;
    positionalFilled += summary.positionalFilled;
    inSetlistFills += summary.inSetlistFills;
    zeroScoreCards += summary.zeroScoreCards;
    top1Matches += summary.top1Matches;
    pickedP += summary.pickedP;
    pickedN += summary.pickedN;
    pickedPlayed += summary.pickedPlayed;
    modelExact += summary.modelExact;
    modelPositional += summary.modelPositional;
    modelInSetlistSlots += summary.modelInSetlist;
    modelZero += summary.modelZeroScore;
    modelUniqueSum += summary.modelUniqueSongs;
    fieldUniqueSum += summary.fieldUniqueSongs;
    maxShareSum += summary.maxSongCardShare;
    if (Number.isFinite(summary.meanPairwiseJaccard)) {
      jaccardSum += summary.meanPairwiseJaccard;
      jaccardN += 1;
    }
  }

  const selectionFinished = finishCalibration(selection);
  const bins = selectionFinished.bins.map((bin, i) => ({
    ...bin,
    meanCardShare: bin.n ? selectionSelectSum[i] / bin.n : NaN,
  }));

  return {
    minTrainShows,
    maxTrainShows,
    minCards,
    nights,
    skippedThin,
    skippedFewCards,
    cards,
    gradedCards,
    playProb: finishCalibration(scored),
    playProbWithFloor: finishCalibration(withFloor),
    bins,
    highOdds: {
      min: HIGH_ODDS_MIN,
      n: highN,
      observedRate: highN ? highPlayed / highN : NaN,
      meanCardShare: highN ? highSelect / highN : NaN,
    },
    safeOdds: {
      min: SAFE_ODDS_MIN,
      n: safeN,
      observedRate: safeN ? safePlayed / safeN : NaN,
      meanCardShare: safeN ? safeSelect / safeN : NaN,
    },
    players: {
      exactSlotRate: positionalFilled ? exactHits / positionalFilled : NaN,
      inSetlistFillRate: filledSlots ? inSetlistFills / filledSlots : NaN,
      zeroScoreRate: cards ? zeroScoreCards / cards : NaN,
      meanPlayProb: pickedN ? pickedP / pickedN : NaN,
      pickedPlayRate: pickedN ? pickedPlayed / pickedN : NaN,
      top1Adoption: filledSlots ? top1Matches / filledSlots : NaN,
      meanCardRecall: nights ? cardRecallSum / nights : NaN,
      fieldUnionRecall: nights ? playerRecallSum / nights : NaN,
    },
    modelCard: {
      exactSlotRate: modelPositional ? modelExact / modelPositional : NaN,
      inSetlistSlotRate: nights
        ? modelInSetlistSlots / (nights * SLOT_IDS.length)
        : NaN,
      zeroScoreRate: nights ? modelZero / nights : NaN,
      meanUniqueSongs: nights ? modelUniqueSum / nights : NaN,
      recallAt10: nights ? modelRecallAt10Sum / nights : NaN,
    },
    herding: {
      meanFieldUniqueSongs: nights ? fieldUniqueSum / nights : NaN,
      meanMaxSongCardShare: nights ? maxShareSum / nights : NaN,
      meanPairwiseJaccard: jaccardN ? jaccardSum / jaccardN : NaN,
      meanModelUniqueSongs: nights ? modelUniqueSum / nights : NaN,
    },
  };
}

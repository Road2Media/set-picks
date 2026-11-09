/**
 * Points-tie ranking (#1218).
 *
 * One helper for show standings, tour wrap, and annual awards. Callers pass
 * scored rows and a policy. The live policy is full tie-break (#1172,
 * decision update 2026-11-08). The other two policies stay available so a
 * later change does not rewrite each surface.
 *
 * Cascade after points, higher first except handle:
 *   1. Exact slots — Set 1 opener, Set 1 closer, Set 2 opener, Set 2 closer,
 *      and the first encore. A later encore is not an exact slot.
 *   2. Correct picks — slots that scored, out of 6.
 *   3. Nightly wins — tour and year only. A single show skips this step.
 *   4. Handle — last resort. It does not rank anyone whose points differ.
 *
 * A tie that is still equal after that cascade shares a rank. Display order
 * inside that tie is uid, so a refresh cannot shuffle the rows.
 *
 * Pure module. No Firebase. Client code re-exports this file.
 */

"use strict";

const RANK_POLICIES = Object.freeze({
  SHARED: "shared",
  SHARED_DISPLAY: "shared-display",
  FULL: "full",
});

/** Live policy on standings, tour wrap, and awards. */
const LIVE_RANK_POLICY = RANK_POLICIES.FULL;

const SURFACES = Object.freeze({
  SHOW: "show",
  TOUR: "tour",
  YEAR: "year",
});

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {number}
 */
function readPoints(row) {
  const points = finite(row?.points);
  if (points != null) return points;
  const total = finite(row?.totalPoints);
  if (total != null) return total;
  const score = finite(row?.score);
  if (score != null) return score;
  return 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {number}
 */
function readExactHits(row) {
  const n = finite(row?.exactHits);
  return n == null ? 0 : n;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {number}
 */
function readCorrectPicks(row) {
  const n = finite(row?.correctPicks);
  if (n != null) return n;
  const slots = finite(row?.correctSlots);
  return slots == null ? 0 : slots;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {number}
 */
function readNightlyWins(row) {
  const n = finite(row?.nightlyWins);
  if (n != null) return n;
  const wins = finite(row?.wins);
  return wins == null ? 0 : wins;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
function readHandle(row) {
  const raw = row?.handle ?? row?.username ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
function readUid(row) {
  const raw = row?.uid ?? row?.userId ?? row?.id ?? "";
  return typeof raw === "string" ? raw : String(raw ?? "");
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function cmpNumberDesc(a, b) {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function cmpHandleAsc(a, b) {
  return a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function cmpUidAsc(a, b) {
  return a.localeCompare(b, "en");
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   read: (row: Record<string, unknown>) => number | string,
 *   compare: (a: number | string, b: number | string) => number,
 * }} RankComparator
 */

/** @type {Record<string, RankComparator>} */
const COMPARATORS = Object.freeze({
  points: {
    id: "points",
    label: "Points",
    read: readPoints,
    compare: cmpNumberDesc,
  },
  exactHits: {
    id: "exactHits",
    label: "Exact slots",
    read: readExactHits,
    compare: cmpNumberDesc,
  },
  correctPicks: {
    id: "correctPicks",
    label: "Correct picks",
    read: readCorrectPicks,
    compare: cmpNumberDesc,
  },
  nightlyWins: {
    id: "nightlyWins",
    label: "Nightly wins",
    read: readNightlyWins,
    compare: cmpNumberDesc,
  },
  username: {
    id: "username",
    label: "Handle",
    read: readHandle,
    compare: cmpHandleAsc,
  },
});

const UID_STABILITY = Object.freeze({
  id: "uid",
  label: "Id",
  read: readUid,
  compare: cmpUidAsc,
});

/**
 * Named tie-break steps for a surface. Points are the primary key, not in
 * this list. Show boards skip nightly wins.
 *
 * @param {string | null | undefined} surface
 * @returns {RankComparator[]}
 */
function comparatorsForSurface(surface) {
  /** @type {RankComparator[]} */
  const steps = [COMPARATORS.exactHits, COMPARATORS.correctPicks];
  if (surface !== SURFACES.SHOW) steps.push(COMPARATORS.nightlyWins);
  steps.push(COMPARATORS.username);
  return steps;
}

/**
 * @param {unknown} policy
 * @returns {string}
 */
function normalizePolicy(policy) {
  if (
    policy === RANK_POLICIES.SHARED ||
    policy === RANK_POLICIES.SHARED_DISPLAY ||
    policy === RANK_POLICIES.FULL
  ) {
    return policy;
  }
  return LIVE_RANK_POLICY;
}

/**
 * @param {string | null | undefined} surface
 * @returns {string}
 */
function normalizeSurface(surface) {
  if (surface === SURFACES.SHOW || surface === SURFACES.YEAR) return surface;
  return SURFACES.TOUR;
}

/**
 * @param {RankComparator[]} steps
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {{ diff: number, decisive: string | null }}
 */
function compareWith(steps, a, b) {
  for (const step of steps) {
    const diff = step.compare(step.read(a), step.read(b));
    if (diff !== 0) return { diff, decisive: step.id };
  }
  return { diff: 0, decisive: null };
}

/**
 * @param {unknown} rows
 * @param {{
 *   policy?: string,
 *   surface?: string,
 *   primary?: RankComparator,
 *   comparators?: RankComparator[],
 * }} [options]
 * @returns {{
 *   policy: string,
 *   surface: string,
 *   unresolvedTieCount: number,
 *   rows: Array<Record<string, unknown> & {
 *     rank: number,
 *     displayOrder: number,
 *     orderInTie: number,
 *     tiedCount: number,
 *     tiedHandles: string[],
 *     tieBreak: {
 *       pointsTiedWith: number,
 *       decisive: string | null,
 *       stillTied: boolean,
 *       steps: Array<{ id: string, label: string, value: number | string }>,
 *     },
 *   }>,
 * }}
 */
function rankScoredRows(rows, options = {}) {
  const policy = normalizePolicy(options.policy ?? LIVE_RANK_POLICY);
  const surface = normalizeSurface(options.surface);
  const primary = options.primary || COMPARATORS.points;
  const breakers = Array.isArray(options.comparators)
    ? options.comparators
    : comparatorsForSurface(surface);
  const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];

  /** @type {RankComparator[]} */
  const sortSteps = [primary];
  if (policy === RANK_POLICIES.SHARED) {
    sortSteps.push(COMPARATORS.username);
  } else {
    sortSteps.push(...breakers);
  }
  if (!sortSteps.some((step) => step.id === "uid")) sortSteps.push(UID_STABILITY);

  const rankSteps =
    policy === RANK_POLICIES.FULL ? [primary, ...breakers] : [primary];

  const indexed = list.map((row, index) => ({
    row: /** @type {Record<string, unknown>} */ (row),
    index,
  }));
  indexed.sort((a, b) => {
    const cmp = compareWith(sortSteps, a.row, b.row);
    if (cmp.diff !== 0) return cmp.diff;
    return a.index - b.index;
  });

  /** @type {number[]} */
  const rankOf = [];
  /** @type {Array<{ row: Record<string, unknown>, rank: number, decisive: string | null, stillTied: boolean }>} */
  const placed = [];
  for (let i = 0; i < indexed.length; i += 1) {
    const row = indexed[i].row;
    if (i === 0) {
      rankOf.push(1);
      placed.push({ row, rank: 1, decisive: null, stillTied: false });
      continue;
    }
    const prev = indexed[i - 1].row;
    const pointsSame = compareWith([primary], prev, row).diff === 0;
    const rankCmp = compareWith(rankSteps, prev, row);
    const rank = rankCmp.diff === 0 ? rankOf[i - 1] : i + 1;
    rankOf.push(rank);
    let decisive = null;
    if (pointsSame && policy !== RANK_POLICIES.SHARED) {
      decisive = compareWith(breakers, prev, row).decisive;
    }
    placed.push({
      row,
      rank,
      decisive,
      stillTied: rankCmp.diff === 0,
    });
  }

  /** @type {Map<number, Array<(typeof placed)[number]>>} */
  const byRank = new Map();
  /** @type {Map<number, number>} */
  const byPoints = new Map();
  for (const entry of placed) {
    const group = byRank.get(entry.rank) || [];
    group.push(entry);
    byRank.set(entry.rank, group);
    const points = readPoints(entry.row);
    byPoints.set(points, (byPoints.get(points) || 0) + 1);
  }

  let unresolvedTieCount = 0;
  for (const group of byRank.values()) {
    if (group.length > 1) unresolvedTieCount += 1;
  }

  const outRows = placed.map((entry, displayOrder) => {
    const group = byRank.get(entry.rank) || [];
    const orderInTie = group.indexOf(entry);
    const tiedHandles = group
      .filter((member) => member !== entry)
      .map((member) => readHandle(member.row) || "Anonymous");
    return {
      ...entry.row,
      rank: entry.rank,
      displayOrder,
      orderInTie,
      tiedCount: group.length,
      tiedHandles,
      tieBreak: {
        pointsTiedWith: byPoints.get(readPoints(entry.row)) || 1,
        decisive: entry.decisive,
        stillTied: entry.stillTied,
        steps: breakers.map((step) => ({
          id: step.id,
          label: step.label,
          value: step.read(entry.row),
        })),
      },
    };
  });

  return {
    policy,
    surface,
    unresolvedTieCount,
    rows: outRows,
  };
}

module.exports = {
  RANK_POLICIES,
  LIVE_RANK_POLICY,
  SURFACES,
  COMPARATORS,
  comparatorsForSurface,
  rankScoredRows,
  readPoints,
  readHandle,
};

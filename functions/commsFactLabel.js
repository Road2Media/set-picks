/**
 * Per-send fact labels for show_recap and tour_recap (#1082).
 *
 * Slot ids are the message maps. This module records which of those ids the
 * sentence that is about to send actually spoke. It does not write new copy.
 * An id that is not on the map is dropped. A missing fact omits its slot and
 * does not block the send.
 *
 * Night map: docs/comms-triggers/SHOW_RECAP_FACT_INVENTORY.md
 * Tour map: docs/comms-triggers/TOUR_RECAP_FACT_INVENTORY.md
 */

"use strict";

const NIGHT_BRANCHES = ["cold", "mixed", "hot_night", "bustout_hero"];

const NIGHT_SLOTS = [
  "set1_length",
  "set2_length",
  "encore_length",
  "set1_highlight",
  "set2_highlight",
  "encore_titles",
  "venue_fallback",
  "all_six",
  "none_hit",
  "named_slots",
  "wrong_slot",
  "bustout_caught",
  "bustout_missed",
  "tour_debut",
  "night_rank",
];

const TOUR_BRANCHES = ["champion", "top5", "top10", "full_run", "partial", "fallback"];

const TOUR_SLOTS = [
  "rank",
  "points",
  "nightly_wins",
  "shows_played",
  "best_night",
  "bustouts_caught",
  "shows_sat_out",
  "tour_scale",
  "rarest_hit",
  "lead_changes",
  "closing_stand",
  "opening_fallback",
  "rare_hit_picked",
  "lead_change_involved",
  "personal_mark",
];

/**
 * Same branch rules as `resolveTourRecapRankBranch` in
 * `src/features/tour-recap/model/tourRecap.js`.
 *
 * @param {{ rank?: number, showsPlayed?: number, showCount?: number }} ctx
 * @returns {string}
 */
function resolveTourRecapRankBranch(ctx) {
  const r = Number(ctx.rank);
  const played = Number(ctx.showsPlayed);
  const showCount = Number(ctx.showCount);
  if (r === 1) return "champion";
  if (r >= 2 && r <= 5) return "top5";
  if (r >= 6 && r <= 10) return "top10";
  if (r >= 11 && Number.isFinite(showCount) && showCount > 0 && played === showCount) {
    return "full_run";
  }
  if (r >= 11 && Number.isFinite(played) && Number.isFinite(showCount) && played < showCount) {
    return "partial";
  }
  return "fallback";
}

/**
 * @param {unknown} branch
 * @param {string[]} allowed
 * @returns {string | null}
 */
function keepBranch(branch, allowed) {
  return typeof branch === "string" && allowed.includes(branch) ? branch : null;
}

/**
 * @param {unknown} slots
 * @param {string[]} allowed
 * @returns {string[]}
 */
function keepSlots(slots, allowed) {
  if (!Array.isArray(slots)) return [];
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const raw of slots) {
    if (typeof raw !== "string" || !allowed.includes(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function keepShowDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim()
    : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function keepTourId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Player slot the card sentence speaks. At most one.
 * Flow slots are passed in explicitly by the night composer.
 *
 * @param {string | null | undefined} branch
 * @param {string} card
 * @returns {string | null}
 */
function nightPlayerSlot(branch, card) {
  const text = typeof card === "string" ? card : "";
  if (/you hit all six/i.test(text)) return "all_six";
  if (/none of your six landed/i.test(text)) return "none_hit";
  if (/you caught /i.test(text) || /caught a bustout/i.test(text)) return "bustout_caught";
  if (/you hit /i.test(text)) return "named_slots";
  if (/was in the show, just not your/i.test(text)) return "wrong_slot";
  if (/stayed off your board/i.test(text)) return "bustout_missed";
  if (/was new to the tour|were new to the tour/i.test(text)) return "tour_debut";
  if (branch === "bustout_hero") return "bustout_caught";
  return null;
}

/**
 * @param {{
 *   branch?: string | null,
 *   card?: string,
 *   rankSentence?: string,
 *   showDate?: string | null,
 *   slots?: string[],
 * }} input
 */
function buildShowRecapFactLabel(input = {}) {
  const branch = keepBranch(input.branch, NIGHT_BRANCHES);
  const slots = Array.isArray(input.slots)
    ? keepSlots(input.slots, NIGHT_SLOTS)
    : keepSlots(
        [
          nightPlayerSlot(branch, input.card || ""),
          typeof input.rankSentence === "string" && input.rankSentence.trim()
            ? "night_rank"
            : null,
        ],
        NIGHT_SLOTS,
      );
  const showDate = keepShowDate(input.showDate);
  return {
    map: "show_recap",
    ...(branch ? { branch } : {}),
    slots: keepSlots(slots, NIGHT_SLOTS),
    ...(showDate ? { showDate } : {}),
  };
}

/**
 * Facts the current tour-wrap sentences already state. Flavor lines are not ids.
 * Rank-band copy lives in `src/features/tour-recap/model/tourRecap.js`.
 *
 * The composer passes the slot ids its sentences spoke. Callers that only
 * have the rank numbers fall back to those numbers plus the fallback opening.
 *
 * @param {{
 *   rank?: number,
 *   points?: number,
 *   wins?: number,
 *   showsPlayed?: number,
 *   showCount?: number,
 *   tourId?: string | null,
 *   openingParas?: unknown,
 *   slots?: string[],
 * }} input
 */
function buildTourRecapFactLabel(input = {}) {
  const branch = resolveTourRecapRankBranch({
    rank: input.rank,
    showsPlayed: input.showsPlayed,
    showCount: input.showCount,
  });
  const tourId = keepTourId(input.tourId);
  if (Array.isArray(input.slots)) {
    return {
      map: "tour_recap",
      branch,
      slots: keepSlots(input.slots, TOUR_SLOTS),
      ...(tourId ? { tourId } : {}),
    };
  }
  /** @type {string[]} */
  const slots = [];
  if (Number.isFinite(Number(input.rank))) slots.push("rank");
  if (Number.isFinite(Number(input.points))) slots.push("points");
  if (Number.isFinite(Number(input.wins))) slots.push("nightly_wins");
  if (Number.isFinite(Number(input.showsPlayed)) && Number(input.showCount) > 0) {
    slots.push("shows_played");
  }
  const paras = Array.isArray(input.openingParas) ? input.openingParas : [];
  if (paras.some((line) => typeof line === "string" && /inexact science/i.test(line))) {
    slots.push("opening_fallback");
  }
  return {
    map: "tour_recap",
    branch,
    slots: keepSlots(slots, TOUR_SLOTS),
    ...(tourId ? { tourId } : {}),
  };
}

/**
 * Copy a label onto the delivery log. Drops a map or id this module does not know.
 *
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function sanitizeFactLabel(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = /** @type {{ map?: unknown, branch?: unknown, slots?: unknown, showDate?: unknown, tourId?: unknown }} */ (
    raw
  ).map;
  if (map !== "show_recap" && map !== "tour_recap") return null;
  const branches = map === "show_recap" ? NIGHT_BRANCHES : TOUR_BRANCHES;
  const allowed = map === "show_recap" ? NIGHT_SLOTS : TOUR_SLOTS;
  const branch = keepBranch(/** @type {{ branch?: unknown }} */ (raw).branch, branches);
  const showDate = map === "show_recap" ? keepShowDate(/** @type {{ showDate?: unknown }} */ (raw).showDate) : null;
  const tourId = map === "tour_recap" ? keepTourId(/** @type {{ tourId?: unknown }} */ (raw).tourId) : null;
  return {
    map,
    ...(branch ? { branch } : {}),
    slots: keepSlots(/** @type {{ slots?: unknown }} */ (raw).slots, allowed),
    ...(showDate ? { showDate } : {}),
    ...(tourId ? { tourId } : {}),
  };
}

module.exports = {
  NIGHT_BRANCHES,
  NIGHT_SLOTS,
  TOUR_BRANCHES,
  TOUR_SLOTS,
  resolveTourRecapRankBranch,
  buildShowRecapFactLabel,
  buildTourRecapFactLabel,
  sanitizeFactLabel,
};

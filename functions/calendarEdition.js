/**
 * Calendar edition metadata for comms scanners (#1035).
 *
 * `editionStatus` on a `show_calendar` tour group is the archive/closed gate.
 * A tour name (including "Sphere") is not a send gate. Phish.net refresh
 * rebuilds groups, so edition fields are copied forward from the previous
 * snapshot by show date, then by tour label.
 *
 * `campaignId` is an analytics slug (`2026-summer`, `2026-sphere`). It is not
 * a trigger id.
 */

"use strict";

const EDITION_STATUSES = new Set(["live", "archive", "closed"]);
const SEASON_WORDS = ["sphere", "summer", "fall", "winter", "spring", "mexico", "nye"];
const EDITION_RANK = { live: 1, archive: 2, closed: 3 };

/**
 * @param {unknown} value
 * @returns {"live" | "archive" | "closed" | null}
 */
function normalizeEditionStatus(value) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EDITION_STATUSES.has(status) ? status : null;
}

/**
 * @param {unknown} group
 * @returns {"live" | "archive" | "closed" | null}
 */
function editionStatusFromGroup(group) {
  if (!group || typeof group !== "object") return null;
  return normalizeEditionStatus(group.editionStatus);
}

/**
 * @param {unknown} group
 * @returns {string | null}
 */
function explicitCampaignId(group) {
  if (!group || typeof group !== "object") return null;
  const raw = typeof group.campaignId === "string" ? group.campaignId.trim() : "";
  return raw || null;
}

/**
 * @param {unknown} group
 * @returns {string | null}
 */
function explicitProcessId(group) {
  if (!group || typeof group !== "object") return null;
  const raw = typeof group.commsProcessId === "string" ? group.commsProcessId.trim() : "";
  return raw || null;
}

/**
 * Edition analytics slug derived from a calendar tour key.
 *
 * Explicit group `campaignId` wins when present (`campaignIdForTourGroup`).
 * Otherwise: a 20xx year plus one season word.
 *
 * | Tour key | Slug |
 * |----------|------|
 * | `2026 Summer Tour` | `2026-summer` |
 * | `2026 Sphere` | `2026-sphere` |
 * | `Fall Tour 2026` | `2026-fall` |
 *
 * A key with no year or season word becomes a kebab of the label with the
 * word "tour" removed (`Fall Warmup` → `fall-warmup`).
 *
 * @param {unknown} tourKey
 * @returns {string | null}
 */
function editionCampaignIdFromTourKey(tourKey) {
  const raw = String(tourKey || "").trim();
  if (!raw) return null;
  const year = raw.match(/\b(20\d{2})\b/)?.[1] || "";
  const lower = raw.toLowerCase();
  const season = SEASON_WORDS.find((word) => new RegExp(`\\b${word}\\b`, "i").test(lower)) || "";
  if (year && season) return `${year}-${season}`;
  const kebab = lower
    .replace(/\btour\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return kebab || null;
}

/**
 * @param {unknown} group
 * @returns {string | null}
 */
function campaignIdForTourGroup(group) {
  return explicitCampaignId(group) || editionCampaignIdFromTourKey(group && group.tour);
}

/**
 * @param {unknown} group
 * @returns {{ editionStatus?: string, commsProcessId?: string, campaignId?: string } | null}
 */
function editionFieldsFromGroup(group) {
  const editionStatus = editionStatusFromGroup(group);
  const commsProcessId = explicitProcessId(group);
  const campaignId = explicitCampaignId(group);
  if (!editionStatus && !commsProcessId && !campaignId) return null;
  return {
    ...(editionStatus ? { editionStatus } : {}),
    ...(commsProcessId ? { commsProcessId } : {}),
    ...(campaignId ? { campaignId } : {}),
  };
}

/**
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} prevData
 * @returns {Map<string, { editionStatus?: string, commsProcessId?: string, campaignId?: string }>}
 */
function flattenSnapshotEditionByDate(prevData) {
  /** @type {Map<string, { editionStatus?: string, commsProcessId?: string, campaignId?: string }>} */
  const map = new Map();
  const groups = prevData && prevData.showDatesByTour;
  if (!Array.isArray(groups)) return map;
  for (const group of groups) {
    const fields = editionFieldsFromGroup(group);
    if (!fields) continue;
    const shows = Array.isArray(group.shows) ? group.shows : [];
    for (const show of shows) {
      const date = show && typeof show.date === "string" ? show.date.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      map.set(date, fields);
    }
  }
  return map;
}

/**
 * @param {unknown[]} groups
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} prevData
 * @returns {unknown[]}
 */
function stampPreservedEdition(groups, prevData) {
  if (!Array.isArray(groups)) return [];
  const byDate = flattenSnapshotEditionByDate(prevData);
  /** @type {Map<string, { editionStatus?: string, commsProcessId?: string, campaignId?: string }>} */
  const byTour = new Map();
  const prevGroups = prevData && prevData.showDatesByTour;
  if (Array.isArray(prevGroups)) {
    for (const group of prevGroups) {
      const tour = group && typeof group.tour === "string" ? group.tour.trim() : "";
      const fields = editionFieldsFromGroup(group);
      if (tour && fields) byTour.set(tour, fields);
    }
  }

  return groups.map((group) => {
    if (!group || typeof group !== "object") return group;
    /** @type {string[]} */
    const votes = [];
    let commsProcessId = null;
    let campaignId = null;
    const shows = Array.isArray(group.shows) ? group.shows : [];
    for (const show of shows) {
      const date = show && typeof show.date === "string" ? show.date.trim() : "";
      const prev = byDate.get(date);
      if (!prev) continue;
      if (prev.editionStatus) votes.push(prev.editionStatus);
      if (!commsProcessId && prev.commsProcessId) commsProcessId = prev.commsProcessId;
      if (!campaignId && prev.campaignId) campaignId = prev.campaignId;
    }
    if (votes.length === 0) {
      const tour = typeof group.tour === "string" ? group.tour.trim() : "";
      const labeled = tour ? byTour.get(tour) : null;
      if (labeled) {
        if (labeled.editionStatus) votes.push(labeled.editionStatus);
        if (!commsProcessId && labeled.commsProcessId) commsProcessId = labeled.commsProcessId;
        if (!campaignId && labeled.campaignId) campaignId = labeled.campaignId;
      }
    }
    let editionStatus = null;
    for (const status of votes) {
      if (!editionStatus || EDITION_RANK[status] > EDITION_RANK[editionStatus]) {
        editionStatus = status;
      }
    }
    if (!editionStatus && !commsProcessId && !campaignId) return group;
    return {
      ...group,
      ...(editionStatus ? { editionStatus } : {}),
      ...(commsProcessId ? { commsProcessId } : {}),
      ...(campaignId ? { campaignId } : {}),
    };
  });
}

/**
 * @param {unknown} showDatesByTour
 * @param {unknown} tourKey
 * @returns {Record<string, unknown> | null}
 */
function findTourGroup(showDatesByTour, tourKey) {
  if (!Array.isArray(showDatesByTour)) return null;
  const want = String(tourKey || "").trim();
  if (!want) return null;
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    if (tour === want) return group;
  }
  return null;
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
function editionBlocksAutomatedSend(status) {
  return status === "archive" || status === "closed";
}

module.exports = {
  EDITION_STATUSES,
  normalizeEditionStatus,
  editionStatusFromGroup,
  explicitCampaignId,
  explicitProcessId,
  editionCampaignIdFromTourKey,
  campaignIdForTourGroup,
  editionFieldsFromGroup,
  flattenSnapshotEditionByDate,
  stampPreservedEdition,
  findTourGroup,
  editionBlocksAutomatedSend,
};

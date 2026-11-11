/**
 * Public show notes projected from `comms_show_context` (#684).
 * Pure helpers. No Firestore I/O.
 *
 * The public doc is show-level only: opener, encore, a short bustout or
 * tour-debut fact, and set lengths. It never copies the night's song list,
 * gap map, or any player-relative field.
 */

"use strict";

const { formatFanShowDate } = require("./fanShowDate.cjs");
const { tourLabelToSlug } = require("./aggregateTourSetlistStats.cjs");

const PUBLIC_SHOW_NOTES_COLLECTION = "public_show_notes";
const PUBLIC_SHOW_NOTES_INDEX_ID = "_index";
const PUBLIC_SHOW_NOTES_SCHEMA_VERSION = 1;
const MAX_NAMED_DEBUTS = 4;
const MAX_DEBUTS_TO_PUBLISH = 8;
const MAX_BUSTOUTS = 6;
const MAX_INDEX_NOTES = 40;
const MAX_TITLE_LENGTH = 80;
const BUSTOUT_MIN_GAP = 30;

/** Fail closed if player-relative copy leaks into a public sentence. */
const PLAYER_LEAK_RE =
  /\b(your score|you caught|you took|your picks|your board|your rank|handles?|emails?)\b|\buid\b/i;

const PUBLIC_NOTE_KEYS = Object.freeze([
  "showDate",
  "tourKey",
  "tourSlug",
  "venue",
  "city",
  "openerTitle",
  "encoreTitle",
  "bustouts",
  "tourDebuts",
  "tourDebutMore",
  "setCounts",
  "paragraphs",
  "headline",
  "momentTags",
  "schemaVersion",
  "source",
]);

/**
 * "a" / "an" before a spoken gap number (eight*, eleven, eighteen → an).
 * Same rule as `commsShowContextCore`.
 * @param {number} n
 * @returns {"a" | "an"}
 */
function indefiniteArticleForGap(n) {
  const abs = Math.abs(Math.trunc(Number(n)));
  if (!Number.isFinite(abs)) return "a";
  const s = String(abs);
  if (s === "11" || s === "18" || s.startsWith("8")) return "an";
  return "a";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanTitle(value) {
  const title = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!title || title.length > MAX_TITLE_LENGTH) return "";
  if (PLAYER_LEAK_RE.test(title)) return "";
  return title;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function cleanTitles(value) {
  if (!Array.isArray(value)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const title = cleanTitle(item);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/**
 * @param {string[]} titles
 * @returns {string}
 */
function joinTitles(titles) {
  if (titles.length <= 1) return titles[0] || "";
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
function hasPlayerLeak(text) {
  return PLAYER_LEAK_RE.test(String(text ?? ""));
}

/**
 * @param {Record<string, unknown>} context
 * @returns {{ title: string, gap: number | null }[]}
 */
function bustoutRows(context) {
  /** @type {{ title: string, gap: number | null }[]} */
  const out = [];
  const seen = new Set();
  const push = (title, gap) => {
    const clean = cleanTitle(title);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const n = Number(gap);
    const publishedGap =
      Number.isFinite(n) && n >= BUSTOUT_MIN_GAP ? Math.trunc(n) : null;
    out.push({ title: clean, gap: publishedGap });
  };

  if (Array.isArray(context.bustout_entries)) {
    for (const row of context.bustout_entries) {
      if (!row || typeof row !== "object") continue;
      push(row.title, row.gap);
      if (out.length >= MAX_BUSTOUTS) return out;
    }
  }
  if (out.length) return out;
  for (const title of cleanTitles(context.bustout_titles)) {
    push(title, null);
    if (out.length >= MAX_BUSTOUTS) break;
  }
  return out;
}

/**
 * @param {unknown} setCounts
 * @returns {string}
 */
function countSentence(setCounts) {
  if (!setCounts || typeof setCounts !== "object") return "";
  const counts = /** @type {Record<string, unknown>} */ (setCounts);
  const set1 = Number(counts.set1);
  const set2 = Number(counts.set2);
  const encore = Number(counts.encore);
  /** @type {string[]} */
  const parts = [];
  if (Number.isFinite(set1) && set1 > 0) parts.push(`Set 1 ran ${Math.trunc(set1)} songs`);
  if (Number.isFinite(set2) && set2 > 0) parts.push(`Set 2 ran ${Math.trunc(set2)} songs`);
  let sentence = "";
  if (parts.length === 1) sentence = `${parts[0]}.`;
  else if (parts.length === 2) sentence = `${parts[0]} and ${parts[1]}.`;
  if (Number.isFinite(encore) && encore > 0) {
    const encoreBit =
      Math.trunc(encore) === 1
        ? "The encore was 1 song."
        : `The encore was ${Math.trunc(encore)} songs.`;
    sentence = sentence ? `${sentence} ${encoreBit}` : encoreBit;
  }
  return sentence;
}

/**
 * @param {unknown} setCounts
 * @returns {{ set1?: number, set2?: number, encore?: number } | null}
 */
function numericCounts(setCounts) {
  if (!setCounts || typeof setCounts !== "object") return null;
  const counts = /** @type {Record<string, unknown>} */ (setCounts);
  /** @type {{ set1?: number, set2?: number, encore?: number }} */
  const out = {};
  for (const key of ["set1", "set2", "encore"]) {
    const n = Number(counts[key]);
    if (Number.isFinite(n) && n >= 0) {
      out[key] = Math.trunc(n);
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {string} showDate
 * @param {string} venue
 * @param {string} city
 * @param {string | null} tourKey
 * @param {string} opener
 * @param {string} encore
 * @returns {string}
 */
function leadSentence(showDate, venue, city, tourKey, opener, encore) {
  const fan = formatFanShowDate(showDate);
  const when = typeof fan === "string" ? fan : showDate;
  const place = [venue, city].filter(Boolean).join(", ");
  let lead = place ? `${when} at ${place}` : when;
  if (tourKey) lead += ` (${tourKey})`;
  lead += ".";
  /** @type {string[]} */
  const calls = [];
  if (opener) calls.push(`Set 1 opened with ${opener}`);
  if (encore) calls.push(`the encore was ${encore}`);
  if (calls.length === 1) {
    const bit = calls[0];
    lead += ` ${bit.charAt(0).toUpperCase()}${bit.slice(1)}.`;
  } else if (calls.length === 2) {
    const bit = calls[0];
    lead += ` ${bit.charAt(0).toUpperCase()}${bit.slice(1)}, and ${calls[1]}.`;
  }
  return lead;
}

/**
 * @param {Record<string, unknown> | null | undefined} context
 * @param {{ venue?: unknown, city?: unknown }} [extras]
 * @returns {Record<string, unknown> | null}
 */
function projectPublicShowNote(context, extras = {}) {
  if (!context || typeof context !== "object") return null;
  const showDate = cleanTitle(context.showDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) return null;

  const bustouts = bustoutRows(context);
  const trusted = context.tour_debuts_trusted === true;
  const debutsAll = trusted ? cleanTitles(context.tour_debut_titles) : [];
  const debutsOk = debutsAll.length >= 1 && debutsAll.length <= MAX_DEBUTS_TO_PUBLISH;
  if (bustouts.length === 0 && !debutsOk) return null;

  const namedDebuts = debutsOk ? debutsAll.slice(0, MAX_NAMED_DEBUTS) : [];
  const tourDebutMore = debutsOk ? Math.max(0, debutsAll.length - namedDebuts.length) : 0;
  const opener = cleanTitle(context.opener_title);
  const encore = cleanTitle(context.encore_title);
  const tourKey = cleanTitle(context.tourKey) || null;
  const venue = cleanTitle(extras.venue);
  const city = cleanTitle(extras.city);

  /** @type {string[]} */
  const paragraphs = [
    leadSentence(showDate, venue, city, tourKey, opener, encore),
  ];

  if (bustouts.length) {
    const bits = bustouts.map((row) =>
      row.gap == null
        ? row.title
        : `${row.title} (${indefiniteArticleForGap(row.gap)} ${row.gap} show gap)`,
    );
    const label = bustouts.length === 1 ? "Bustout" : "Bustouts";
    paragraphs.push(`${label}: ${bits.join("; ")}.`);
  }

  if (namedDebuts.length) {
    const more = tourDebutMore > 0 ? `, plus ${tourDebutMore} more` : "";
    paragraphs.push(`New to this tour: ${joinTitles(namedDebuts)}${more}.`);
  }

  const counts = countSentence(context.set_counts);
  if (counts && paragraphs.length < 4) paragraphs.push(counts);

  if (paragraphs.length < 2 || paragraphs.length > 4) return null;
  if (paragraphs.some((paragraph) => paragraph.length > 500 || hasPlayerLeak(paragraph))) return null;

  /** @type {string[]} */
  const tags = [];
  if (bustouts.length) tags.push("bustout");
  if (namedDebuts.length) tags.push("tour_debut");
  const rawTags = Array.isArray(context.show_moment_tags) ? context.show_moment_tags : [];
  if (rawTags.includes("multi_encore")) tags.push("multi_encore");

  const fan = formatFanShowDate(showDate);
  const when = typeof fan === "string" ? fan : showDate;
  const headline = bustouts.length
    ? `${when}: ${bustouts[0].title} bustout`
    : `${when}: new to the tour`;
  if (hasPlayerLeak(headline)) return null;

  const slug = tourKey ? tourLabelToSlug(tourKey) : null;

  return {
    showDate,
    tourKey,
    tourSlug: slug && slug !== "tour" ? slug : null,
    venue: venue || null,
    city: city || null,
    openerTitle: opener || null,
    encoreTitle: encore || null,
    bustouts,
    tourDebuts: namedDebuts,
    tourDebutMore,
    setCounts: numericCounts(context.set_counts),
    paragraphs,
    headline,
    momentTags: tags,
    schemaVersion: PUBLIC_SHOW_NOTES_SCHEMA_VERSION,
    source: "comms_show_context",
  };
}

/**
 * Hub index. Newest dates first. Headlines only, never the night's songs.
 * @param {Record<string, unknown>[]} notes
 * @param {string} writtenAt
 */
function buildPublicShowNotesIndex(notes, writtenAt) {
  const rows = [...(notes || [])]
    .filter((note) => note && typeof note.showDate === "string")
    .sort((a, b) => (a.showDate < b.showDate ? 1 : a.showDate > b.showDate ? -1 : 0))
    .slice(0, MAX_INDEX_NOTES)
    .map((note) => ({
      showDate: note.showDate,
      headline: note.headline,
      tourSlug: note.tourSlug || null,
      tourKey: note.tourKey || null,
    }));
  return {
    schemaVersion: PUBLIC_SHOW_NOTES_SCHEMA_VERSION,
    notes: rows,
    writtenAt,
    source: "comms_show_context",
  };
}

module.exports = {
  BUSTOUT_MIN_GAP,
  MAX_DEBUTS_TO_PUBLISH,
  MAX_INDEX_NOTES,
  PUBLIC_NOTE_KEYS,
  PUBLIC_SHOW_NOTES_COLLECTION,
  PUBLIC_SHOW_NOTES_INDEX_ID,
  PUBLIC_SHOW_NOTES_SCHEMA_VERSION,
  buildPublicShowNotesIndex,
  hasPlayerLeak,
  projectPublicShowNote,
};

/**
 * Firestore I/O for `comms_show_context/{showDate}` (#572).
 */

"use strict";

const {
  buildCommsShowContext,
  showLevelPayloadFields,
  priorDatesForTourDebutLookup,
  lifetimePlaysForTitles,
  COMMS_SHOW_CONTEXT_SCHEMA_VERSION,
} = require("./commsShowContextCore");
const { loadSongCatalogSongs } = require("./songCatalogSource");
const { PHISH_SONGS } = require("./phishSongs");
const { tourDatesForKey } = require("./tourRankingsDailyCore");
const { resolveTourKeyForDate } = require("./rollupSeasonAggregates");
const { tourLabelToSlug } = require("./aggregateTourSetlistStats.cjs");

/**
 * Last-played dates from the public tour table for songs played on this night.
 * The song catalog can already say last night. This map is the date from before the show.
 * Missing doc or a failed read returns {}.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string | null | undefined} tourKey
 * @param {string} showDate
 * @returns {Promise<Record<string, string>>}
 */
async function loadLastPlayedByTitle(db, tourKey, showDate) {
  if (!db || !tourKey || !showDate) return {};
  try {
    const snap = await db.collection("public_tour_stats").doc(tourLabelToSlug(tourKey)).get();
    if (!snap.exists) return {};
    const data = snap.data() || {};
    const rows = []
      .concat(Array.isArray(data.bustouts) ? data.bustouts : [])
      .concat(Array.isArray(data.gapHighlights) ? data.gapHighlights : []);
    /** @type {Record<string, string>} */
    const map = {};
    for (const row of rows) {
      if (!row || row.showDate !== showDate) continue;
      const title = String(row.title || "").trim().toLowerCase();
      const date = row.lastPlayed;
      if (!title || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      map[title] = date;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Load prior tour setlist docs (exclusive of showDate).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} priorDates
 */
async function loadPriorSetlistDocs(db, priorDates) {
  /** @type {Array<Record<string, unknown>>} */
  const docs = [];
  for (const d of priorDates) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("official_setlists").doc(d).get();
    if (snap.exists) docs.push(snap.data() || {});
  }
  return docs;
}

/**
 * Build + write show context. Idempotent merge.
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   setlistDoc?: Record<string, unknown> | null,
 *   showDatesByTour?: unknown,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function writeCommsShowContext({
  db,
  admin,
  showDate,
  setlistDoc = null,
  showDatesByTour = null,
  phishnetRows = null,
  logger,
}) {
  if (!showDate) return null;

  let setlist = setlistDoc;
  if (!setlist) {
    const snap = await db.collection("official_setlists").doc(showDate).get();
    if (!snap.exists) {
      logger?.warn?.("writeCommsShowContext: no official_setlists doc", { showDate });
      return null;
    }
    setlist = snap.data() || {};
  }

  let tourKey = null;
  /** @type {string[]} */
  let priorDates = [];
  if (showDatesByTour) {
    tourKey = resolveTourKeyForDate(showDate, showDatesByTour);
    const tourDates = tourKey ? tourDatesForKey(showDatesByTour, tourKey) : [];
    priorDates = tourDates.filter((d) => d < showDate);
  } else {
    try {
      const calSnap = await db.collection("show_calendar").doc("snapshot").get();
      const byTour = calSnap.exists ? calSnap.data()?.showDatesByTour : null;
      if (byTour) {
        tourKey = resolveTourKeyForDate(showDate, byTour);
        const tourDates = tourKey ? tourDatesForKey(byTour, tourKey) : [];
        priorDates = tourDates.filter((d) => d < showDate);
        showDatesByTour = byTour;
      }
    } catch (e) {
      logger?.warn?.("writeCommsShowContext: calendar load failed", {
        showDate,
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Full prior itinerary — do not trailing-slice (false tour debuts when
  // early-tour songs return after show 12+; Dick's 2026-09-04 Plasma).
  const debutPriorDates = priorDatesForTourDebutLookup(priorDates);
  const priorDocs = debutPriorDates.length
    ? await loadPriorSetlistDocs(db, debutPriorDates)
    : [];

  const lastPlayedByTitle = await loadLastPlayedByTitle(db, tourKey, showDate);
  const playedTitles = Array.isArray(setlist.officialSetlist) ? setlist.officialSetlist : [];
  const lifetimePlaysByTitle = await loadLifetimePlaysByTitle(playedTitles, logger);
  const context = buildCommsShowContext({
    showDate,
    setlistDoc: setlist,
    priorTourSetlistDocs: priorDocs,
    tourKey,
    phishnetRows,
    lastPlayedByTitle,
    lifetimePlaysByTitle,
  });

  const ref = db.collection("comms_show_context").doc(showDate);
  await ref.set(
    {
      ...context,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  logger?.info?.("writeCommsShowContext", {
    showDate,
    tourKey,
    hasHighlight: Boolean(context.setlist_highlight),
    bustouts: context.bustout_titles.length,
    tourDebuts: context.tour_debut_titles.length,
  });

  return context;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} showDate
 */
async function loadCommsShowContext(db, showDate) {
  if (!showDate) return null;
  const snap = await db.collection("comms_show_context").doc(showDate).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

/**
 * Ensure context exists; rebuild if missing or schema behind current.
 * A current doc still refreshes last-played dates so the morning email can
 * pick up the tour table after the night-of push.
 */
async function loadOrWriteCommsShowContext(params) {
  const existing = await loadCommsShowContext(params.db, params.showDate);
  const version = Number(existing?.schemaVersion) || 0;
  if (
    existing?.setlist_highlight &&
    version >= COMMS_SHOW_CONTEXT_SCHEMA_VERSION
  ) {
    const fresh = await loadLastPlayedByTitle(params.db, existing.tourKey, params.showDate);
    const prev = existing.last_played && typeof existing.last_played === "object"
      ? existing.last_played
      : {};
    /** @type {Record<string, unknown>} */
    const patch = {};
    if (JSON.stringify(fresh) !== JSON.stringify(prev) && Object.keys(fresh).length) {
      patch.last_played = fresh;
    }
    const songs = existing.set_songs && typeof existing.set_songs === "object" ? existing.set_songs : {};
    const played = []
      .concat(songs.set1 || [], songs.set2 || [], songs.encore || [])
      .filter((title) => typeof title === "string" && title.trim());
    const plays = await loadLifetimePlaysByTitle(played, params.logger);
    const prevPlays = existing.lifetime_plays && typeof existing.lifetime_plays === "object"
      ? existing.lifetime_plays
      : {};
    if (JSON.stringify(plays) !== JSON.stringify(prevPlays) && Object.keys(plays).length) {
      patch.lifetime_plays = plays;
    }
    if (Object.keys(patch).length) {
      await params.db.collection("comms_show_context").doc(params.showDate).set(patch, { merge: true });
      return { ...existing, ...patch };
    }
    return existing;
  }
  return writeCommsShowContext(params);
}

/**
 * Ensure context exists, then project a public show note when the night
 * clears the richness gate (#684). Projection failures do not block comms.
 */
async function ensureCommsShowContext(params) {
  const context = await loadOrWriteCommsShowContext(params);
  try {
    const { syncPublicShowNote } = require("./publicShowNotes");
    await syncPublicShowNote(params.db, context, params.logger);
  } catch (e) {
    params.logger?.warn?.("public_show_notes sync failed", {
      showDate: params.showDate,
      msg: e instanceof Error ? e.message : String(e),
    });
  }
  return context;
}

/**
 * Lifetime play counts for the songs in one night. A failed catalog read returns {}.
 * @param {string[]} titles
 * @param {{ warn?: Function } | undefined} logger
 * @returns {Promise<Record<string, number>>}
 */
async function loadLifetimePlaysByTitle(titles, logger) {
  const wanted = (titles || []).filter((title) => typeof title === "string" && title.trim());
  if (!wanted.length) return {};
  try {
    const songs = await loadSongCatalogSongs({ fallbackSongs: PHISH_SONGS, logger });
    return lifetimePlaysForTitles(songs, wanted);
  } catch (e) {
    logger?.warn?.("loadLifetimePlaysByTitle failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    return {};
  }
}

module.exports = {
  writeCommsShowContext,
  loadCommsShowContext,
  ensureCommsShowContext,
  showLevelPayloadFields,
  priorDatesForTourDebutLookup,
  COMMS_SHOW_CONTEXT_SCHEMA_VERSION,
};

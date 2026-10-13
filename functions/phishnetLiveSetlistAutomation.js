const crypto = require("node:crypto");

const LIVE_AUTOMATION_COLLECTION = "live_setlist_automation";
const OFFICIAL_SETLISTS_COLLECTION = "official_setlists";
const PHISHNET_API_ROOT = "https://api.phish.net/v5/setlists/showdate";
const MAX_BACKOFF_MINUTES = 30;
const DEFAULT_SHOW_TIME_ZONE = "America/Los_Angeles";

const SLOT_KEYS = ["s1o", "s1c", "s2o", "s2c", "enc"];

/** Minimum shows-since-last-play for a song to count as a bustout. Mirrors SCORING_RULES.BUSTOUT_MIN_GAP. */
const BUSTOUT_MIN_GAP = 30;

/**
 * Two-stage set 1 closer thresholds (#264 follow-up).
 *
 * Phish.net v5 `/setlists/showdate` rows carry no per-song timestamps, so we
 * use poll-time signals:
 *
 * - Provisional stage: `s1c` can surface early once set 1 has run long enough
 *   and set-1 rows have been idle for a shorter window.
 * - Confirmed stage: stronger idle/elapsed threshold (or set 2 start).
 *
 * Long-set safeguard: `buildSetlistDocFromRows` re-derives `s1c` every poll
 * and does not preserve closers across writes. If set 1 continues after a
 * provisional/confirmed stamp, the next set-1 row resets idle and `s1c` clears
 * until one of the stage conditions re-fires.
 */
const PROVISIONAL_SET1_ELAPSED_MS = 75 * 60_000;
const PROVISIONAL_SET1_IDLE_MS = 8 * 60_000;
const CONFIRMED_SET1_ELAPSED_MS = 85 * 60_000;
const CONFIRMED_SET1_IDLE_MS = 12 * 60_000;
// Back-compat aliases used by tests/docs that referenced the original names.
const MIN_SET1_ELAPSED_MS = PROVISIONAL_SET1_ELAPSED_MS;
const SET1_IDLE_MS = PROVISIONAL_SET1_IDLE_MS;

/**
 * Auto-finalize thresholds (issue #266).
 *
 * - `AUTO_FINALIZE_IDLE_MS`: after an encore is reported, the show is
 *   considered finished once no new song has been appended to the setlist
 *   for this long. 25 min is well past the longest realistic encore
 *   transition and still lands well inside the natural 4.5h post-encore
 *   poll window.
 * - `SHOW_SAFETY_CAP_MS`: hard cutoff from first observed row. Fires
 *   finalize even without a detected encore as long as set 2 has at least
 *   one song — protects against the rare Phish.net encore-posting delay.
 */
const AUTO_FINALIZE_IDLE_MS = 25 * 60_000;
const SHOW_SAFETY_CAP_MS = 4.5 * 60 * 60_000;

/**
 * Pure decision function for the auto-finalize step — kept side-effect-free
 * so it can be unit-tested directly without Firestore.
 *
 * @param {object} state
 * @param {number} state.nowMs
 * @param {number | null} state.firstRowObservedAtMs
 * @param {number | null} state.lastRowsChangedAtMs
 * @param {number} state.encoreSongsCount
 * @param {number} state.set2Count
 * @param {boolean} state.alreadyAutoFinalized — true if a prior poll stamped `autoFinalizedAt`.
 * @returns {{ shouldFinalize: boolean, reason?: "encore-idle" | "safety-cap" }}
 */
function evaluateAutoFinalize(state) {
  if (state.alreadyAutoFinalized) {
    return { shouldFinalize: false };
  }
  if (!Number.isFinite(state.firstRowObservedAtMs)) {
    return { shouldFinalize: false };
  }
  const idleSource = Number.isFinite(state.lastRowsChangedAtMs)
    ? state.lastRowsChangedAtMs
    : state.firstRowObservedAtMs;
  const idleMs = state.nowMs - idleSource;
  const elapsedMs = state.nowMs - state.firstRowObservedAtMs;

  if (state.encoreSongsCount >= 1 && idleMs >= AUTO_FINALIZE_IDLE_MS) {
    return { shouldFinalize: true, reason: "encore-idle" };
  }
  if (elapsedMs >= SHOW_SAFETY_CAP_MS && state.set2Count >= 1) {
    return { shouldFinalize: true, reason: "safety-cap" };
  }
  return { shouldFinalize: false };
}

/** Normalize a song title for dedupe/compare (must match `normalizeSong` in scoring code). */
function normalizeSongTitle(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Parse a Phish.net setlist row `gap` field into a non-negative integer or null.
 * Phish.net has returned gap as number or numeric string across versions; treat
 * anything unparseable or negative as "unknown" (null).
 */
function parseRowGap(gap) {
  if (typeof gap === "number" && Number.isFinite(gap) && gap >= 0) {
    return Math.trunc(gap);
  }
  if (typeof gap === "string") {
    const n = Number.parseInt(gap.trim(), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function formatEtShowDate(now = new Date()) {
  const asEt = now.toLocaleString("en-CA", { timeZone: "America/New_York" });
  return String(asEt).slice(0, 10);
}

/** Wall-clock hour 0–23 in `America/New_York` for `now`. */
function getEtHour(now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const hPart = parts.find((p) => p.type === "hour");
  return Number.parseInt(String(hPart?.value ?? "0"), 10);
}

/**
 * True when `timeZone` is an IANA name `Intl` will accept.
 * An invalid name throws from `DateTimeFormat`, which would abort a calendar scan.
 *
 * @param {unknown} timeZone
 * @returns {boolean}
 */
function isValidIanaTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD in any IANA timezone. */
function ymdInTimeZone(now = new Date(), timeZone = DEFAULT_SHOW_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Wall-clock hour 0–23 in any IANA timezone. */
function hourInTimeZone(now = new Date(), timeZone = DEFAULT_SHOW_TIME_ZONE) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const hPart = parts.find((p) => p.type === "hour");
  return Number.parseInt(String(hPart?.value ?? "0"), 10);
}

/**
 * Live setlist scheduled polling window: 4:00 PM ET through 4:00 AM ET the next
 * calendar day (active when hour ≥ 16 or hour < 4, America/New_York wall clock).
 */
function isWithinLiveSetlistPollWindow(now = new Date()) {
  const h = getEtHour(now);
  return h >= 16 || h < 4;
}

/** 4pm–4am local wall-clock window for a specific show timezone. */
function isWithinShowLocalPollWindow(now = new Date(), timeZone = DEFAULT_SHOW_TIME_ZONE) {
  const h = hourInTimeZone(now, timeZone);
  return h >= 16 || h < 4;
}

function ymdDaysAgo(ymd, days) {
  const [y, m, d] = String(ymd)
    .split("-")
    .map((x) => Number.parseInt(x, 10));
  const t = Date.UTC(y, m - 1, d) - days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Admin / manual recovery: ET today + ET yesterday (not gated on show_calendar).
 * Used by `pollLiveSetlistNow` when no explicit date is passed.
 */
function candidateShowDates(now = new Date()) {
  const etToday = formatEtShowDate(now);
  return [etToday, ymdDaysAgo(etToday, 1)];
}

/**
 * Parse `show_calendar/snapshot` into a list of show date records.
 * Returns `null` if missing, empty, or unreadable (strict — scheduled poller must skip).
 */
/**
 * Parse `show_calendar/snapshot` into show records.
 * Always includes `date` + `timeZone`. Passes through venue / city / tour
 * fields when present so comms payloads (tour rankings, lock reminders, etc.)
 * can populate `venue_name` / `next_show_venue` / countdown venue copy.
 *
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} snapshotData
 * @returns {Array<{
 *   date: string,
 *   timeZone: string,
 *   venue?: string,
 *   city?: string,
 *   tour_name?: string,
 *   tour?: string,
 * }> | null}
 */
function parseShowCalendarSnapshotToShows(snapshotData) {
  if (!snapshotData || typeof snapshotData !== "object") return null;
  const raw = snapshotData.showDates;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const shows = [];
  const dedupe = new Set();
  for (const item of raw) {
    const date =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && typeof item.date === "string"
          ? item.date.trim()
          : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (dedupe.has(date)) continue;
    const explicitTz =
      item && typeof item === "object"
        ? typeof item.timeZone === "string" && item.timeZone.trim()
          ? item.timeZone.trim()
          : typeof item.timezone === "string" && item.timezone.trim()
            ? item.timezone.trim()
            : ""
        : "";
    /** @type {{ date: string, timeZone: string, venue?: string, city?: string, tour_name?: string, tour?: string, doorsLocal?: string, scheduledStartLocal?: string, picksLockLocal?: string }} */
    const show = { date, timeZone: explicitTz || DEFAULT_SHOW_TIME_ZONE };
    if (item && typeof item === "object") {
      if (typeof item.venue === "string" && item.venue.trim()) {
        show.venue = item.venue.trim();
      }
      if (typeof item.city === "string" && item.city.trim()) {
        show.city = item.city.trim();
      }
      if (typeof item.tour_name === "string" && item.tour_name.trim()) {
        show.tour_name = item.tour_name.trim();
      }
      if (typeof item.tour === "string" && item.tour.trim()) {
        show.tour = item.tour.trim();
      }
      if (typeof item.doorsLocal === "string" && item.doorsLocal.trim()) {
        show.doorsLocal = item.doorsLocal.trim();
      }
      if (
        typeof item.scheduledStartLocal === "string" &&
        item.scheduledStartLocal.trim()
      ) {
        show.scheduledStartLocal = item.scheduledStartLocal.trim();
      }
      if (typeof item.picksLockLocal === "string" && item.picksLockLocal.trim()) {
        show.picksLockLocal = item.picksLockLocal.trim();
      }
    }
    shows.push(show);
    dedupe.add(date);
  }
  return shows.length > 0 ? shows : null;
}

/**
 * Expand `show_calendar/snapshot.showDatesByTour` into show records with
 * per-tour labels. Used by tour countdown so each tour's first show is
 * independent of older tours also present on the flat `showDates` list (#514).
 *
 * Falls back to flat `parseShowCalendarSnapshotToShows` when `showDatesByTour`
 * is missing/empty (legacy snapshots).
 *
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} snapshotData
 * @returns {Array<{
 *   date: string,
 *   timeZone: string,
 *   venue?: string,
 *   city?: string,
 *   tour?: string,
 *   tour_name?: string,
 * }> | null}
 */
function parseShowCalendarSnapshotToShowsByTour(snapshotData) {
  if (!snapshotData || typeof snapshotData !== "object") return null;
  const groups = snapshotData.showDatesByTour;
  if (!Array.isArray(groups) || groups.length === 0) {
    return parseShowCalendarSnapshotToShows(snapshotData);
  }

  /** @type {Array<{ date: string, timeZone: string, venue?: string, city?: string, tour?: string, tour_name?: string }>} */
  const shows = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const rawShows = Array.isArray(group.shows) ? group.shows : [];
    /** @type {string[]} */
    const groupDates = [];
    for (const item of rawShows) {
      const date =
        item && typeof item === "object" && typeof item.date === "string"
          ? item.date.trim()
          : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) groupDates.push(date);
    }
    groupDates.sort();
    const namedTour =
      typeof group.tour === "string" && group.tour.trim() ? group.tour.trim() : "";
    // Untitled / NPT clusters still need a stable unique key so they do not
    // collapse into the same pseudo-tour as every other unlabeled group.
    const tourKey = namedTour || (groupDates[0] ? `run:${groupDates[0]}` : "");
    if (!tourKey) continue;

    for (const item of rawShows) {
      if (!item || typeof item !== "object") continue;
      const date = typeof item.date === "string" ? item.date.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const explicitTz =
        typeof item.timeZone === "string" && item.timeZone.trim()
          ? item.timeZone.trim()
          : typeof item.timezone === "string" && item.timezone.trim()
            ? item.timezone.trim()
            : "";
      /** @type {{ date: string, timeZone: string, venue?: string, city?: string, tour?: string, tour_name?: string, doorsLocal?: string, scheduledStartLocal?: string, picksLockLocal?: string }} */
      const show = {
        date,
        timeZone: explicitTz || DEFAULT_SHOW_TIME_ZONE,
        tour: tourKey,
        tour_name: namedTour || tourKey,
      };
      if (typeof item.venue === "string" && item.venue.trim()) {
        show.venue = item.venue.trim();
      }
      if (typeof item.city === "string" && item.city.trim()) {
        show.city = item.city.trim();
      }
      if (typeof item.doorsLocal === "string" && item.doorsLocal.trim()) {
        show.doorsLocal = item.doorsLocal.trim();
      }
      if (
        typeof item.scheduledStartLocal === "string" &&
        item.scheduledStartLocal.trim()
      ) {
        show.scheduledStartLocal = item.scheduledStartLocal.trim();
      }
      if (typeof item.picksLockLocal === "string" && item.picksLockLocal.trim()) {
        show.picksLockLocal = item.picksLockLocal.trim();
      }
      shows.push(show);
    }
  }
  return shows.length > 0 ? shows : parseShowCalendarSnapshotToShows(snapshotData);
}

/**
 * Back-compat parser used by tests/consumers that only need date membership.
 * @param {import("firebase-admin").firestore.DocumentData | null | undefined} snapshotData
 */
function parseShowCalendarSnapshotToDateSet(snapshotData) {
  const shows = parseShowCalendarSnapshotToShows(snapshotData);
  if (!shows) return null;
  return new Set(shows.map((s) => s.date));
}

/**
 * Scheduled poller target dates based on each show's local timezone.
 *
 * - Always consider local "today" when that local wall clock is in the active window.
 * - Do not include local "yesterday" by default.
 * - After local midnight (hours 0–3), also include local "yesterday" so a show
 *   can receive encore/post-midnight updates until the 4 AM local window end.
 *   the 4 AM window end. This is **not** comparing two setlists: each `showDate`
 *   doc is still diffed only against its own last saved official payload/signature.
 */
function scheduledCandidateShowDates(now, calendarShows) {
  if (!Array.isArray(calendarShows) || calendarShows.length === 0) return [];
  const todayDates = [];
  const carryoverDates = [];
  for (const show of calendarShows) {
    if (!show || typeof show !== "object") continue;
    const date = typeof show.date === "string" ? show.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const timeZone =
      typeof show.timeZone === "string" && show.timeZone.trim()
        ? show.timeZone.trim()
        : DEFAULT_SHOW_TIME_ZONE;
    if (!isValidIanaTimeZone(timeZone)) continue;
    if (!isWithinShowLocalPollWindow(now, timeZone)) continue;
    const localToday = ymdInTimeZone(now, timeZone);
    const localYesterday = ymdDaysAgo(localToday, 1);
    const localHour = hourInTimeZone(now, timeZone);
    if (date === localToday) todayDates.push(date);
    if (localHour >= 0 && localHour < 4 && date === localYesterday) {
      carryoverDates.push(date);
    }
  }
  return [...new Set([...todayDates, ...carryoverDates])];
}

/**
 * @param {{
 *   set1Count: number,
 *   set2Count: number,
 *   nowMs?: number | null,
 *   firstRowObservedAtMs?: number | null,
 *   lastSet1ChangeAtMs?: number | null,
 * }} state
 * @returns {"confirmed" | "provisional" | null}
 */
function evaluateSet1CloserStage(state) {
  if (!Number.isFinite(state.set1Count) || state.set1Count <= 0) return null;
  if (state.set2Count >= 1) return "confirmed";
  if (
    !Number.isFinite(state.nowMs) ||
    !Number.isFinite(state.firstRowObservedAtMs) ||
    !Number.isFinite(state.lastSet1ChangeAtMs)
  ) {
    return null;
  }
  const elapsedMs = state.nowMs - state.firstRowObservedAtMs;
  const idleMs = state.nowMs - state.lastSet1ChangeAtMs;
  if (elapsedMs >= CONFIRMED_SET1_ELAPSED_MS && idleMs >= CONFIRMED_SET1_IDLE_MS) {
    return "confirmed";
  }
  if (elapsedMs >= PROVISIONAL_SET1_ELAPSED_MS && idleMs >= PROVISIONAL_SET1_IDLE_MS) {
    return "provisional";
  }
  return null;
}

/**
 * Uniform random delay in [90, 150] seconds (~2–3 min) — per-show spacing vs
 * Phish.net after each scheduled wake (#311). Scheduler runs every 2 minutes
 * so `nextPollAt` is re-evaluated promptly.
 */
function randomScheduledPollDelayMs(rng = Math.random) {
  const min = 90 * 1000;
  const max = 150 * 1000;
  return min + Math.floor(rng() * (max - min + 1));
}

function phishNetResponseOk(data) {
  const apiErr = data && typeof data === "object" ? data.error : undefined;
  return (
    apiErr === undefined ||
    apiErr === null ||
    apiErr === false ||
    apiErr === 0 ||
    apiErr === "0"
  );
}

function classifySetLabel(setLabel) {
  const raw = String(setLabel ?? "").trim().toLowerCase();
  if (raw === "e" || raw === "encore" || raw.startsWith("encore")) {
    return { kind: "encore", order: 1000 };
  }
  const m = /^set\s*(\d+)$/.exec(raw);
  if (m) return { kind: "main", order: Number.parseInt(m[1], 10) };
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) return { kind: "main", order: n };
  return { kind: "other", order: 500 };
}

function compareRows(a, b) {
  const ca = classifySetLabel(a.setKey);
  const cb = classifySetLabel(b.setKey);
  if (ca.order !== cb.order) return ca.order - cb.order;
  if (a.position !== b.position) return a.position - b.position;
  return a.title.localeCompare(b.title);
}

function normalizeSetlistRows(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Phish.net payload must be an object.");
  }
  if (!phishNetResponseOk(payload)) {
    const msg =
      typeof payload.error_message === "string"
        ? payload.error_message
        : "Phish.net API error.";
    throw new Error(msg);
  }
  const data = payload.data;
  if (!Array.isArray(data)) {
    throw new Error("Phish.net payload has no data array.");
  }
  const rows = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const song = typeof row.song === "string" ? row.song.trim() : "";
    if (!song) continue;
    const setRaw = row.set;
    const setKey =
      typeof setRaw === "string"
        ? setRaw.trim()
        : typeof setRaw === "number"
        ? String(setRaw)
        : "unknown";
    const position =
      typeof row.position === "number" && Number.isFinite(row.position)
        ? row.position
        : typeof row.idx === "number" && Number.isFinite(row.idx)
        ? row.idx
        : 0;
    const gap = parseRowGap(row.gap);
    rows.push({ setKey: setKey || "unknown", position, title: song, gap });
  }
  rows.sort(compareRows);
  return rows;
}

/**
 * @param {Array<{ setKey: string, position: number, title: string, gap: number | null }>} rows
 * @param {object} [existingDoc] — prior `official_setlists/{showDate}` payload for partial-feed preservation.
 * @param {object} [timing] — optional timing state for the #264 set-1 closer heuristic.
 * @param {number} [timing.nowMs] — wall-clock "now" in epoch ms.
 * @param {number | null} [timing.firstRowObservedAtMs] — epoch ms of the first poll that saw any row for this show.
 * @param {number | null} [timing.lastSet1ChangeAtMs] — epoch ms of the most recent poll where the set-1 title list changed.
 *
 * When `timing` is absent (or inputs are null), behavior falls back to
 * "set 2 started = confirmed", matching pre-#264.
 */
function buildSetlistDocFromRows(rows, existingDoc = {}, timing = null) {
  const officialSetlist = rows.map((r) => r.title).filter(Boolean);
  const slots = {};
  for (const key of SLOT_KEYS) slots[key] = "";

  const bySet = new Map();
  for (const row of rows) {
    if (!bySet.has(row.setKey)) bySet.set(row.setKey, []);
    bySet.get(row.setKey).push(row);
  }
  const set1 = bySet.get("1");
  const set2 = bySet.get("2");
  const encRows = [...bySet.entries()]
    .filter(([k]) => classifySetLabel(k).kind === "encore")
    .flatMap(([, arr]) => arr)
    .sort((a, b) => a.position - b.position);

  const set1CloserStage = evaluateSet1CloserStage({
    set1Count: set1?.length || 0,
    set2Count: set2?.length || 0,
    nowMs: timing?.nowMs,
    firstRowObservedAtMs: timing?.firstRowObservedAtMs,
    lastSet1ChangeAtMs: timing?.lastSet1ChangeAtMs,
  });
  const set1Complete = set1CloserStage != null;
  /** Set 2 closer is unknown until the encore has started. */
  const set2Complete = Boolean(encRows.length);

  if (set1?.length) {
    set1.sort((a, b) => a.position - b.position);
    slots.s1o = set1[0].title;
    if (set1Complete) {
      slots.s1c = set1[set1.length - 1].title;
    }
  }
  if (set2?.length) {
    set2.sort((a, b) => a.position - b.position);
    slots.s2o = set2[0].title;
    if (set2Complete) {
      slots.s2c = set2[set2.length - 1].title;
    }
  }
  const encoreSongsFromRows = encRows.map((r) => r.title).filter(Boolean);
  if (encoreSongsFromRows.length) {
    slots.enc = encoreSongsFromRows[0];
  }

  // Preserve prior slot values when the upstream payload is still partial.
  // Do not preserve set closers: a stale closer would keep wrong live scores until the set ends.
  const prevSlots = existingDoc?.setlist || {};
  const noPreserveKeys = new Set(["s1c", "s2c"]);
  for (const key of SLOT_KEYS) {
    if (noPreserveKeys.has(key)) continue;
    if (!slots[key] && typeof prevSlots[key] === "string" && prevSlots[key].trim()) {
      slots[key] = prevSlots[key].trim();
    }
  }

  const prevEncoreSongs = Array.isArray(existingDoc?.encoreSongs)
    ? existingDoc.encoreSongs.map((t) => String(t ?? "").trim()).filter(Boolean)
    : [];
  const encoreSongs =
    encoreSongsFromRows.length > 0 ? encoreSongsFromRows : prevEncoreSongs;

  // Per-show bustout snapshot from per-row pre-show gap (#214). Phish.net
  // setlist rows expose `gap` = shows since the song was last played prior to
  // this show. Freezing that at save time decouples scoring from the weekly
  // `song-catalog.json` refresh cadence, which would reset to gap ≈ 0 after
  // this show plays and silently erase the bustout boost.
  const bustoutsFromRows = deriveBustoutsFromRows(rows);
  const prevBustouts = Array.isArray(existingDoc?.bustouts)
    ? existingDoc.bustouts
        .map((t) => String(t ?? "").trim())
        .filter(Boolean)
    : [];
  // Live automation may see a partial feed (only set 1 so far). Preserve the
  // wider `bustouts` superset so mid-show polls never shrink the list and
  // erase a bustout captured in a prior poll. Rows that newly appear extend
  // the list; rows that existed but no longer appear (very rare edit) remain.
  const bustouts = mergeBustouts(prevBustouts, bustoutsFromRows);

  // Frozen per-song pre-show gap snapshot (#587 Phase B). Same provenance as
  // `bustouts` (Phish.net row `gap`). The first positive gap sticks. A live
  // 0 is a placeholder and is not stored, and it must not wipe a gap already
  // captured. Songs absent from this poll keep their stored gap.
  const songGaps = mergeSongGaps(existingDoc?.songGaps, deriveSongGapsFromRows(rows));

  return {
    setlist: slots,
    officialSetlist,
    encoreSongs,
    bustouts,
    songGaps,
    set1CloserStage,
  };
}

/**
 * @param {{ title: string, gap: number | null }[]} rows
 * @returns {string[]} original-cased titles, deduped by normalized form
 */
function deriveBustoutsFromRows(rows) {
  const seenNormalized = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row.title !== "string") continue;
    const title = row.title.trim();
    if (!title) continue;
    const gap = typeof row.gap === "number" ? row.gap : parseRowGap(row.gap);
    if (gap == null || gap < BUSTOUT_MIN_GAP) continue;
    const norm = normalizeSongTitle(title);
    if (seenNormalized.has(norm)) continue;
    seenNormalized.add(norm);
    out.push(title);
  }
  return out;
}

/**
 * Freeze per-song pre-show gap from Phish.net rows (#587 Phase B). Keyed by
 * normalized title (lowercased/trimmed — same normalization the standings UI
 * uses to look up by displayed title). Rows with an unknown or negative gap
 * are omitted. First occurrence wins for a repeated normalized title.
 *
 * @param {{ title: string, gap: number | null }[]} rows
 * @returns {Record<string, number>}
 */
function deriveSongGapsFromRows(rows) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const row of rows) {
    if (!row || typeof row.title !== "string") continue;
    const title = row.title.trim();
    if (!title) continue;
    const gap = typeof row.gap === "number" ? row.gap : parseRowGap(row.gap);
    if (gap == null || gap < 0) continue;
    const key = normalizeSongTitle(title);
    if (!key || key in out) continue;
    out[key] = gap;
  }
  return out;
}

/**
 * Merge two `songGaps` maps.
 *
 * The first positive gap for a song sticks, which is the pre-#1062 rule.
 * A later poll must not replace it, including the +1 correction once tonight
 * is in the Phish.net show index.
 *
 * A gap of 0 from the live setlist feed is not stored. During a show that 0
 * is a placeholder (and a correct gap can flip back to 0). It must not wipe
 * a positive gap already captured. A stored 0 is dropped so the next positive
 * poll can record the actual.
 *
 * A stored positive gap is kept when the song is absent from `next`, so a
 * partial set 1 does not wipe set 2. Same-show repeats stay at the first
 * row's gap because `deriveSongGapsFromRows` already drops later rows.
 *
 * @param {unknown} prev
 * @param {unknown} next
 * @returns {Record<string, number>}
 */
function mergeSongGaps(prev, next) {
  /** @type {Record<string, number>} */
  const out = {};
  const keepPositive = (src) => {
    if (!src || typeof src !== "object" || Array.isArray(src)) return;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && out[k] == null) {
        out[k] = v;
      }
    }
  };
  // Stored positives win. Incoming positives fill songs we have not captured.
  keepPositive(prev);
  keepPositive(next);
  return out;
}

/**
 * Union of two bustout string[] lists, deduped by normalized title, preserving
 * the first occurrence's original casing. `prev` takes precedence so the
 * stored casing is stable across polls.
 */
function mergeBustouts(prev, next) {
  const seen = new Set();
  const out = [];
  for (const list of [prev, next]) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const title = typeof raw === "string" ? raw.trim() : "";
      if (!title) continue;
      const norm = normalizeSongTitle(title);
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(title);
    }
  }
  return out;
}

function signatureFromRows(rows) {
  const stable = rows.map((r) => `${r.setKey}|${r.position}|${r.title}`).join("\n");
  return crypto.createHash("sha256").update(stable).digest("hex");
}

/**
 * Stable hash of the set-1 title sequence only, for detecting set-1 changes
 * across polls without being sensitive to set-2/encore activity. Empty when
 * the feed has no set-1 rows yet. Used by `pollSingleShowDate` to update
 * `lastSet1ChangeAt` on the automation doc (issue #264).
 */
function set1TitleSignatureFromRows(rows) {
  const titles = rows
    .filter((r) => classifySetLabel(r.setKey).kind === "main" && r.setKey === "1")
    .sort((a, b) => a.position - b.position)
    .map((r) => r.title)
    .filter(Boolean);
  if (titles.length === 0) return "";
  return crypto.createHash("sha256").update(titles.join("\n")).digest("hex");
}

/** Firestore Timestamp → epoch ms, or null if absent/unreadable. */
function timestampToMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") {
    try {
      return ts.toMillis();
    } catch {
      return null;
    }
  }
  if (typeof ts.seconds === "number") {
    const nanos = typeof ts.nanoseconds === "number" ? ts.nanoseconds : 0;
    return ts.seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  return null;
}

function setlistPayloadEqual(a, b) {
  const aSet = a?.setlist || {};
  const bSet = b?.setlist || {};
  if (JSON.stringify(aSet) !== JSON.stringify(bSet)) return false;
  const aOrder = Array.isArray(a?.officialSetlist) ? a.officialSetlist : [];
  const bOrder = Array.isArray(b?.officialSetlist) ? b.officialSetlist : [];
  if (JSON.stringify(aOrder) !== JSON.stringify(bOrder)) return false;
  const aEnc = Array.isArray(a?.encoreSongs) ? a.encoreSongs : [];
  const bEnc = Array.isArray(b?.encoreSongs) ? b.encoreSongs : [];
  if (JSON.stringify(aEnc) !== JSON.stringify(bEnc)) return false;
  // Compare `bustouts` by normalized set so a pure casing/ordering change
  // does not trigger a re-score write; a real membership change does (#214).
  const aBust = Array.isArray(a?.bustouts) ? a.bustouts : [];
  const bBust = Array.isArray(b?.bustouts) ? b.bustouts : [];
  const aNorm = [...new Set(aBust.map((t) => normalizeSongTitle(t)).filter(Boolean))].sort();
  const bNorm = [...new Set(bBust.map((t) => normalizeSongTitle(t)).filter(Boolean))].sort();
  if (JSON.stringify(aNorm) !== JSON.stringify(bNorm)) return false;
  // Gap-only corrections must persist. Signature ignores `gap`, so a later
  // poll with the same songs would otherwise skip the write (#1062).
  return songGapsMapsEqual(a?.songGaps, b?.songGaps);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function songGapsMapsEqual(a, b) {
  const norm = (src) => {
    /** @type {Record<string, number>} */
    const out = {};
    if (!src || typeof src !== "object" || Array.isArray(src)) return out;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  };
  const left = norm(a);
  const right = norm(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function nextBackoffMinutes(failureCount) {
  const n = Number.isFinite(failureCount) ? Math.max(1, failureCount) : 1;
  return Math.min(2 ** (n - 1), MAX_BACKOFF_MINUTES);
}

async function fetchPhishnetSetlistForDate(showDate, apiKey) {
  const url = `${PHISHNET_API_ROOT}/${encodeURIComponent(
    showDate
  )}.json?apikey=${encodeURIComponent(String(apiKey).trim())}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 240)}`);
  }
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("Phish.net returned non-JSON payload.");
  }
  return payload;
}

/**
 * Side-effectful companion to `evaluateAutoFinalize`: when the pure check
 * says "finalize now", invoke the injected rollup core and stamp
 * `autoFinalizedAt` + `autoFinalizeTrigger` on the automation doc.
 *
 * Also handles the reconciliation case: when a show has already been
 * auto-finalized and a new row-level change lands on a later poll (rare
 * Phish.net post-show edit), re-run the rollup core with
 * `trigger: "auto-reconcile"` so `users.totalPoints` reconciles against
 * the new per-pick scores (delta-based math in `computePerPickRollup`).
 *
 * Returns a small summary object for logging. Never throws — rollup
 * errors are logged and surfaced as `{ fired: false, error }` so a failing
 * rollup does not break the surrounding poll.
 */
async function maybeAutoFinalize({
  db: _db,
  admin,
  showDate,
  automationRef,
  runRollup,
  logger,
  nowMs,
  firstRowObservedAtMs,
  lastRowsChangedAtMs,
  encoreSongsCount,
  set2Count,
  prevAutoFinalizedAtMs,
  rowsChanged,
}) {
  if (!runRollup) {
    return { fired: false, reason: "no-runner" };
  }

  const alreadyAutoFinalized = prevAutoFinalizedAtMs != null;

  // Reconciliation: already finalized once, and Phish.net sent an edit
  // (row-level change). Re-run rollup to reconcile users.totalPoints.
  if (alreadyAutoFinalized && rowsChanged) {
    try {
      const result = await runRollup({
        showDate,
        trigger: "auto-reconcile",
      });
      if (result.hollowSetlist) {
        logger?.warn?.("auto-finalize reconcile skipped: hollow setlist", {
          showDate,
        });
        return {
          fired: false,
          trigger: "auto-reconcile",
          reason: "hollow-setlist",
          result,
        };
      }
      return { fired: true, trigger: "auto-reconcile", result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.error?.("auto-finalize reconcile failed", { showDate, msg });
      return { fired: false, trigger: "auto-reconcile", error: msg };
    }
  }

  // Idempotency: already finalized, no new rows → nothing to do.
  if (alreadyAutoFinalized) {
    return { fired: false, reason: "already-finalized" };
  }

  const decision = evaluateAutoFinalize({
    nowMs,
    firstRowObservedAtMs,
    lastRowsChangedAtMs,
    encoreSongsCount,
    set2Count,
    alreadyAutoFinalized: false,
  });
  if (!decision.shouldFinalize) {
    return { fired: false };
  }

  try {
    const result = await runRollup({ showDate, trigger: "auto" });
    if (result.hollowSetlist) {
      logger?.warn?.("auto-finalize skipped: hollow setlist", {
        showDate,
        reason: decision.reason,
      });
      return {
        fired: false,
        trigger: "auto",
        reason: "hollow-setlist",
        result,
      };
    }
    // Stamp post-rollup so a rollup failure doesn't leave a misleading
    // "already finalized" flag that would suppress future retries.
    await automationRef.set(
      {
        autoFinalizedAt: admin.firestore.Timestamp.fromMillis(nowMs),
        autoFinalizeTrigger: decision.reason,
      },
      { merge: true }
    );
    return {
      fired: true,
      trigger: "auto",
      reason: decision.reason,
      result,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.error?.("auto-finalize run failed", {
      showDate,
      reason: decision.reason,
      msg,
    });
    return { fired: false, trigger: "auto", error: msg };
  }
}

async function pollSingleShowDate({
  db,
  admin,
  showDate,
  apiKey,
  logger,
  force = false,
  requestorEmail = null,
  // Injected by `functions/index.js` so the poller can auto-finalize without
  // going through the HTTPS callable path (#266). Left optional (null) so
  // existing tests and any future caller that doesn't want auto-finalize
  // keep working unchanged.
  runRollup = null,
}) {
  const started = Date.now();
  const automationRef = db.collection(LIVE_AUTOMATION_COLLECTION).doc(showDate);
  const setlistRef = db.collection(OFFICIAL_SETLISTS_COLLECTION).doc(showDate);
  const [automationSnap, setlistSnap] = await Promise.all([
    automationRef.get(),
    setlistRef.get(),
  ]);
  const automation = automationSnap.exists ? automationSnap.data() || {} : {};
  if (!force && automation.enabled === false) {
    return { showDate, skipped: "paused", changed: false, updatedPicks: 0 };
  }

  const now = Date.now();
  const nextPollAtMs =
    automation?.nextPollAt && typeof automation.nextPollAt.toMillis === "function"
      ? automation.nextPollAt.toMillis()
      : null;
  if (!force && nextPollAtMs != null && nextPollAtMs > now) {
    return { showDate, skipped: "backoff", changed: false, updatedPicks: 0 };
  }

  const scheduledCadenceStamp = () =>
    !force
      ? {
          nextPollAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + randomScheduledPollDelayMs())
          ),
        }
      : {};

  try {
    const payload = await fetchPhishnetSetlistForDate(showDate, apiKey);
    const rows = normalizeSetlistRows(payload);
    if (rows.length === 0) {
      if (!force) {
        await automationRef.set(
          {
            showDate,
            enabled: automation.enabled !== false,
            failureCount: 0,
            lastPolledAt: admin.firestore.FieldValue.serverTimestamp(),
            lastResult: "no-rows",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...scheduledCadenceStamp(),
          },
          { merge: true }
        );
      }
      return { showDate, changed: false, updatedPicks: 0, reason: "no-rows" };
    }

    const signature = signatureFromRows(rows);
    const prev = setlistSnap.exists ? setlistSnap.data() || {} : {};
    const prevSignature =
      prev?.sourceMeta && typeof prev.sourceMeta.signature === "string"
        ? prev.sourceMeta.signature
        : null;

    // Timing state for the #264 set-1 closer heuristic. `firstRowObservedAt`
    // is stamped on the first poll that sees any row for this show and never
    // overwritten. `lastSet1ChangeAt` is stamped whenever the set-1 title
    // sequence changes (new song appended, reorder, rename) — detected via a
    // separate sha256 of set-1 titles only so set-2 / encore activity does
    // not reset the set-1 idle clock.
    const nowMs = Date.now();
    const prevFirstRowObservedAtMs = timestampToMs(automation.firstRowObservedAt);
    const prevLastSet1ChangeAtMs = timestampToMs(automation.lastSet1ChangeAt);
    const prevSet1Sig =
      typeof automation.set1TitleSignature === "string"
        ? automation.set1TitleSignature
        : "";
    const currSet1Sig = set1TitleSignatureFromRows(rows);
    const firstRowObservedAtMs =
      prevFirstRowObservedAtMs != null ? prevFirstRowObservedAtMs : nowMs;
    const set1ChangedThisPoll =
      currSet1Sig !== "" && currSet1Sig !== prevSet1Sig;
    const lastSet1ChangeAtMs =
      currSet1Sig === ""
        ? null
        : set1ChangedThisPoll
        ? nowMs
        : prevLastSet1ChangeAtMs != null
        ? prevLastSet1ChangeAtMs
        : nowMs;

    const timingForBuild = {
      nowMs,
      firstRowObservedAtMs,
      lastSet1ChangeAtMs,
    };
    const nextPayload = buildSetlistDocFromRows(rows, prev, timingForBuild);

    // Full-rows change detection (distinct from set-1 signature; used for
    // #266 auto-finalize idle). A row-level change is any mismatch between
    // the prior setlist-doc signature and the current one. On the very
    // first poll (no prior signature), rows are considered changed.
    const rowsChanged = prevSignature !== signature;
    const prevLastRowsChangedAtMs = timestampToMs(automation.lastRowsChangedAt);
    const lastRowsChangedAtMs = rowsChanged
      ? nowMs
      : prevLastRowsChangedAtMs != null
      ? prevLastRowsChangedAtMs
      : firstRowObservedAtMs;

    const prevSet1CloserStage =
      automation.s1cStage === "provisional" || automation.s1cStage === "confirmed"
        ? automation.s1cStage
        : null;
    const nextSet1CloserStage =
      nextPayload.set1CloserStage === "provisional" ||
      nextPayload.set1CloserStage === "confirmed"
        ? nextPayload.set1CloserStage
        : null;
    const set1CloserStateUpdate =
      nextSet1CloserStage == null
        ? prevSet1CloserStage
          ? {
              s1cStage: admin.firestore.FieldValue.delete(),
              s1cProvisionalAt: admin.firestore.FieldValue.delete(),
              s1cConfirmedAt: admin.firestore.FieldValue.delete(),
            }
          : {}
        : {
            s1cStage: nextSet1CloserStage,
            ...(nextSet1CloserStage === "provisional" &&
            prevSet1CloserStage !== "provisional"
              ? {
                  s1cProvisionalAt: admin.firestore.Timestamp.fromMillis(nowMs),
                }
              : {}),
            ...(nextSet1CloserStage === "confirmed" &&
            prevSet1CloserStage !== "confirmed"
              ? {
                  s1cConfirmedAt: admin.firestore.Timestamp.fromMillis(nowMs),
                }
              : {}),
          };

    // Merge timing-state updates into every automation write below so the
    // next poll has monotonic anchors. Stamp `firstRowObservedAt` only on
    // first observation; update `lastSet1ChangeAt` + `set1TitleSignature`
    // only when the set-1 title sequence actually changed; update
    // `lastRowsChangedAt` whenever the full-rows signature changed; and track
    // two-stage set-1 closer state (`s1cStage` + stage timestamps).
    const timingStateUpdate = {
      ...(prevFirstRowObservedAtMs == null
        ? {
            firstRowObservedAt: admin.firestore.Timestamp.fromMillis(
              firstRowObservedAtMs
            ),
          }
        : {}),
      ...(set1ChangedThisPoll
        ? {
            lastSet1ChangeAt: admin.firestore.Timestamp.fromMillis(nowMs),
            set1TitleSignature: currSet1Sig,
          }
        : {}),
      ...(rowsChanged
        ? {
            lastRowsChangedAt: admin.firestore.Timestamp.fromMillis(nowMs),
          }
        : {}),
      ...set1CloserStateUpdate,
    };

    // Context for the #266 auto-finalize step (runs after either write
    // branch below). Computed once to keep the two call sites consistent.
    const prevAutoFinalizedAtMs = timestampToMs(automation.autoFinalizedAt);
    const encoreSongsCount = Array.isArray(nextPayload.encoreSongs)
      ? nextPayload.encoreSongs.length
      : 0;
    const set2Count = rows.reduce(
      (n, r) => (r.setKey === "2" ? n + 1 : n),
      0
    );
    const autoFinalizeContext = {
      db,
      admin,
      showDate,
      automationRef,
      runRollup,
      logger,
      nowMs,
      firstRowObservedAtMs,
      lastRowsChangedAtMs,
      encoreSongsCount,
      set2Count,
      prevAutoFinalizedAtMs,
      rowsChanged,
    };

    // Use AND here (previously OR): once #264 timing can flip `s1c` without
    // any row change, two polls with the same `signature` can still produce
    // different built docs, and we must write the newer one. Payload-equal
    // alone is the authoritative "nothing to persist" test.
    if (prevSignature === signature && setlistPayloadEqual(prev, nextPayload)) {
      await automationRef.set(
        {
          showDate,
          enabled: automation.enabled !== false,
          failureCount: 0,
          lastPolledAt: admin.firestore.FieldValue.serverTimestamp(),
          lastResult: "no-change",
          lastNoChangeAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...timingStateUpdate,
          ...scheduledCadenceStamp(),
        },
        { merge: true }
      );
      const autoFinalize = await maybeAutoFinalize(autoFinalizeContext);
      return {
        showDate,
        changed: false,
        updatedPicks: 0,
        reason: "unchanged",
        autoFinalize,
      };
    }

    const setlistPayload = {
      showDate,
      status: "LIVE",
      isScored: false,
      setlist: nextPayload.setlist,
      officialSetlist: nextPayload.officialSetlist,
      encoreSongs: nextPayload.encoreSongs || [],
      bustouts: nextPayload.bustouts || [],
      songGaps: nextPayload.songGaps || {},
      updatedBy: requestorEmail || "setlist-automation",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceMeta: {
        source: "phishnet",
        signature,
        songCount: rows.length,
        lastFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
        pollMode: force ? "manual" : "scheduled",
      },
    };
    const automationPayload = {
      showDate,
      enabled: automation.enabled !== false,
      failureCount: 0,
      lastPolledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastResult: "changed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...timingStateUpdate,
      ...scheduledCadenceStamp(),
    };
    const batch = db.batch();
    batch.set(setlistRef, setlistPayload, { merge: true });
    batch.set(automationRef, automationPayload, { merge: true });
    await batch.commit();
    try {
      const { writeCommsShowContext } = require("./commsShowContext");
      await writeCommsShowContext({
        db,
        admin,
        showDate,
        setlistDoc: {
          ...setlistPayload,
          s1o: nextPayload.setlist?.s1o,
          s2o: nextPayload.setlist?.s2o,
          enc: nextPayload.setlist?.enc,
          ...nextPayload.setlist,
        },
        phishnetRows: rows,
        logger,
      });
    } catch (ctxErr) {
      logger?.warn?.("comms_show_context write failed after setlist poll", {
        showDate,
        msg: ctxErr instanceof Error ? ctxErr.message : String(ctxErr),
      });
    }
    const autoFinalize = await maybeAutoFinalize(autoFinalizeContext);
    return {
      showDate,
      changed: true,
      updatedPicks: null,
      durationMs: Date.now() - started,
      autoFinalize,
    };
  } catch (e) {
    const failureCount = Number(automation.failureCount || 0) + 1;
    const backoffMinutes = nextBackoffMinutes(failureCount);
    const nextPollAt = new Date(Date.now() + backoffMinutes * 60_000);
    await automationRef.set(
      {
        showDate,
        enabled: automation.enabled !== false,
        failureCount,
        nextPollAt: admin.firestore.Timestamp.fromDate(nextPollAt),
        lastResult: "error",
        lastError: e instanceof Error ? e.message : String(e),
        lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger?.error?.("live setlist poll failed", {
      showDate,
      failureCount,
      backoffMinutes,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      showDate,
      changed: false,
      updatedPicks: 0,
      error: e instanceof Error ? e.message : String(e),
      failureCount,
      backoffMinutes,
    };
  }
}

module.exports = {
  AUTO_FINALIZE_IDLE_MS,
  BUSTOUT_MIN_GAP,
  CONFIRMED_SET1_ELAPSED_MS,
  CONFIRMED_SET1_IDLE_MS,
  MIN_SET1_ELAPSED_MS,
  PROVISIONAL_SET1_ELAPSED_MS,
  PROVISIONAL_SET1_IDLE_MS,
  SET1_IDLE_MS,
  SHOW_SAFETY_CAP_MS,
  buildSetlistDocFromRows,
  candidateShowDates,
  deriveBustoutsFromRows,
  deriveSongGapsFromRows,
  evaluateAutoFinalize,
  evaluateSet1CloserStage,
  fetchPhishnetSetlistForDate,
  getEtHour,
  hourInTimeZone,
  isWithinLiveSetlistPollWindow,
  isWithinShowLocalPollWindow,
  normalizeSetlistRows,
  parseShowCalendarSnapshotToDateSet,
  parseShowCalendarSnapshotToShows,
  parseShowCalendarSnapshotToShowsByTour,
  pollSingleShowDate,
  randomScheduledPollDelayMs,
  scheduledCandidateShowDates,
  set1TitleSignatureFromRows,
  setlistPayloadEqual,
  signatureFromRows,
  isValidIanaTimeZone,
  ymdInTimeZone,
};

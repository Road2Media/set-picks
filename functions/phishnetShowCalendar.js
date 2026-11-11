/**
 * Phish.net v5 → Firestore show calendar (issue #160).
 *
 * Endpoints (GET, `apikey` query param):
 * - `https://api.phish.net/v5/shows/showyear/{year}.json?order_by=showdate&apikey=…`
 *
 * Rows: `showdate`, `venue`, `city`, `state`, `country`, `artistid`, `tour_name`,
 * `exclude_from_stats` (omit soundchecks / non-counting rows when truthy).
 */

const {
  fetchOfficialPhishSchedule,
} = require("./phishOfficialSchedule");
const { stampPreservedEdition } = require("./calendarEdition");
const {
  GENERIC_TOUR,
  buildVenueLine,
  fetchShowsForYear: fetchShowsPayload,
  normalizeShows,
  responseOk: phishNetResponseOk,
} = require("./providers/phishnet");
const { phishProviderArgs } = require("./providers/registry");

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** @param {string} ymd */
function parseYmd(ymd) {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return { y, m, d };
}

/** @param {string} a @param {string} b */
function daysBetweenYmd(a, b) {
  const A = parseYmd(a);
  const B = parseYmd(b);
  const t0 = Date.UTC(A.y, A.m - 1, A.d);
  const t1 = Date.UTC(B.y, B.m - 1, B.d);
  return Math.round((t1 - t0) / 86400000);
}

/**
 * @param {string} firstYmd
 * @param {string} lastYmd
 */
function formatRunTourLabel(firstYmd, lastYmd) {
  const f = parseYmd(firstYmd);
  const l = parseYmd(lastYmd);
  if (f.y === l.y && f.m === l.m) {
    if (f.d === l.d) {
      return `${MONTHS[f.m - 1]} ${f.d}, ${f.y}`;
    }
    return `${MONTHS[f.m - 1]} ${f.d}–${l.d}, ${f.y}`;
  }
  if (f.y === l.y) {
    return `${MONTHS[f.m - 1]} ${f.d} – ${MONTHS[l.m - 1]} ${l.d}, ${f.y}`;
  }
  return `${MONTHS[f.m - 1]} ${f.d}, ${f.y} – ${MONTHS[l.m - 1]} ${l.d}, ${l.y}`;
}

const MAX_GAP_DAYS = 14;

/**
 * Friendly optgroup titles for Phish.net **"Not Part of a Tour"** clusters only.
 *
 * **Strategy:** Rules run in order; first match wins; else date-span fallback.
 * Final labels in Firestore also apply **tour_overrides** and **previous
 * snapshot** (see `mergeToursWithSnapshotPreservation`).
 *
 * **Named tours** from Phish.net (`tour_name` ≠ NPT, e.g. `2026 Mexico`) are
 * **not** passed through here; they stay as the API string in `buildShowDatesByTour`.
 *
 * @param {{ date: string, venue: string }[]} shows
 * @param {string} firstDate — YYYY-MM-DD
 * @param {string} lastDate — YYYY-MM-DD
 * @returns {string}
 */
function labelGenericCluster(shows, firstDate, lastDate) {
  if (!shows.length) {
    return formatRunTourLabel(firstDate, lastDate);
  }

  const venueOf = (s) => String(s.venue ?? "");

  // 1) Sphere — band treats Sphere as its own tour; Phish.net is usually NPT here.
  if (shows.every((s) => /^\s*Sphere\s*,/i.test(venueOf(s)))) {
    return "Sphere Run";
  }

  // 2) Mexico resort legs (NPT rows; named "2026 Mexico" is handled as non-generic upstream)
  if (
    shows.every((s) =>
      /Mexico|Cancun|Moon Palace|Quintana Roo|Q\.R\./i.test(venueOf(s))
    )
  ) {
    return `${parseYmd(firstDate).y} Mexico`;
  }

  const fy = parseYmd(firstDate).y;
  const ly = parseYmd(lastDate).y;
  if (fy !== ly) {
    return formatRunTourLabel(firstDate, lastDate);
  }

  // 3) US/Canada summer (includes Dick’s / sheds per phish.com-style grouping; not a separate leg)
  const inSummerMonth = shows.filter((s) => {
    const m = parseYmd(s.date).m;
    return m >= 6 && m <= 9;
  }).length;
  const needSummer = Math.max(1, Math.ceil(shows.length / 2));
  if (inSummerMonth >= needSummer) {
    const notTropical = shows.every(
      (s) => !/Mexico|Cancun|Moon Palace|Quintana Roo/i.test(venueOf(s))
    );
    if (notTropical) {
      return `Summer Tour ${fy}`;
    }
  }

  return formatRunTourLabel(firstDate, lastDate);
}

/**
 * @param {import('firebase/firestore').DocumentData | null | undefined} prevData
 * @returns {Map<string, string>} showdate → tour label from last published snapshot
 */
function flattenSnapshotTourByDate(prevData) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!prevData || typeof prevData !== "object") return map;
  const groups = prevData.showDatesByTour;
  if (!Array.isArray(groups)) return map;
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const tour = typeof g.tour === "string" ? g.tour.trim() : "";
    const gShows = g.shows;
    if (!tour || !Array.isArray(gShows)) continue;
    for (const s of gShows) {
      if (!s || typeof s !== "object") continue;
      const d = typeof s.date === "string" ? s.date.trim() : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) map.set(d, tour);
    }
  }
  return map;
}

/**
 * Preserve official timing when Phish.com is temporarily unavailable.
 *
 * @param {import('firebase-admin').firestore.DocumentData | null | undefined} prevData
 * @returns {Map<string, {
 *   doorsLocal?: string,
 *   scheduledStartLocal?: string,
 *   scheduleSource?: string,
 *   scheduleSourceUrl?: string
 * }>}
 */
function flattenSnapshotScheduleByDate(prevData) {
  const out = new Map();
  const raw = Array.isArray(prevData?.showDates) ? prevData.showDates : [];
  for (const show of raw) {
    if (!show || typeof show !== "object") continue;
    const date = typeof show.date === "string" ? show.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const timing = {};
    for (const field of [
      "doorsLocal",
      "scheduledStartLocal",
      "scheduleSource",
      "scheduleSourceUrl",
    ]) {
      if (typeof show[field] === "string" && show[field].trim()) {
        timing[field] = show[field].trim();
      }
    }
    if (Object.keys(timing).length > 0) out.set(date, timing);
  }
  return out;
}

/**
 * @param {{ tour: string, shows: Record<string, unknown>[] }[]} groups
 * @param {Map<string, Record<string, unknown>>} officialByDate
 * @param {Map<string, Record<string, unknown>>} previousByDate
 */
function enrichGroupsWithOfficialSchedule(
  groups,
  officialByDate,
  previousByDate
) {
  return groups.map((group) => ({
    ...group,
    shows: group.shows.map((show) => {
      const timing =
        officialByDate.get(String(show.date)) ??
        previousByDate.get(String(show.date)) ??
        null;
      if (!timing) return show;
      const {
        date: _sourceDate,
        ...timingFields
      } = timing;
      return { ...show, ...timingFields };
    }),
  }));
}

/**
 * Manual per-date labels (Firebase Console). Structure:
 * `{ byShowDate: { "2026-09-04": "Summer Tour 2026" } }`
 * @param {import('firebase/firestore').DocumentData | null | undefined} data
 * @returns {Map<string, string>}
 */
function parseTourOverridesDoc(data) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!data || typeof data !== "object") return map;
  const raw = data.byShowDate ?? data.by_show_date;
  if (!raw || typeof raw !== "object") return map;
  for (const [k, v] of Object.entries(raw)) {
    const date = String(k).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (typeof v !== "string" || !v.trim()) continue;
    map.set(date, v.trim());
  }
  return map;
}

/**
 * @param {{ tour: string, shows: { date: string, venue: string }[] }[]} groups
 * @returns {Map<string, string>}
 */
function computedTourByDateFromGroups(groups) {
  /** @type {Map<string, string>} */
  const m = new Map();
  for (const g of groups) {
    for (const s of g.shows) {
      m.set(s.date, g.tour);
    }
  }
  return m;
}

/**
 * Phish.net `tour_name` when not generic — can update retrospectively on their side;
 * we prefer it over a preserved snapshot label for consistency.
 * @param {{ date: string, venue: string, tour_name: string }[]} shows
 * @returns {Map<string, string>}
 */
function buildApiNamedTourByDate(shows) {
  /** @type {Map<string, string>} */
  const m = new Map();
  for (const s of shows) {
    const t = String(s.tour_name ?? "").trim();
    if (!t || t === GENERIC_TOUR) continue;
    m.set(s.date, t);
  }
  return m;
}

/**
 * Regroup flat shows when per-date tour strings may differ from Phish.net clustering.
 * @param {{ date: string, venue: string, city?: string, timeZone: string }[]} flatSorted
 * @param {(date: string) => string} tourFor
 */
function regroupConsecutiveTours(flatSorted, tourFor) {
  /** @type {{ tour: string, shows: { date: string, venue: string, city: string, timeZone: string }[] }[]} */
  const out = [];
  let cur = /** @type {{ tour: string, shows: { date: string, venue: string, city: string, timeZone: string }[] } | null} */ (
    null
  );
  for (const s of flatSorted) {
    const t = tourFor(s.date);
    const label = String(t || "").trim() || "Unknown tour";
    if (!cur || cur.tour !== label) {
      cur = { tour: label, shows: [] };
      out.push(cur);
    }
    cur.shows.push({
      date: s.date,
      venue: s.venue,
      city: typeof s.city === "string" ? s.city : "",
      timeZone: s.timeZone,
    });
  }
  return out;
}

/**
 * @param {{ date: string, venue: string, tour_name: string, timeZone: string }[]} shows — sorted ascending by date
 * @param {{ tour: string, shows: { date: string, venue: string, timeZone: string }[] }[]} computedGroups — from buildShowDatesByTour
 * @param {Map<string, string>} prevTourByDate
 * @param {Map<string, string>} overridesByDate
 * @param {{ isFirstSnapshot: boolean }}
 *
 * Priority: **manual overrides** → **Phish.net named `tour_name`** (≠ NPT) →
 * **previous snapshot** → **computed** (heuristics + NPT clustering).
 */
function mergeToursWithSnapshotPreservation(
  shows,
  computedGroups,
  prevTourByDate,
  overridesByDate,
  { isFirstSnapshot }
) {
  const computedByDate = computedTourByDateFromGroups(computedGroups);
  const apiNamedByDate = buildApiNamedTourByDate(shows);
  const flat = shows.map((s) => ({
    date: s.date,
    venue: s.venue,
    city: typeof s.city === "string" ? s.city : "",
    timeZone: s.timeZone,
  }));

  function tourFor(date) {
    if (overridesByDate.has(date)) return /** @type {string} */ (overridesByDate.get(date));
    if (apiNamedByDate.has(date)) return /** @type {string} */ (apiNamedByDate.get(date));
    if (prevTourByDate.has(date)) return /** @type {string} */ (prevTourByDate.get(date));
    const c = computedByDate.get(date);
    if (c && String(c).trim()) return c;
    return formatRunTourLabel(date, date);
  }

  const showDatesByTour = regroupConsecutiveTours(flat, tourFor);

  /** @type {{ date: string, venue: string, suggestedTour: string, note: string }[]} */
  const reviewQueue = [];
  if (!isFirstSnapshot) {
    for (const s of flat) {
      if (prevTourByDate.has(s.date)) continue;
      if (overridesByDate.has(s.date)) continue;
      const suggested =
        apiNamedByDate.get(s.date) ??
        computedByDate.get(s.date) ??
        formatRunTourLabel(s.date, s.date);
      reviewQueue.push({
        date: s.date,
        venue: s.venue,
        suggestedTour: suggested,
        note: "New date vs last snapshot — confirm tour name; set show_calendar/tour_overrides.byShowDate if needed.",
      });
    }
  }

  return { showDatesByTour, reviewQueue };
}

/**
 * Year rows from the phishnet provider. Same array `fetchAllShowsNormalized`
 * combined before this move. The provider returns the envelope and does not
 * filter; this wrapper still returns `data` (or `[]`).
 *
 * @param {string} year
 * @param {string} apiKey
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function fetchShowsForYear(year, apiKey) {
  const payload = await fetchShowsPayload(year, phishProviderArgs(apiKey));
  const rows = payload && typeof payload === "object" ? payload.data : undefined;
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {Record<string, unknown>[]} rawRows
 * @returns {{ date: string, venue: string, city: string, tour_name: string, timeZone: string }[]}
 */
function normalizePhishShows(rawRows) {
  return normalizeShows(rawRows, phishProviderArgs());
}

/**
 * @param {{ date: string, venue: string, city?: string, tour_name: string, timeZone: string }[]} shows
 * @returns {{ tour: string, shows: { date: string, venue: string, city: string, timeZone: string }[] }[]}
 */
function buildShowDatesByTour(shows) {
  if (shows.length === 0) return [];

  /** @type {string[]} */
  const orderedKeys = [];
  /** @type {Map<string, { tour: string, shows: { date: string, venue: string, city: string, timeZone: string }[], firstDate: string, lastDate: string, isGeneric: boolean }>} */
  const map = new Map();

  let prev = /** @type {typeof shows[0] | null} */ (null);
  let prevKey = /** @type {string | null} */ (null);

  for (const s of shows) {
    const isGeneric = !s.tour_name || s.tour_name === GENERIC_TOUR;
    let key;
    if (!isGeneric) {
      key = `t:${s.tour_name}`;
    } else if (
      prev &&
      prevKey != null &&
      prevKey.startsWith("g:") &&
      daysBetweenYmd(prev.date, s.date) <= MAX_GAP_DAYS
    ) {
      key = prevKey;
    } else {
      key = `g:${s.date}`;
    }

    if (!map.has(key)) {
      map.set(key, {
        tour: isGeneric ? "" : s.tour_name,
        shows: [],
        firstDate: s.date,
        lastDate: s.date,
        isGeneric,
      });
      orderedKeys.push(key);
    }

    const g = map.get(key);
    if (!g) continue;
    g.shows.push({
      date: s.date,
      venue: s.venue,
      city: typeof s.city === "string" ? s.city : "",
      timeZone: s.timeZone,
    });
    g.lastDate = s.date;

    prev = s;
    prevKey = key;
  }

  for (const k of orderedKeys) {
    const g = map.get(k);
    if (!g) continue;
    if (g.isGeneric) {
      g.tour = labelGenericCluster(g.shows, g.firstDate, g.lastDate);
    }
  }

  return orderedKeys.map((k) => {
    const g = map.get(k);
    return { tour: g.tour, shows: g.shows };
  });
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {number} [opts.minYear]
 * @param {number} [opts.maxYear]
 */
async function fetchAllShowsNormalized({ apiKey, minYear, maxYear }) {
  const y0 = minYear ?? new Date().getUTCFullYear() - 2;
  const y1 = maxYear ?? new Date().getUTCFullYear() + 1;
  /** @type {Record<string, unknown>[]} */
  const combined = [];
  for (let y = y0; y <= y1; y += 1) {
    const chunk = await fetchShowsForYear(String(y), apiKey);
    combined.push(...chunk);
  }
  return normalizePhishShows(combined);
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} apiKey
 * @param {{ logger?: { error: Function, info: Function } }} [ctx]
 */
async function syncPhishnetShowCalendarToFirestore(db, apiKey, ctx) {
  const logger = ctx?.logger;
  const ref = db.collection("show_calendar").doc("snapshot");
  const overridesRef = db.collection("show_calendar").doc("tour_overrides");

  try {
    const [prevSnap, overridesSnap] = await Promise.all([
      ref.get(),
      overridesRef.get(),
    ]);

    const prevTourByDate = flattenSnapshotTourByDate(
      prevSnap.exists ? prevSnap.data() : null
    );
    const prevScheduleByDate = flattenSnapshotScheduleByDate(
      prevSnap.exists ? prevSnap.data() : null
    );
    const overridesByDate = parseTourOverridesDoc(
      overridesSnap.exists ? overridesSnap.data() : null
    );
    const isFirstSnapshot =
      !prevSnap.exists || prevTourByDate.size === 0;

    const shows = await fetchAllShowsNormalized({ apiKey });
    const computedGroups = buildShowDatesByTour(shows);
    const { showDatesByTour: groupedShows, reviewQueue } =
      mergeToursWithSnapshotPreservation(
        shows,
        computedGroups,
        prevTourByDate,
        overridesByDate,
        { isFirstSnapshot }
      );
    let officialScheduleByDate = new Map();
    try {
      officialScheduleByDate = await fetchOfficialPhishSchedule({ logger });
    } catch (scheduleError) {
      logger?.warn?.("phish.com schedule enrichment failed; preserving prior timing", {
        error:
          scheduleError instanceof Error
            ? scheduleError.message
            : String(scheduleError),
      });
    }
    const showDatesByTour = stampPreservedEdition(
      enrichGroupsWithOfficialSchedule(
        groupedShows,
        officialScheduleByDate,
        prevScheduleByDate
      ),
      prevSnap.exists ? prevSnap.data() : null
    );
    const flat = showDatesByTour.flatMap((g) => g.shows);

    await ref.set(
      {
        schemaVersion: 2,
        source: "phishnet+phish.com",
        updatedAt: new Date(),
        showDatesByTour,
        showDates: flat,
        reviewQueue,
        syncError: null,
      },
      { merge: false }
    );

    logger?.info?.("show calendar sync ok", {
      shows: flat.length,
      groups: showDatesByTour.length,
      reviewNewDates: reviewQueue.length,
      preservedDates: prevTourByDate.size,
      officialTimedShows: officialScheduleByDate.size,
      preservedTimedShows: prevScheduleByDate.size,
    });
    return { showCount: flat.length, groupCount: showDatesByTour.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.error?.("show calendar sync failed", msg);
    try {
      await ref.set(
        { syncError: msg, updatedAt: new Date() },
        { merge: true }
      );
    } catch (writeErr) {
      logger?.error?.("show calendar sync error stamp failed", writeErr);
    }
    throw e;
  }
}

module.exports = {
  buildApiNamedTourByDate,
  buildShowDatesByTour,
  buildVenueLine,
  fetchAllShowsNormalized,
  flattenSnapshotScheduleByDate,
  flattenSnapshotTourByDate,
  enrichGroupsWithOfficialSchedule,
  labelGenericCluster,
  mergeToursWithSnapshotPreservation,
  normalizePhishShows,
  parseTourOverridesDoc,
  regroupConsecutiveTours,
  syncPhishnetShowCalendarToFirestore,
  phishNetResponseOk,
};

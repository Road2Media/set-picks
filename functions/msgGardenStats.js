/**
 * Nightly aggregate for `/tour-stats/msg` (#1139).
 * Writes `public_venue_stats/msg` only. Does not store setlists.
 * Phish.net source rows are fetched and discarded in the same run.
 */
const { isPhishNetPayloadOk } = require("./phishnetSongCatalog");

const MSG_VENUE_ID = 157;
const MIN_SHOW_COUNT = 90;
const DOC_PATH = "public_venue_stats";
const DOC_ID = "msg";

/**
 * @param {string} apiKey
 * @param {string} path path after `/v5/`, without `.json`
 */
async function fetchPhishnetRows(apiKey, path) {
  const url = `https://api.phish.net/v5/${path}.json?apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Phish.net ${res.status} for ${path}`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Phish.net invalid JSON for ${path}`);
  }
  if (!isPhishNetPayloadOk(payload)) {
    throw new Error(payload?.error_message || `Phish.net error for ${path}`);
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

function truthyFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isPhishRow(row) {
  const name = String(row?.artist_name || row?.artist || "")
    .trim()
    .toLowerCase();
  if (name === "phish") return true;
  const id = String(row?.artistid ?? "");
  return !name && (id === "1" || id === "1.0");
}

function isCanceledShow(row) {
  if (truthyFlag(row?.exclude_from_stats) || truthyFlag(row?.exclude)) return true;
  const notes = String(row?.setlist_notes || row?.setlistnotes || "");
  return /cancel+ed/i.test(notes);
}

function performanceOrdinal(row) {
  const notes = `${row?.setlist_notes || ""} ${row?.setlistnotes || ""}`;
  const match = notes.match(
    /(\d+)(?:st|nd|rd|th) performance at Madison Square Garden/i,
  );
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {object[]} showRows
 * @param {object[]} setlistRows
 * @param {string} today YYYY-MM-DD
 */
function showsFromPhishnet(showRows, setlistRows, today) {
  /** @type {Map<string, object[]>} */
  const songsByDate = new Map();
  /** @type {Map<string, object[]>} */
  const bustoutsByDate = new Map();

  for (const row of Array.isArray(setlistRows) ? setlistRows : []) {
    if (!isPhishRow(row) || truthyFlag(row?.exclude)) continue;
    const showDate = String(row?.showdate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) continue;
    const set = String(row?.set || "");
    if (/^soundcheck$/i.test(set) || set.toLowerCase() === "s") continue;
    const title = String(row?.song || "").trim();
    if (!title) continue;
    const position = Number(row?.position);
    const gap = Number(row?.gap);
    const footnote = String(row?.footnote || "");
    const song = {
      title,
      set,
      position: Number.isFinite(position) ? position : 0,
      debut: /phish debut/i.test(footnote),
      gap: Number.isFinite(gap) ? gap : null,
    };
    if (!songsByDate.has(showDate)) songsByDate.set(showDate, []);
    songsByDate.get(showDate).push(song);
    if (song.gap != null && song.gap >= 30) {
      if (!bustoutsByDate.has(showDate)) bustoutsByDate.set(showDate, []);
      bustoutsByDate.get(showDate).push({ title, gap: song.gap, showDate });
    }
  }

  /** @type {Map<string, { showDate: string, canceled: boolean, ordinal: number | null }>} */
  const showMeta = new Map();
  for (const row of Array.isArray(showRows) ? showRows : []) {
    if (!isPhishRow(row)) continue;
    const showDate = String(row?.showdate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) continue;
    showMeta.set(showDate, {
      showDate,
      canceled: isCanceledShow(row),
      ordinal: performanceOrdinal(row),
    });
  }

  const shows = [];
  const upcoming = [];
  let lastShowOrdinal = null;
  let lastOrdinalDate = "";

  for (const meta of showMeta.values()) {
    if (meta.showDate > today) {
      if (!meta.canceled) upcoming.push({ showDate: meta.showDate });
      continue;
    }
    shows.push({
      showDate: meta.showDate,
      canceled: meta.canceled,
      songs: songsByDate.get(meta.showDate) || [],
      bustouts: bustoutsByDate.get(meta.showDate) || [],
    });
    if (meta.ordinal && meta.showDate >= lastOrdinalDate) {
      lastOrdinalDate = meta.showDate;
      lastShowOrdinal = meta.ordinal;
    }
  }

  for (const [showDate, songs] of songsByDate) {
    if (showDate > today || showMeta.has(showDate)) continue;
    shows.push({
      showDate,
      canceled: false,
      songs,
      bustouts: bustoutsByDate.get(showDate) || [],
    });
  }

  return { shows, upcoming, lastShowOrdinal };
}

async function loadAggregator() {
  const mod = await import("./vendor/aggregateMsgGardenStats.mjs");
  return mod.aggregateMsgGardenStats;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   logger?: Console,
 *   phishnetApiKey?: string,
 *   today?: string,
 *   showRows?: object[],
 *   setlistRows?: object[],
 *   minShowCount?: number,
 * }} [opts]
 */
async function refreshPublicMsgGardenStats(db, opts = {}) {
  const logger = opts.logger || console;
  const today =
    typeof opts.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.today)
      ? opts.today
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const apiKey = String(opts.phishnetApiKey || "").trim();
  const hasInjected = Array.isArray(opts.showRows) && Array.isArray(opts.setlistRows);

  if (!hasInjected && !apiKey) {
    logger.warn("refreshPublicMsgGardenStats: PHISHNET_API_KEY missing");
    return { written: false, reason: "missing-api-key" };
  }

  const showRows = hasInjected
    ? opts.showRows
    : await fetchPhishnetRows(apiKey, `shows/venueid/${MSG_VENUE_ID}`);
  const setlistRows = hasInjected
    ? opts.setlistRows
    : await fetchPhishnetRows(apiKey, `setlists/venueid/${MSG_VENUE_ID}`);

  const aggregateMsgGardenStats = await loadAggregator();
  const { shows, upcoming, lastShowOrdinal } = showsFromPhishnet(
    showRows,
    setlistRows,
    today,
  );
  const stats = aggregateMsgGardenStats(shows, {
    upcomingShows: upcoming,
    asOf: today,
    lastShowOrdinal,
  });

  const minShowCount =
    Number.isFinite(opts.minShowCount) ? opts.minShowCount : MIN_SHOW_COUNT;
  if (stats.showCount < minShowCount) {
    logger.error("refreshPublicMsgGardenStats: refusing short count", {
      showCount: stats.showCount,
      minShowCount,
    });
    return { written: false, reason: "short-count", showCount: stats.showCount };
  }

  const payload = {
    ...stats,
    writtenAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  await db.collection(DOC_PATH).doc(DOC_ID).set(payload);
  logger.info("refreshPublicMsgGardenStats: wrote", {
    showCount: stats.showCount,
    lastShowDate: stats.lastShowDate,
  });
  return {
    written: true,
    showCount: stats.showCount,
    lastShowDate: stats.lastShowDate,
  };
}

module.exports = {
  MSG_VENUE_ID,
  MIN_SHOW_COUNT,
  showsFromPhishnet,
  refreshPublicMsgGardenStats,
};

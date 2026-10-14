/**
 * Pure tour setlist aggregation for Cloud Functions (#665).
 * Mirrors `src/features/tour-stats/model/aggregateTourSetlistStats.js` (no lifetime tiebreak).
 * Keep in sync when changing private explorer math.
 */

// Page size on the UI (#709) — lists themselves are unbounded since #709;
// `refreshPublicTourStats` writes the FULL ranked lists to
// `public_tour_stats/{tourSlug}` (~hundreds of small rows, well under doc limits).
const TOUR_STATS_TOP_N = 15;
const TOUR_STATS_GAP_HIGHLIGHT_MIN = 10;
const BUSTOUT_MIN_GAP = 30;

function normalizeTitle(title) {
  return String(title ?? "")
    .trim()
    .toLowerCase();
}

function toGap(raw) {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {Array<{ showDate: string, setlist: object | null }>} docs
 * @param {{ tourShowCount?: number }} [options]
 */
function aggregateTourSetlistStats(docs, options = {}) {
  const tourShowCount =
    typeof options.tourShowCount === "number" && options.tourShowCount >= 0
      ? Math.trunc(options.tourShowCount)
      : Array.isArray(docs)
        ? docs.length
        : 0;

  /** @type {Map<string, { title: string, timesPlayed: number, showAppearances: number, lastTourDate: string | null }>} */
  const bySong = new Map();
  /** @type {Array<{ title: string, showDate: string, gap: number | null }>} */
  const bustouts = [];
  /** @type {Array<{ title: string, showDate: string, gap: number }>} */
  const gapHighlights = [];
  let showsWithSetlist = 0;
  let totalSongPlays = 0;

  const list = Array.isArray(docs) ? docs : [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const showDate = typeof entry.showDate === "string" ? entry.showDate.trim() : "";
    const setlist = entry.setlist;
    if (!setlist || typeof setlist !== "object") continue;

    const titles = Array.isArray(setlist.officialSetlist)
      ? setlist.officialSetlist.map((t) => String(t ?? "").trim()).filter(Boolean)
      : [];
    if (titles.length === 0) continue;
    showsWithSetlist += 1;

    // Presence is once per title per show (bustouts / gaps). Plays count every
    // officialSetlist row, including a title that returns later the same night
    // (Phish.net song-row total). Keep in sync with the client model.
    const playedThisShow = new Set();
    for (const title of titles) {
      const key = normalizeTitle(title);
      if (!key) continue;
      const firstThisShow = !playedThisShow.has(key);
      playedThisShow.add(key);
      totalSongPlays += 1;
      const existing = bySong.get(key);
      if (existing) {
        existing.timesPlayed += 1;
        if (firstThisShow) existing.showAppearances += 1;
        if (
          showDate &&
          (!existing.lastTourDate || showDate > existing.lastTourDate)
        ) {
          existing.lastTourDate = showDate;
        }
      } else {
        bySong.set(key, {
          title,
          timesPlayed: 1,
          showAppearances: 1,
          lastTourDate: showDate || null,
        });
      }
    }

    const songGaps =
      setlist.songGaps &&
      typeof setlist.songGaps === "object" &&
      !Array.isArray(setlist.songGaps)
        ? setlist.songGaps
        : null;

    const bustoutKeys = new Set();
    const bustoutList = Array.isArray(setlist.bustouts) ? setlist.bustouts : [];
    for (const raw of bustoutList) {
      const title = String(raw ?? "").trim();
      const key = normalizeTitle(title);
      if (!title || !key || bustoutKeys.has(key)) continue;
      if (!playedThisShow.has(key)) continue;
      bustoutKeys.add(key);
      bustouts.push({
        title,
        showDate,
        gap: songGaps ? toGap(songGaps[key]) : null,
      });
    }

    if (songGaps) {
      for (const [key, gapRaw] of Object.entries(songGaps)) {
        if (!playedThisShow.has(key) || bustoutKeys.has(key)) continue;
        const gap = toGap(gapRaw);
        if (gap == null || gap < BUSTOUT_MIN_GAP) continue;
        bustoutKeys.add(key);
        const match = bySong.get(key);
        bustouts.push({ title: match?.title || key, showDate, gap });
      }

      for (const [key, gapRaw] of Object.entries(songGaps)) {
        if (!playedThisShow.has(key) || bustoutKeys.has(key)) continue;
        const gap = toGap(gapRaw);
        if (gap == null || gap < TOUR_STATS_GAP_HIGHLIGHT_MIN || gap >= BUSTOUT_MIN_GAP) {
          continue;
        }
        const match = bySong.get(key);
        gapHighlights.push({ title: match?.title || key, showDate, gap });
      }
    }
  }

  // #709: full ranked list — no top-N cap (mirrors the client model).
  // `lastPlayed` here = most recent *tour* date the song was played (Most
  // played "Last" column). Bustout/gap rows get a different lastPlayed
  // (before that night) stamped later from phish.net history.
  const topSongs = [...bySong.values()]
    .sort((a, b) => {
      if (b.showAppearances !== a.showAppearances) return b.showAppearances - a.showAppearances;
      if (b.timesPlayed !== a.timesPlayed) return b.timesPlayed - a.timesPlayed;
      return a.title.localeCompare(b.title);
    })
    .map((row) => ({
      title: row.title,
      timesPlayed: row.timesPlayed,
      showAppearances: row.showAppearances,
      lastPlayed: row.lastTourDate || null,
    }));

  bustouts.sort((a, b) => {
    const ga = a.gap ?? -1;
    const gb = b.gap ?? -1;
    if (gb !== ga) return gb - ga;
    return a.title.localeCompare(b.title);
  });

  gapHighlights.sort((a, b) => {
    if (b.gap !== a.gap) return b.gap - a.gap;
    return a.title.localeCompare(b.title);
  });

  return {
    tourShowCount,
    showsWithSetlist,
    uniqueSongs: bySong.size,
    totalSongPlays,
    topSongs,
    bustouts,
    gapHighlights,
  };
}

/**
 * Phish.net songs list → per-title enrichment map (#666 Phase 1).
 * Input rows come from `fetchPhishnetSongsNormalized` (`phishnetSongCatalog.js`):
 * `{ name, total, gap, last, debut, slug }` with string fields ("—" when unknown).
 *
 * Output: normalized title → `{ lifetimePlays, debutYear, slug, lastPlayedCatalog }`.
 * Lifetime data lives only on phish.net (game-local `official_setlists` cover
 * scored tour dates), so this is the unique crawlable content layer for the
 * public `/tour-stats` pages. `slug` keys the per-song play-history lookup;
 * `lastPlayedCatalog` is phish.net's current `last_played` and can fill
 * bustout/gap `lastPlayed` when it is strictly before that tour night (no
 * history HTTP call needed). Neither `slug` nor `lastPlayedCatalog` is written
 * into payload rows as-is.
 *
 * @param {Array<{ name: string, total?: string, debut?: string, slug?: string, last?: string }>} songs
 * @returns {Map<string, { lifetimePlays: number | null, debutYear: number | null, slug: string | null, lastPlayedCatalog: string | null }>}
 */
function buildSongEnrichmentByTitle(songs) {
  const map = new Map();
  const list = Array.isArray(songs) ? songs : [];
  for (const song of list) {
    const key = normalizeTitle(song?.name);
    if (!key || map.has(key)) continue;

    const totalNum = Number(song?.total);
    const lifetimePlays =
      Number.isFinite(totalNum) && totalNum >= 0 ? Math.trunc(totalNum) : null;

    // `debut` is either `YYYY-MM-DD` or a bare year string.
    const debutRaw = String(song?.debut ?? "").trim();
    const yearMatch = debutRaw.match(/^(\d{4})/);
    const year = yearMatch ? Number(yearMatch[1]) : NaN;
    const debutYear = year >= 1900 && year <= 2100 ? year : null;

    const slugRaw = String(song?.slug ?? "").trim();
    const slug = slugRaw || null;

    const lastRaw = String(song?.last ?? "").trim();
    const lastPlayedCatalog = /^\d{4}-\d{2}-\d{2}$/.test(lastRaw)
      ? lastRaw
      : null;

    if (
      lifetimePlays === null &&
      debutYear === null &&
      slug === null &&
      lastPlayedCatalog === null
    ) {
      continue;
    }
    map.set(key, { lifetimePlays, debutYear, slug, lastPlayedCatalog });
  }
  return map;
}

/**
 * Latest play date strictly before `beforeDate`, from a song's full play
 * history (#709 follow-up: the "Last" column on Bustouts / High gaps).
 * Dates are `YYYY-MM-DD` strings, so lexicographic compare is chronological.
 *
 * @param {unknown} dates
 * @param {unknown} beforeDate
 * @returns {string | null}
 */
function lastPlayedBeforeFromHistory(dates, beforeDate) {
  const before = String(beforeDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) return null;
  let best = null;
  for (const raw of Array.isArray(dates) ? dates : []) {
    const d = String(raw ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (d >= before) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/**
 * @param {Map<string, { lifetimePlays: number | null, debutYear: number | null }> | null | undefined} enrichmentByTitle
 * @param {string} title
 */
function enrichmentFor(enrichmentByTitle, title) {
  if (!(enrichmentByTitle instanceof Map)) return null;
  return enrichmentByTitle.get(normalizeTitle(title)) || null;
}

/**
 * Public payload — aggregates only (no officialSetlist arrays, no per-song showDates lists).
 * Bustout/gap rows may include a single showDate (song event), never a full night setlist.
 *
 * When `enrichmentByTitle` (#666) is provided, every row also carries
 * `lifetimePlays` + `debutYear` (null when phish.net has no data for the
 * title). Omitted entirely when enrichment is unavailable so consumers can
 * distinguish "not enriched" from "unknown song".
 *
 * @param {ReturnType<typeof aggregateTourSetlistStats>} stats
 * @param {Map<string, { lifetimePlays: number | null, debutYear: number | null }> | null} [enrichmentByTitle]
 */
function toPublicTourStatsPayload(stats, enrichmentByTitle = null) {
  const enriched = enrichmentByTitle instanceof Map;
  /**
   * @param {{ title: string }} row
   * @param {Record<string, unknown>} base
   */
  const withEnrichment = (row, base) => {
    if (!enriched) return base;
    const e = enrichmentFor(enrichmentByTitle, row.title);
    return {
      ...base,
      lifetimePlays: e ? e.lifetimePlays : null,
      debutYear: e ? e.debutYear : null,
    };
  };

  return {
    tourShowCount: stats.tourShowCount,
    showsWithSetlist: stats.showsWithSetlist,
    uniqueSongs: stats.uniqueSongs,
    totalSongPlays: stats.totalSongPlays,
    topSongs: (stats.topSongs || []).map((r) =>
      withEnrichment(r, {
        title: r.title,
        timesPlayed: r.timesPlayed,
        showAppearances: r.showAppearances,
        // Tour-local last play (not phish.net lifetime last).
        lastPlayed: r.lastPlayed || null,
      })
    ),
    bustouts: (stats.bustouts || []).map((r) =>
      withEnrichment(r, {
        title: r.title,
        gap: r.gap,
        showDate: r.showDate || null,
      })
    ),
    gapHighlights: (stats.gapHighlights || []).map((r) =>
      withEnrichment(r, {
        title: r.title,
        gap: r.gap,
        showDate: r.showDate || null,
      })
    ),
  };
}

function tourLabelToSlug(tourLabel) {
  const raw = String(tourLabel ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || "tour";
}

module.exports = {
  aggregateTourSetlistStats,
  toPublicTourStatsPayload,
  buildSongEnrichmentByTitle,
  lastPlayedBeforeFromHistory,
  tourLabelToSlug,
  TOUR_STATS_TOP_N,
  TOUR_STATS_GAP_HIGHLIGHT_MIN,
  BUSTOUT_MIN_GAP,
};

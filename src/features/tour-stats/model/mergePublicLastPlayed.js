/**
 * Join `lastPlayed` dates from the precomputed `public_tour_stats` payload
 * onto client-aggregated bustout / high-gap rows (#709 follow-up).
 *
 * The date a song was last played *before* a tour night comes from phish.net
 * song history and is only computable server-side (`refreshPublicTourStats`,
 * #666). The dashboard aggregates setlists client-side, so it borrows the
 * dates from the world-readable public doc for the same tour. Rows match on
 * normalized title + tour show date; anything unmatched stays date-less and
 * the UI hides the column when no row has one.
 */

/**
 * @param {unknown} title
 * @param {unknown} showDate
 * @returns {string}
 */
function titleKey(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase();
}

function rowKey(title, showDate) {
  return `${titleKey(title)}|${String(showDate ?? '').trim()}`;
}

/**
 * Debut year and lifetime plays already stored on the public frequency rows.
 * The dashboard aggregates setlists itself, so it borrows this line for the
 * subtitle under each title.
 *
 * @param {null | undefined | { topSongs?: Array<{ title?: string, debutYear?: unknown, lifetimePlays?: unknown }> }} publicDoc
 * @returns {Map<string, { debutYear?: number, lifetimePlays?: number }>}
 */
export function buildSongEnrichmentByTitle(publicDoc) {
  const map = new Map();
  if (!publicDoc || typeof publicDoc !== 'object' || !Array.isArray(publicDoc.topSongs)) {
    return map;
  }
  for (const row of publicDoc.topSongs) {
    if (!row || typeof row !== 'object') continue;
    const key = titleKey(row.title);
    if (!key) continue;
    /** @type {{ debutYear?: number, lifetimePlays?: number }} */
    const enrichment = {};
    if (typeof row.debutYear === 'number' && Number.isFinite(row.debutYear)) {
      enrichment.debutYear = row.debutYear;
    }
    if (typeof row.lifetimePlays === 'number' && Number.isFinite(row.lifetimePlays)) {
      enrichment.lifetimePlays = row.lifetimePlays;
    }
    if (enrichment.debutYear == null && enrichment.lifetimePlays == null) continue;
    map.set(key, enrichment);
  }
  return map;
}

/**
 * @param {null | undefined | {
 *   bustouts?: Array<{ title?: string, showDate?: string, lastPlayed?: string | null }>,
 *   gapHighlights?: Array<{ title?: string, showDate?: string, lastPlayed?: string | null }>,
 * }} publicDoc
 * @returns {Map<string, string>} rowKey → `YYYY-MM-DD`
 */
export function buildLastPlayedByRowKey(publicDoc) {
  const map = new Map();
  if (!publicDoc || typeof publicDoc !== 'object') return map;
  for (const list of [publicDoc.bustouts, publicDoc.gapHighlights]) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const lastPlayed =
        typeof row.lastPlayed === 'string' ? row.lastPlayed.trim() : '';
      if (!lastPlayed) continue;
      map.set(rowKey(row.title, row.showDate), lastPlayed);
    }
  }
  return map;
}

/**
 * Returns `stats` with `lastPlayed` stamped onto matching bustout /
 * gap-highlight rows. Same object back when the public doc contributes
 * nothing, so memoized consumers don't re-render.
 *
 * @template {{ bustouts: Array<object>, gapHighlights: Array<object> }} S
 * @param {S} stats
 * @param {Parameters<typeof buildLastPlayedByRowKey>[0]} publicDoc
 * @returns {S}
 */
export function mergeLastPlayedIntoStats(stats, publicDoc) {
  const byKey = buildLastPlayedByRowKey(publicDoc);
  const enrichment = buildSongEnrichmentByTitle(publicDoc);
  if (byKey.size === 0 && enrichment.size === 0) return stats;

  let changed = false;
  const stamp = (rows) =>
    rows.map((row) => {
      const lastPlayed = byKey.get(rowKey(row.title, row.showDate));
      if (!lastPlayed) return row;
      changed = true;
      return { ...row, lastPlayed };
    });

  const bustouts = byKey.size > 0 ? stamp(stats.bustouts) : stats.bustouts;
  const gapHighlights = byKey.size > 0 ? stamp(stats.gapHighlights) : stats.gapHighlights;

  let topSongs = stats.topSongs;
  if (enrichment.size > 0 && Array.isArray(stats.topSongs)) {
    topSongs = stats.topSongs.map((row) => {
      const extra = enrichment.get(titleKey(row.title));
      if (!extra) return row;
      changed = true;
      return { ...row, ...extra };
    });
  }

  return changed ? { ...stats, topSongs, bustouts, gapHighlights } : stats;
}

/**
 * Rewind client contract (#1142).
 *
 * Live standings read `picks`. Rewind scores live on `rewind_picks`.
 * The public week allowlist matches `functions/rewindMode.js` — counts and
 * labels only, never the ordered song list.
 */

export const REWIND_WEEKS_COLLECTION = 'rewind_weeks';
export const REWIND_PICKS_COLLECTION = 'rewind_picks';
export const REWIND_STATE_COLLECTION = 'rewind_state';
export const REWIND_CURRENT_ID = 'current';

/** Show / tour / year boards query this collection. Rewind must not. */
export const LIVE_PICKS_COLLECTION = 'picks';

export const REWIND_ATTRIBUTION = 'Setlist data courtesy of Phish.net.';

export const REWIND_SLOT_IDS = Object.freeze([
  's1o',
  's1c',
  's2o',
  's2c',
  'enc',
  'wild',
]);

/**
 * MSG New Year's Eve dates from the Garden snapshot (#1139). Dates only —
 * the setlist is fetched and cached, not copied here.
 */
export const SUGGESTED_MSG_NYE_DATES = Object.freeze([
  '1995-12-31',
  '1997-12-31',
  '1998-12-31',
  '2010-12-31',
  '2012-12-31',
  '2017-12-31',
  '2019-12-31',
  '2022-12-31',
  '2025-12-31',
]);

const PUBLIC_WEEK_FIELDS = Object.freeze([
  'weekId',
  'showDate',
  'title',
  'venue',
  'status',
  'opensAt',
  'closesAt',
  'phishNetUrl',
  'playerCount',
  'scoreSum',
  'averageScore',
  'correctSlotCounts',
  'answerCachedAt',
  'updatedAt',
  'attribution',
  'schemaVersion',
]);

/**
 * @param {string} weekId
 * @param {string} uid
 */
export function rewindPickDocId(weekId, uid) {
  return `${weekId}_${uid}`;
}

export function emptyRewindPicks() {
  /** @type {Record<string, string>} */
  const picks = {};
  for (const id of REWIND_SLOT_IDS) picks[id] = '';
  return picks;
}

/**
 * @param {Record<string, unknown> | null | undefined} picks
 */
export function rewindPicksComplete(picks) {
  if (!picks) return false;
  return REWIND_SLOT_IDS.every((id) => String(picks[id] ?? '').trim().length > 0);
}

/**
 * @param {unknown} raw
 */
export function toPublicRewindWeek(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = /** @type {Record<string, unknown>} */ (raw);
  if (typeof source.weekId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.weekId)) {
    return null;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of PUBLIC_WEEK_FIELDS) {
    if (source[key] !== undefined && source[key] !== null) out[key] = source[key];
  }
  out.weekId = source.weekId;
  out.playerCount = Math.max(0, Math.trunc(Number(out.playerCount) || 0));
  out.scoreSum = Number(out.scoreSum) || 0;
  out.averageScore = Number(out.averageScore) || 0;
  /** @type {Record<string, number>} */
  const counts = {};
  const rawCounts =
    out.correctSlotCounts && typeof out.correctSlotCounts === 'object'
      ? /** @type {Record<string, unknown>} */ (out.correctSlotCounts)
      : {};
  for (const id of REWIND_SLOT_IDS) {
    const n = Number(rawCounts[id]);
    counts[id] = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  out.correctSlotCounts = counts;
  out.attribution = REWIND_ATTRIBUTION;
  return out;
}

/**
 * Player-facing load error. Firestore REST 403s until rules are deployed;
 * do not surface the raw JSON.
 *
 * @param {unknown} error
 */
export function rewindLoadErrorMessage(error, fallback) {
  const raw = error instanceof Error ? error.message : '';
  if (/403|PERMISSION_DENIED|insufficient permissions/i.test(raw)) {
    return 'This Rewind week is not available yet.';
  }
  return fallback;
}

/**
 * The play surface shows slot answers only after a lock reveal exists.
 *
 * @param {unknown} reveal
 */
export function rewindAnswerVisible(reveal) {
  return Boolean(reveal && typeof reveal === 'object' && Array.isArray(reveal.slots));
}

/**
 * @param {Array<{ score?: number, handle?: string, userId?: string }>} rows
 */
export function rankRewindBoard(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const score = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (score !== 0) return score;
    return String(a.handle || '').localeCompare(String(b.handle || ''));
  });
  let lastScore = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const score = Number(row.score) || 0;
    const rank = score === lastScore ? lastRank : index + 1;
    lastScore = score;
    lastRank = rank;
    return { ...row, score, rank };
  });
}

function shareEmoji(slot) {
  if (slot?.bustoutBoost) return '🟧';
  if (
    slot?.kind === 'exact_slot' ||
    slot?.kind === 'encore_exact' ||
    slot?.kind === 'wildcard_hit'
  ) {
    return '🟩';
  }
  if (slot?.kind === 'in_setlist') return '🟦';
  return '⬜';
}

/**
 * Share text uses the grid and the score. Song titles are ignored on purpose.
 *
 * @param {{
 *   title?: string,
 *   showDate?: string,
 *   score?: number,
 *   correctSlots?: number,
 *   weekId?: string,
 *   phishNetUrl?: string,
 *   slots?: Array<{ kind?: string, bustoutBoost?: boolean, guess?: string, actual?: string }>,
 * }} args
 */
export function buildRewindShareText(args) {
  const slots = Array.isArray(args?.slots) ? args.slots : [];
  const cells = REWIND_SLOT_IDS.map((_, index) => shareEmoji(slots[index]));
  const grid = `${cells.slice(0, 3).join('')}\n${cells.slice(3, 6).join('')}`;
  const title = String(args?.title || 'Rewind').trim();
  const showDate = String(args?.showDate || '').trim();
  const weekId = String(args?.weekId || '').trim();
  const score = Number(args?.score) || 0;
  const correct = Number(args?.correctSlots) || 0;
  const phishNetUrl =
    String(args?.phishNetUrl || '').trim() ||
    (showDate ? `https://phish.net/setlists/?d=${encodeURIComponent(showDate)}` : 'https://phish.net');
  const playUrl = weekId
    ? `https://www.setlistpickem.com/rewind/${weekId}`
    : 'https://www.setlistpickem.com/rewind';
  return [
    "Check out my Setlist Pick 'Em Rewind!",
    `${title} · ${showDate} · ${correct}/6 · ${score} pts`,
    '',
    grid,
    '',
    '🟩 nailed it · 🟦 in setlist · ⬜ miss · 🟧 Bustout Boost',
    '',
    REWIND_ATTRIBUTION,
    phishNetUrl,
    `Play free → ${playUrl}`,
  ].join('\n');
}

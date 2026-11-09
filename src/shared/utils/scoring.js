import { FORM_FIELDS } from '../data/gameConfig.js';
import { ymdInTimeZone } from './dateUtils.js';

/**
 * Ladder that was live through the 2026 Fall Tour.
 * A missing or unparseable show date stays on this ladder so an undated
 * payload cannot re-score a night that already happened (#1086).
 */
export const SCORING_LADDER_V1 = {
  id: 'v1',
  EXACT_SLOT: 10,
  /** Any encore song, not only the first. */
  ENCORE_EXACT: 15,
  /** Same payout as ENCORE_EXACT. Any listed encore song was the encore exact. */
  ENCORE_LATER: 15,
  IN_SETLIST: 5,
  WILDCARD_HIT: 10,
  BUSTOUT_BOOST: 20,
  /**
   * Minimum pre-show gap to count as a bustout. Kept as a named constant for
   * the write paths (`setlistParser`, live automation) that derive
   * `official_setlists.bustouts` from Phish.net row `gap`. Scoring itself no
   * longer evaluates this at read time. It consumes the frozen `bustouts`
   * snapshot instead (#214).
   */
  BUSTOUT_MIN_GAP: 30,
};

/**
 * Ladder for shows on or after {@link SCORING_LADDER_V2_EFFECTIVE_DATE}.
 * Wildcard presence is 5. The first encore song stays 15. A later encore
 * song is 10. Bustout stays a flat +20 (#227).
 */
export const SCORING_LADDER_V2 = {
  id: 'v2',
  EXACT_SLOT: 10,
  ENCORE_EXACT: 15,
  ENCORE_LATER: 10,
  IN_SETLIST: 5,
  WILDCARD_HIT: 5,
  BUSTOUT_BOOST: 20,
  BUSTOUT_MIN_GAP: 30,
};

/**
 * First night of the next tour after Fall 2026: Phish New Year's Run
 * 2026-2027 at Madison Square Garden (announced Dec 30, 2026 through Jan 2,
 * 2027). Shows before this date keep the ladder that was live that night
 * and are never re-scored onto v2 (#1086).
 */
export const SCORING_LADDER_V2_EFFECTIVE_DATE = '2026-12-30';

/** Player-facing name of the tour the v2 ladder starts with. */
export const SCORING_LADDER_V2_TOUR_NAME = "New Year's Run 2026-2027";

/** @deprecated Use {@link scoringRulesForShowDate}. This object is ladder v1. */
export const SCORING_RULES = SCORING_LADDER_V1;

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeShowDate(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return SHOW_DATE_RE.test(trimmed) ? trimmed : null;
}

/**
 * @param {unknown} showDate YYYY-MM-DD. Missing or invalid stays on v1.
 * @returns {typeof SCORING_LADDER_V1}
 */
export function scoringRulesForShowDate(showDate) {
  const date = normalizeShowDate(showDate);
  if (date && date >= SCORING_LADDER_V2_EFFECTIVE_DATE) return SCORING_LADDER_V2;
  return SCORING_LADDER_V1;
}

/**
 * Ladder a player should read "today" (America/New_York show calendar).
 * Grading still uses the show date, not this.
 *
 * @param {Date} [now]
 */
export function scoringRulesInEffect(now = new Date()) {
  return scoringRulesForShowDate(ymdInTimeZone(now, 'America/New_York'));
}

/** @returns {string} e.g. "December 30, 2026" */
export function formatScoringLadderEffectiveDate() {
  const [year, month, day] = SCORING_LADDER_V2_EFFECTIVE_DATE.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Before/after rows for the player explainer. Numbers come from the ladders.
 * @returns {Array<{ id: string, label: string, before: number, after: number, prefix?: string, beforeNote?: string }>}
 */
export function scoringLadderComparisonRows() {
  const before = SCORING_LADDER_V1;
  const after = SCORING_LADDER_V2;
  return [
    {
      id: 'in_setlist',
      label: 'In the setlist, wrong slot',
      before: before.IN_SETLIST,
      after: after.IN_SETLIST,
    },
    {
      id: 'wildcard',
      label: 'Wildcard, played anywhere',
      before: before.WILDCARD_HIT,
      after: after.WILDCARD_HIT,
    },
    {
      id: 'exact',
      label: 'Exact Set 1 or Set 2 opener or closer',
      before: before.EXACT_SLOT,
      after: after.EXACT_SLOT,
    },
    {
      id: 'encore_first',
      label: 'First encore song',
      before: before.ENCORE_EXACT,
      after: after.ENCORE_EXACT,
      beforeNote: 'any encore song',
    },
    {
      id: 'encore_later',
      label: 'A later encore song',
      before: before.ENCORE_LATER,
      after: after.ENCORE_LATER,
    },
    {
      id: 'elsewhere',
      label: 'That song played somewhere else in the show',
      before: before.IN_SETLIST,
      after: after.IN_SETLIST,
    },
    {
      id: 'bustout',
      label: 'Bustout, 30+ show gap',
      before: before.BUSTOUT_BOOST,
      after: after.BUSTOUT_BOOST,
      prefix: '+',
    },
  ];
}

/**
 * Copy `showDate` onto a scoring payload without treating it as a song.
 * Invalid dates are left off so grading stays on ladder v1.
 *
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @param {unknown} showDate
 */
export function attachScoringShowDate(actualSetlist, showDate) {
  if (!actualSetlist || typeof actualSetlist !== 'object') return actualSetlist;
  const date = normalizeShowDate(showDate);
  if (!date) return actualSetlist;
  if (actualSetlist.showDate === date) return actualSetlist;
  return { ...actualSetlist, showDate: date };
}

const normalize = (s) => String(s ?? '').trim().toLowerCase();

/** Keys on the scoring payload that are not slot song strings. */
const NON_SONG_SETLIST_KEYS = new Set([
  'officialSetlist',
  'encoreSongs',
  'id',
  'bustouts',
  'songGaps',
  'showDate',
]);

/**
 * @param {Record<string, unknown>} actualSetlist
 * @returns {string[]} normalized encore titles, show order
 */
function encoreTitles(actualSetlist) {
  const list = actualSetlist?.encoreSongs;
  if (!Array.isArray(list)) return [];
  return list.map((title) => normalize(title)).filter(Boolean);
}

/**
 * First encore is the primary `enc` slot and the first `encoreSongs` entry.
 * A later encore song is any other title in `encoreSongs`.
 *
 * @param {Record<string, unknown>} actualSetlist
 * @param {string} guessNorm
 * @returns {'none' | 'first' | 'later'}
 */
export function encorePlacement(actualSetlist, guessNorm) {
  if (!guessNorm || !actualSetlist) return 'none';
  const primary = normalize(actualSetlist.enc);
  const list = encoreTitles(actualSetlist);
  const first = new Set();
  if (primary) first.add(primary);
  if (list[0]) first.add(list[0]);
  if (first.has(guessNorm)) return 'first';
  if (list.some((title, index) => index > 0 && title === guessNorm)) return 'later';
  return 'none';
}

/**
 * Slot strings from the flat map plus ordered `officialSetlist`, normalized and deduped.
 * @param {Record<string, unknown>} actualSetlist
 * @returns {string[]}
 */
function buildAllPlayedNormalized(actualSetlist) {
  const fromSlots = [];
  for (const [key, val] of Object.entries(actualSetlist)) {
    if (NON_SONG_SETLIST_KEYS.has(key)) continue;
    if (typeof val !== 'string') continue;
    const t = val.trim();
    if (!t) continue;
    fromSlots.push(normalize(t));
  }

  const rawOfficial = actualSetlist.officialSetlist;
  const fromOfficial = Array.isArray(rawOfficial)
    ? rawOfficial
        .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
        .filter(Boolean)
        .map((s) => normalize(s))
    : [];

  const combined = [...fromSlots, ...fromOfficial];
  return [...new Set(combined)];
}

/**
 * Why this slot scored (or did not). Used in standings pick breakdown UI.
 * @typedef {'none' | 'miss' | 'in_setlist' | 'exact_slot' | 'encore_exact' | 'encore_later' | 'wildcard_hit'} ScoreBreakdownKind
 */

/** Short labels aligned with scoring rules copy (standings detail / tooltips). */
export const SCORE_BREAKDOWN_KIND_LABEL = {
  none: '',
  miss: 'Not in show',
  in_setlist: 'In setlist',
  exact_slot: 'Exact slot',
  encore_exact: 'Exact encore',
  encore_later: 'Later encore',
  wildcard_hit: 'Wildcard hit',
};

/**
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @param {unknown} [explicitShowDate]
 */
function rulesForPayload(actualSetlist, explicitShowDate) {
  return scoringRulesForShowDate(
    normalizeShowDate(explicitShowDate) || normalizeShowDate(actualSetlist?.showDate),
  );
}

/**
 * @returns {{ base: number, bustoutBoost: boolean, kind: ScoreBreakdownKind }}
 */
function computeSlotResult(fieldId, guessedSong, actualSetlist, explicitShowDate) {
  if (!actualSetlist || !guessedSong) {
    return { base: 0, bustoutBoost: false, kind: 'none' };
  }

  const guess = normalize(guessedSong);
  if (!guess) return { base: 0, bustoutBoost: false, kind: 'none' };

  const rules = rulesForPayload(actualSetlist, explicitShowDate);
  const allPlayed = buildAllPlayedNormalized(actualSetlist);

  let base = 0;
  /** @type {ScoreBreakdownKind} */
  let resolvedKind = 'exact_slot';
  if (fieldId === 'wild') {
    if (allPlayed.includes(guess)) {
      base = rules.WILDCARD_HIT;
      resolvedKind = 'wildcard_hit';
    } else {
      return { base: 0, bustoutBoost: false, kind: 'miss' };
    }
  } else if (fieldId === 'enc') {
    const place = encorePlacement(actualSetlist, guess);
    if (place === 'first') {
      base = rules.ENCORE_EXACT;
      resolvedKind = 'encore_exact';
    } else if (place === 'later') {
      base = rules.ENCORE_LATER;
      resolvedKind = rules.id === 'v2' ? 'encore_later' : 'encore_exact';
    } else if (allPlayed.includes(guess)) {
      base = rules.IN_SETLIST;
      resolvedKind = 'in_setlist';
    } else {
      return { base: 0, bustoutBoost: false, kind: 'miss' };
    }
  } else {
    const exactNonEnc = normalize(actualSetlist[fieldId]) === guess;
    if (exactNonEnc) {
      base = rules.EXACT_SLOT;
      resolvedKind = 'exact_slot';
    } else if (allPlayed.includes(guess)) {
      base = rules.IN_SETLIST;
      resolvedKind = 'in_setlist';
    } else {
      return { base: 0, bustoutBoost: false, kind: 'miss' };
    }
  }

  // Bustout boost reads the per-show snapshot on the official setlist doc
  // (#214). Absence or empty array → no bustout boost; no catalog fallback.
  // The snapshot is written at save time from Phish.net row `gap` (pre-show
  // by construction), which decouples scoring from the weekly
  // `song-catalog.json` refresh cadence.
  const bustoutList = Array.isArray(actualSetlist.bustouts) ? actualSetlist.bustouts : [];
  let bustoutBoost = false;
  for (const raw of bustoutList) {
    if (typeof raw !== 'string') continue;
    if (normalize(raw) === guess) {
      bustoutBoost = true;
      break;
    }
  }

  return { base, bustoutBoost, kind: resolvedKind };
}

/**
 * Points for one slot + whether the bustout boost applied + kind for UI labels.
 * Bustout does not change `kind` (still the base rule that earned points).
 */
export const getSlotScoreBreakdown = (fieldId, guessedSong, actualSetlist, showDate) => {
  const rules = rulesForPayload(actualSetlist, showDate);
  const { base, bustoutBoost, kind } = computeSlotResult(
    fieldId,
    guessedSong,
    actualSetlist,
    showDate,
  );
  const boostPts = bustoutBoost ? rules.BUSTOUT_BOOST : 0;
  return {
    points: base + boostPts,
    bustoutBoost,
    kind,
  };
};

export const calculateSlotScore = (fieldId, guessedSong, actualSetlist, showDate) => {
  return getSlotScoreBreakdown(fieldId, guessedSong, actualSetlist, showDate).points;
};

export const calculateTotalScore = (userPicks, actualSetlist, showDate) => {
  if (!actualSetlist || !userPicks) return 0;

  let total = 0;
  FORM_FIELDS.forEach((field) => {
    total += calculateSlotScore(field.id, userPicks[field.id], actualSetlist, showDate);
  });

  return total;
};

const EXACT_POSITION_FIELDS = ['s1o', 's1c', 's2o', 's2c'];

/**
 * Exact slots for the tie-break (#1172). Set 1 and Set 2 openers and closers,
 * plus the first encore song. A later encore is not an exact slot. Wildcard
 * and a song in the wrong slot are not exact slots.
 *
 * @param {Record<string, unknown> | null | undefined} userPicks
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @returns {number}
 */
export function countExactHits(userPicks, actualSetlist) {
  if (!actualSetlist || !userPicks) return 0;
  let n = 0;
  for (const fieldId of EXACT_POSITION_FIELDS) {
    const guessed = userPicks[fieldId];
    if (guessed == null || String(guessed).trim() === '') continue;
    const guess = normalize(guessed);
    if (guess && guess === normalize(actualSetlist[fieldId])) n += 1;
  }
  const encoreGuess = userPicks.enc;
  if (encoreGuess != null && String(encoreGuess).trim() !== '') {
    if (encorePlacement(actualSetlist, normalize(encoreGuess)) === 'first') n += 1;
  }
  return n;
}

/**
 * Slots that scored, out of 6. Presence, wildcard, and a later encore count.
 *
 * @param {Record<string, unknown> | null | undefined} userPicks
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @param {unknown} [showDate]
 * @returns {number}
 */
export function countCorrectPicks(userPicks, actualSetlist, showDate) {
  if (!actualSetlist || !userPicks) return 0;
  let n = 0;
  for (const field of FORM_FIELDS) {
    if (calculateSlotScore(field.id, userPicks[field.id], actualSetlist, showDate) > 0) n += 1;
  }
  return n;
}

/**
 * Server-side scoring helpers extracted from `functions/index.js` so they can
 * be shared with ops tooling (e.g. `scripts/backfillBustouts.js`) without
 * pulling in the full Cloud Functions module graph.
 *
 * Mirrors `src/shared/utils/scoring.js` — keep the two in sync. The `bustouts`
 * snapshot on `actualSetlist` is the only source of truth for bustout boosts
 * (#214); absence/empty → no boost, no catalog fallback.
 */

/**
 * Ladder live through the 2026 Fall Tour. A missing show date stays here so
 * an undated payload cannot re-score a night that already happened (#1086).
 * Keep in sync with `SCORING_LADDER_V1` in `src/shared/utils/scoring.js`.
 */
const SCORING_LADDER_V1 = {
  id: "v1",
  EXACT_SLOT: 10,
  ENCORE_EXACT: 15,
  ENCORE_LATER: 15,
  IN_SETLIST: 5,
  WILDCARD_HIT: 10,
  BUSTOUT_BOOST: 20,
  BUSTOUT_MIN_GAP: 30,
};

/**
 * First night of the New Year's Run 2026-2027 (MSG, 2026-12-30).
 * Shows before this date keep the ladder that was live that night.
 */
const SCORING_LADDER_V2_EFFECTIVE_DATE = "2026-12-30";

const SCORING_LADDER_V2 = {
  id: "v2",
  EXACT_SLOT: 10,
  ENCORE_EXACT: 15,
  ENCORE_LATER: 10,
  IN_SETLIST: 5,
  WILDCARD_HIT: 5,
  BUSTOUT_BOOST: 20,
  BUSTOUT_MIN_GAP: 30,
};

/** Ladder v1. Callers that need the show's ladder use `scoringRulesForShowDate`. */
const SCORING_RULES = SCORING_LADDER_V1;

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SCORE_FIELDS = ["s1o", "s1c", "s2o", "s2c", "enc", "wild"];

const NON_SONG_SETLIST_KEYS = new Set([
  "officialSetlist",
  "encoreSongs",
  "id",
  "bustouts",
  "songGaps",
  "showDate",
]);

function normalizeShowDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SHOW_DATE_RE.test(trimmed) ? trimmed : null;
}

function scoringRulesForShowDate(showDate) {
  const date = normalizeShowDate(showDate);
  if (date && date >= SCORING_LADDER_V2_EFFECTIVE_DATE) return SCORING_LADDER_V2;
  return SCORING_LADDER_V1;
}

function rulesForPayload(actualSetlist, explicitShowDate) {
  return scoringRulesForShowDate(
    normalizeShowDate(explicitShowDate) ||
      normalizeShowDate(actualSetlist && actualSetlist.showDate)
  );
}

function attachScoringShowDate(actualSetlist, showDate) {
  if (!actualSetlist || typeof actualSetlist !== "object") return actualSetlist;
  const date = normalizeShowDate(showDate);
  if (!date) return actualSetlist;
  if (actualSetlist.showDate === date) return actualSetlist;
  return { ...actualSetlist, showDate: date };
}

function normalizeSong(value) {
  return String(value ?? "").trim().toLowerCase();
}

function encoreTitles(actualSetlist) {
  const list = actualSetlist && actualSetlist.encoreSongs;
  if (!Array.isArray(list)) return [];
  return list.map((title) => normalizeSong(title)).filter(Boolean);
}

/**
 * First encore is primary `enc` and the first `encoreSongs` entry.
 * @returns {"none" | "first" | "later"}
 */
function encorePlacement(actualSetlist, guessNorm) {
  if (!guessNorm || !actualSetlist) return "none";
  const primary = normalizeSong(actualSetlist.enc);
  const list = encoreTitles(actualSetlist);
  const first = new Set();
  if (primary) first.add(primary);
  if (list[0]) first.add(list[0]);
  if (first.has(guessNorm)) return "first";
  if (list.some((title, index) => index > 0 && title === guessNorm)) return "later";
  return "none";
}

/** Ladder v1 encore exact: primary `enc` or any `encoreSongs` entry. */
function guessMatchesEncoreExact(actualSetlist, guessNorm) {
  const place = encorePlacement(actualSetlist, guessNorm);
  return place === "first" || place === "later";
}

function buildAllPlayedNormalized(actualSetlist) {
  const fromSlots = [];
  for (const [key, val] of Object.entries(actualSetlist || {})) {
    if (NON_SONG_SETLIST_KEYS.has(key)) continue;
    if (typeof val !== "string") continue;
    const t = val.trim();
    if (!t) continue;
    fromSlots.push(normalizeSong(t));
  }

  const rawOfficial = actualSetlist.officialSetlist;
  const fromOfficial = Array.isArray(rawOfficial)
    ? rawOfficial
        .map((s) =>
          typeof s === "string" ? s.trim() : String(s ?? "").trim()
        )
        .filter(Boolean)
        .map((s) => normalizeSong(s))
    : [];

  const combined = [...fromSlots, ...fromOfficial];
  return [...new Set(combined)];
}

/** True if the persisted official payload contains at least one played song (slots + ordered list). */
function setlistHasAnyPlayedSong(actualSetlist) {
  return buildAllPlayedNormalized(actualSetlist).length > 0;
}

/**
 * @returns {{ points: number, base: number, bustoutBoost: boolean, kind: string }}
 */
function slotScoreBreakdown(fieldId, guessedSong, actualSetlist, explicitShowDate) {
  if (!actualSetlist || !guessedSong) {
    return { points: 0, base: 0, bustoutBoost: false, kind: "none" };
  }

  const guess = normalizeSong(guessedSong);
  if (!guess) return { points: 0, base: 0, bustoutBoost: false, kind: "none" };

  const rules = rulesForPayload(actualSetlist, explicitShowDate);
  const allPlayed = buildAllPlayedNormalized(actualSetlist);

  let base = 0;
  let kind = "exact_slot";
  if (fieldId === "wild") {
    if (allPlayed.includes(guess)) {
      base = rules.WILDCARD_HIT;
      kind = "wildcard_hit";
    } else {
      return { points: 0, base: 0, bustoutBoost: false, kind: "miss" };
    }
  } else if (fieldId === "enc") {
    const place = encorePlacement(actualSetlist, guess);
    if (place === "first") {
      base = rules.ENCORE_EXACT;
      kind = "encore_exact";
    } else if (place === "later") {
      base = rules.ENCORE_LATER;
      kind = rules.id === "v2" ? "encore_later" : "encore_exact";
    } else if (allPlayed.includes(guess)) {
      base = rules.IN_SETLIST;
      kind = "in_setlist";
    } else {
      return { points: 0, base: 0, bustoutBoost: false, kind: "miss" };
    }
  } else if (normalizeSong(actualSetlist[fieldId]) === guess) {
    base = rules.EXACT_SLOT;
    kind = "exact_slot";
  } else if (allPlayed.includes(guess)) {
    base = rules.IN_SETLIST;
    kind = "in_setlist";
  } else {
    return { points: 0, base: 0, bustoutBoost: false, kind: "miss" };
  }

  const bustoutList = Array.isArray(actualSetlist.bustouts)
    ? actualSetlist.bustouts
    : [];
  let bustoutBoost = false;
  for (const raw of bustoutList) {
    if (typeof raw !== "string") continue;
    if (normalizeSong(raw) === guess) {
      bustoutBoost = true;
      break;
    }
  }

  const points = base + (bustoutBoost ? rules.BUSTOUT_BOOST : 0);
  return { points, base, bustoutBoost, kind };
}

function calculateSlotScore(fieldId, guessedSong, actualSetlist, showDate) {
  return slotScoreBreakdown(fieldId, guessedSong, actualSetlist, showDate).points;
}

/**
 * Slots whose bustout boost actually fired.
 *
 * A miss returns before the boost in `calculateSlotScore`, so a bustout title
 * that was not a hit does not count. Stripping `bustouts` yields the base
 * score; the boost fired only when that base is positive and the guess is on
 * the show's bustout list.
 *
 * @param {Record<string, unknown> | null | undefined} userPicks
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @returns {number}
 */
function countBustoutBoosts(userPicks, actualSetlist) {
  if (!actualSetlist || !userPicks) return 0;
  const withoutBoosts = { ...actualSetlist, bustouts: [] };
  let n = 0;
  for (const fieldId of SCORE_FIELDS) {
    const guessed = userPicks[fieldId];
    if (guessed == null || String(guessed).trim() === "") continue;
    if (calculateSlotScore(fieldId, guessed, withoutBoosts) <= 0) continue;
    if (guessIsListedBustout(guessed, actualSetlist)) n += 1;
  }
  return n;
}

/**
 * @param {unknown} guessedSong
 * @param {Record<string, unknown>} actualSetlist
 * @returns {boolean}
 */
function guessIsListedBustout(guessedSong, actualSetlist) {
  const guess = normalizeSong(guessedSong);
  if (!guess) return false;
  const bustoutList = Array.isArray(actualSetlist.bustouts)
    ? actualSetlist.bustouts
    : [];
  for (const raw of bustoutList) {
    if (typeof raw !== "string") continue;
    if (normalizeSong(raw) === guess) return true;
  }
  return false;
}

function calculateTotalScore(userPicks, actualSetlist, showDate) {
  if (!actualSetlist || !userPicks) return 0;
  return SCORE_FIELDS.reduce((total, fieldId) => {
    return (
      total +
      calculateSlotScore(fieldId, userPicks[fieldId], actualSetlist, showDate)
    );
  }, 0);
}

/**
 * Count pick slots that scored > 0 (exact, in-setlist, wildcard, or bustout).
 * Used for `users.careerCorrectSlots` (#554) — denominator is always
 * `SCORE_FIELDS.length` per graded show, not filled-slot count.
 *
 * @param {Record<string, unknown> | null | undefined} userPicks
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @returns {number}
 */
function countCorrectSlots(userPicks, actualSetlist) {
  if (!actualSetlist || !userPicks) return 0;
  let n = 0;
  for (const fieldId of SCORE_FIELDS) {
    if (calculateSlotScore(fieldId, userPicks[fieldId], actualSetlist) > 0) {
      n += 1;
    }
  }
  return n;
}

/** Mirrors `src/shared/utils/officialSetlistSanitize.js` (trim / drop empties). */
function sanitizeOfficialSongList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => (typeof s === "string" ? s.trim() : String(s ?? "").trim()))
    .filter(Boolean);
}

function sanitizeBustouts(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const title = typeof raw === "string" ? raw.trim() : "";
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/**
 * Raw Firestore `official_setlists` doc → scoring shape **after** the same
 * trimming / list hygiene as `saveOfficialSetlistByDate` (#320 server parity).
 */
function persistableActualSetlistFromOfficialDoc(setlistDoc) {
  const rawSetlist =
    setlistDoc && typeof setlistDoc === "object" ? setlistDoc.setlist || {} : {};
  const out = {};
  for (const fieldId of SCORE_FIELDS) {
    const v = rawSetlist[fieldId];
    out[fieldId] = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  }
  out.officialSetlist = sanitizeOfficialSongList(setlistDoc?.officialSetlist);

  let encoreSongs = [];
  const rawEnc = setlistDoc?.encoreSongs;
  if (Array.isArray(rawEnc) && rawEnc.length > 0) {
    encoreSongs = sanitizeOfficialSongList(rawEnc);
  } else if (out.enc) {
    encoreSongs = [out.enc];
  }
  if (encoreSongs.length > 0) {
    out.encoreSongs = encoreSongs;
  }
  if (Array.isArray(setlistDoc?.bustouts)) {
    out.bustouts = sanitizeBustouts(setlistDoc.bustouts);
  }
  return out;
}

function actualSetlistFromOfficialDoc(setlistDoc) {
  const setlistFlat = setlistDoc.setlist || {};
  const out = {
    ...setlistFlat,
    officialSetlist: Array.isArray(setlistDoc.officialSetlist)
      ? setlistDoc.officialSetlist
      : [],
  };
  if (Array.isArray(setlistDoc.encoreSongs) && setlistDoc.encoreSongs.length > 0) {
    out.encoreSongs = setlistDoc.encoreSongs;
  }
  // Per-show bustout snapshot for scoring (#214). Absence/empty → no boost.
  if (Array.isArray(setlistDoc.bustouts)) {
    out.bustouts = setlistDoc.bustouts;
  }
  return out;
}

/**
 * Stable JSON for playable-setlist equality (#416). `persistableActualSetlistFromOfficialDoc`
 * always emits SCORE_FIELDS in fixed order, so stringify is sufficient.
 *
 * @param {Record<string, unknown> | null | undefined} playable
 */
function playableSetlistFingerprint(playable) {
  if (!playable || typeof playable !== "object") return "";
  return JSON.stringify(playable);
}

/**
 * True when before/after official_setlists docs yield the same scoring payload
 * (metadata-only writes should not re-grade every pick).
 *
 * @param {Record<string, unknown> | null | undefined} beforeDoc
 * @param {Record<string, unknown> | null | undefined} afterDoc
 */
function shouldSkipLiveScoreRecompute(beforeDoc, afterDoc) {
  if (!afterDoc || typeof afterDoc !== "object") return true;
  if (!beforeDoc || typeof beforeDoc !== "object") return false;
  const before = persistableActualSetlistFromOfficialDoc(beforeDoc);
  const after = persistableActualSetlistFromOfficialDoc(afterDoc);
  return playableSetlistFingerprint(before) === playableSetlistFingerprint(after);
}

module.exports = {
  SCORING_RULES,
  SCORING_LADDER_V1,
  SCORING_LADDER_V2,
  SCORING_LADDER_V2_EFFECTIVE_DATE,
  SCORE_FIELDS,
  NON_SONG_SETLIST_KEYS,
  normalizeSong,
  normalizeShowDate,
  scoringRulesForShowDate,
  attachScoringShowDate,
  encorePlacement,
  guessMatchesEncoreExact,
  buildAllPlayedNormalized,
  setlistHasAnyPlayedSong,
  slotScoreBreakdown,
  calculateSlotScore,
  calculateTotalScore,
  countBustoutBoosts,
  countCorrectSlots,
  actualSetlistFromOfficialDoc,
  persistableActualSetlistFromOfficialDoc,
  playableSetlistFingerprint,
  shouldSkipLiveScoreRecompute,
};

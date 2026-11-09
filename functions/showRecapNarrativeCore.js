/**
 * Per-user show_recap narrative + scorecard enrichment (#572 / #985).
 *
 * Composer contract: every narrative_line weaves arc + your card + relative
 * night rank when those facts exist. Deterministic. No LLM. Soft-fail to the
 * #572 highlight wrappers when context is missing.
 */

"use strict";

const {
  SCORE_FIELDS,
  attachScoringShowDate,
  calculateSlotScore,
  encorePlacement,
  scoringRulesForShowDate,
  SCORING_RULES,
} = require("./scoringCore");
const { formatBustoutSongGap, composeNightSetFlow } = require("./commsShowContextCore");
const { buildShowRecapFactLabel } = require("./commsFactLabel");

const SLOT_RESULT_KEYS = {
  s1o: "opener_result",
  s1c: "s1_closer_result",
  s2o: "s2_opener_result",
  s2c: "closer_result",
  enc: "encore_result",
  wild: "wildcard_result",
};

const SLOT_PROSE = {
  s1o: "opener",
  s1c: "set 1 closer",
  s2o: "set 2 opener",
  s2c: "closer",
  enc: "encore",
  wild: "wildcard",
};

/**
 * @param {number} slotScore
 * @returns {"✓" | "✗"}
 */
function markFromSlotScore(slotScore) {
  return slotScore > 0 ? "✓" : "✗";
}

/**
 * @param {string[]} items
 * @returns {string}
 */
/**
 * @param {unknown} value
 * @returns {string}
 */
function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} value
 * @returns {string}
 */
function ensurePeriod(value) {
  const t = String(value || "").trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * @param {Record<string, unknown> | null | undefined} userPicks
 * @param {Record<string, unknown> | null | undefined} actualSetlist
 * @param {{ title: string, gap?: number | null }[]} [bustoutEntries]
 */
function buildUserShowScorecard(userPicks, actualSetlist, bustoutEntries = []) {
  const picks = userPicks && typeof userPicks === "object" ? userPicks : {};
  let correct = 0;
  let submitted = 0;
  let bustoutBonus = 0;
  let userHitBustout = false;
  /** @type {{ title: string, gap: number | null }[]} */
  const userBustoutHits = [];
  /** @type {Record<string, string>} */
  const results = {};
  /** @type {{ fieldId: string, label: string, title: string | null, hit: boolean, submitted: boolean }[]} */
  const slot_hits = [];

  const entryByNorm = new Map();
  for (const e of bustoutEntries || []) {
    if (!e?.title) continue;
    entryByNorm.set(String(e.title).trim().toLowerCase(), e);
  }

  const bustouts = Array.isArray(actualSetlist?.bustouts)
    ? actualSetlist.bustouts.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [...entryByNorm.keys()];

  for (const fieldId of SCORE_FIELDS) {
    const guess = picks[fieldId];
    const hasGuess = typeof guess === "string" && guess.trim();
    if (hasGuess) submitted += 1;
    const slotScore = calculateSlotScore(fieldId, guess, actualSetlist);
    if (slotScore > 0) correct += 1;

    const resultKey = SLOT_RESULT_KEYS[fieldId];
    if (
      resultKey &&
      (fieldId === "s1o" || fieldId === "s2c" || fieldId === "enc" || fieldId === "wild")
    ) {
      results[resultKey] = hasGuess ? markFromSlotScore(slotScore) : "—";
    }

    const guessNorm = String(guess ?? "")
      .trim()
      .toLowerCase();
    let exact = false;
    if (slotScore > 0) {
      if (fieldId === "wild") {
        exact = true;
      } else if (fieldId === "enc") {
        const place = encorePlacement(actualSetlist, guessNorm);
        const ladder = scoringRulesForShowDate(actualSetlist?.showDate);
        exact =
          ladder.id === "v2"
            ? place === "first"
            : place === "first" || place === "later";
      } else {
        exact = guessNorm === String(actualSetlist?.[fieldId] || "").trim().toLowerCase();
      }
    }
    slot_hits.push({
      fieldId,
      label: SLOT_PROSE[fieldId] || fieldId,
      title: hasGuess ? String(guess).trim() : null,
      hit: slotScore > 0,
      exact,
      inSetlist: slotScore > 0 && !exact,
      submitted: Boolean(hasGuess),
    });
    if (guessNorm && slotScore > 0 && bustouts.includes(guessNorm)) {
      userHitBustout = true;
      bustoutBonus += SCORING_RULES.BUSTOUT_BOOST;
      const entry = entryByNorm.get(guessNorm);
      const title =
        (typeof guess === "string" && guess.trim()) ||
        entry?.title ||
        guessNorm;
      if (!userBustoutHits.some((h) => h.title.toLowerCase() === title.toLowerCase())) {
        userBustoutHits.push({
          title,
          gap: entry?.gap ?? null,
        });
      }
    }
  }

  return {
    correct_picks_count: submitted ? correct : null,
    // Always the game's six slots (s1o/s1c/s2o/s2c/enc/wild) — not "how many
    // fields the user filled" — so copy reads "3 of 6", not "3 of 4".
    total_picks_count: submitted ? SCORE_FIELDS.length : null,
    opener_result: results.opener_result || null,
    closer_result: results.closer_result || null,
    encore_result: results.encore_result || null,
    wildcard_result: results.wildcard_result || null,
    bustout_bonus: bustoutBonus,
    user_hit_bustout: userHitBustout,
    user_bustout_hits: userBustoutHits,
    slot_hits,
  };
}

/**
 * Deterministic narrative branch.
 * @param {{
 *   show_score?: number | null,
 *   correct_picks_count?: number | null,
 *   total_picks_count?: number | null,
 *   user_hit_bustout?: boolean,
 * }} scorecard
 * @returns {"bustout_hero" | "hot_night" | "mixed" | "cold"}
 */
function resolveNarrativeBranch(scorecard) {
  if (scorecard.user_hit_bustout) return "bustout_hero";
  const score = typeof scorecard.show_score === "number" ? scorecard.show_score : 0;
  const correct = scorecard.correct_picks_count;
  const total = scorecard.total_picks_count;
  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    if (correct >= Math.ceil(total * 0.75) || score >= 50) return "hot_night";
    if (correct === 0 || score < 15) return "cold";
    return "mixed";
  }
  if (score >= 50) return "hot_night";
  if (score < 15) return "cold";
  return "mixed";
}

/**
 * #572 highlight wrappers — used only when the composer has no facts.
 * @param {{
 *   narrative_branch?: string,
 *   user_bustout_hits?: { title: string, gap?: number | null }[],
 *   setlist_highlight?: string | null,
 * }} p
 * @returns {string}
 */
function buildLegacyNarrativeLine(p) {
  const highlight = trimText(p.setlist_highlight);
  switch (p.narrative_branch) {
    case "bustout_hero": {
      const hits = Array.isArray(p.user_bustout_hits) ? p.user_bustout_hits : [];
      const songGap = formatBustoutSongGap(hits);
      if (songGap) return `You caught a bustout — ${songGap}.`;
      if (highlight) return `You caught a bustout — ${highlight.replace(/\.$/, "")}.`;
      return "You caught a bustout.";
    }
    case "hot_night":
      return highlight
        ? `Strong night. ${highlight}`
        : "Strong night — your board landed.";
    case "cold":
      return highlight
        ? `Tough board. Still a night to remember: ${highlight}`
        : "Tough board tonight — standings still have the full picture.";
    case "mixed":
    default:
      return highlight
        ? highlight
        : "Your night is graded — open standings for the breakdown.";
  }
}

/**
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function composeArcSentence(p) {
  const flow = trimText(p.set_flow_summary);
  if (flow) return ensurePeriod(flow);
  const opener = trimText(p.opener_title);
  const encore = trimText(p.encore_title);
  if (opener && encore) return `${opener} opened; ${encore} closed the night.`;
  if (opener) return `${opener} opened the night.`;
  if (encore) return `Encore: ${encore}.`;
  return "";
}

/**
 * @param {Record<string, unknown>} p
 * @returns {boolean}
 */
function hasBoardFacts(p) {
  const slots = Array.isArray(p.slot_hits) ? p.slot_hits : [];
  return slots.some((s) => s && s.submitted) || typeof p.correct_picks_count === "number";
}

/**
 * Titles the official set actually played. Null when the payload has no set.
 * @param {Record<string, unknown>} p
 * @returns {Set<string> | null}
 */
function playedTitleKeys(p) {
  const songs = p.set_songs;
  if (songs && typeof songs === "object") {
    const titles = []
      .concat(songs.set1 || [], songs.set2 || [], songs.encore || [])
      .map((title) => String(title).trim().toLowerCase())
      .filter(Boolean);
    if (titles.length) return new Set(titles);
  }
  const official = p.actualSetlist && p.actualSetlist.officialSetlist;
  if (Array.isArray(official) && official.length) {
    return new Set(official.map((title) => String(title).trim().toLowerCase()).filter(Boolean));
  }
  return null;
}

/**
 * @param {unknown} title
 * @param {Set<string> | null} played
 */
function titleWasPlayed(title, played) {
  if (!played) return true;
  return played.has(String(title ?? "").trim().toLowerCase());
}

/**
 * @param {unknown} gap
 * @returns {string}
 */
function caughtGapDash(gap) {
  const n = Number(gap);
  if (!Number.isFinite(n) || n <= 0) return "";
  const abs = Math.trunc(n);
  const s = String(abs);
  const article = s === "11" || s === "18" || s.startsWith("8") ? "an" : "a";
  return ` — ${article} ${abs} show gap —`;
}

/**
 * @param {string} title
 * @param {unknown} gap
 * @returns {string}
 */
function missedBustoutSentence(title, gap) {
  const n = Number(gap);
  if (!Number.isFinite(n) || n <= 0) return `${title} stayed off your board.`;
  const abs = Math.trunc(n);
  const s = String(abs);
  const article = s === "11" || s === "18" || s.startsWith("8") ? "an" : "a";
  return `${title} (${article} ${abs} show gap) stayed off your board.`;
}

/**
 * @param {string[]} labels
 * @returns {string}
 */
function joinSlotLabels(labels) {
  const named = labels.filter(Boolean).map((label) => `the ${label}`);
  if (named.length <= 1) return named[0] || "";
  if (named.length === 2) return `${named[0]} and ${named[1]}`;
  return `${named.slice(0, -1).join(", ")}, and ${named[named.length - 1]}`;
}

/**
 * First true player slot from the night map. A caught bustout wins over a
 * named slot so the song and gap are spoken once, on the player line.
 * @param {Record<string, unknown>} p
 * @returns {{ text: string, slot: string | null, omitTitles: string[] }}
 */
function composePlayerFacts(p) {
  const empty = { text: "", slot: null, omitTitles: [] };
  if (!hasBoardFacts(p)) return empty;
  const slots = Array.isArray(p.slot_hits) ? p.slot_hits : [];
  const total = typeof p.total_picks_count === "number" ? p.total_picks_count : 6;
  const correct =
    typeof p.correct_picks_count === "number" ? p.correct_picks_count : null;
  if (correct != null && total > 0 && correct === total) {
    return { text: "You hit all six.", slot: "all_six", omitTitles: [] };
  }
  if (correct === 0) {
    return { text: "None of your six landed.", slot: "none_hit", omitTitles: [] };
  }

  const played = playedTitleKeys(p);
  const userHits = (Array.isArray(p.user_bustout_hits) ? p.user_bustout_hits : []).filter(
    (hit) => hit && hit.title && titleWasPlayed(hit.title, played),
  );
  if (p.user_hit_bustout && userHits.length) {
    const hit = userHits[0];
    const slot = slots.find(
      (row) =>
        row &&
        row.title &&
        String(row.title).trim().toLowerCase() === String(hit.title).trim().toLowerCase(),
    );
    const where = slot && slot.label ? ` on your ${slot.label}` : "";
    const gap = caughtGapDash(hit.gap);
    const text = gap
      ? `You caught ${hit.title}${gap}${where}.`
      : `You caught ${hit.title}${where}.`;
    return { text, slot: "bustout_caught", omitTitles: [String(hit.title)] };
  }

  const exact = slots.filter(
    (row) => row && row.hit && row.exact !== false && row.inSetlist !== true && row.label,
  );
  if (exact.length) {
    const debuts =
      p.tour_debuts_trusted === true
        ? new Set(
            (Array.isArray(p.tour_debut_titles) ? p.tour_debut_titles : []).map((title) =>
              String(title).trim().toLowerCase(),
            ),
          )
        : new Set();
    const onlyDebuts =
      debuts.size > 0 &&
      exact.every((row) => debuts.has(String(row.title || "").trim().toLowerCase()));
    if (onlyDebuts) {
      const names = exact.map((row) => row.title).filter(Boolean);
      const verb = names.length === 1 ? "was" : "were";
      const where = names.length === 1 ? `, and it was your ${exact[0].label}` : "";
      return {
        text: `${names.join(" and ")} ${verb} new to the tour${where}.`,
        slot: "tour_debut",
        omitTitles: names.map(String),
      };
    }
    return {
      text: `You hit ${joinSlotLabels(exact.map((row) => row.label))}.`,
      slot: "named_slots",
      omitTitles: [],
    };
  }

  const wrong = slots.filter(
    (row) =>
      row &&
      row.hit &&
      (row.exact === false || row.inSetlist === true) &&
      row.title &&
      row.label,
  );
  if (wrong.length) {
    const row = wrong[0];
    return {
      text: `${row.title} was in the show, just not your ${row.label}.`,
      slot: "wrong_slot",
      omitTitles: [],
    };
  }

  const missed = (Array.isArray(p.bustout_entries) ? p.bustout_entries : []).filter(
    (entry) => entry && entry.title && titleWasPlayed(entry.title, played),
  );
  if (missed.length && !p.user_hit_bustout) {
    const entry = missed[0];
    return {
      text: missedBustoutSentence(String(entry.title), entry.gap),
      slot: "bustout_missed",
      omitTitles: [String(entry.title)],
    };
  }

  return empty;
}

/**
 * Set-by-set flow when the payload has the night's songs. Empty otherwise,
 * and the saved arc sentence is used instead.
 * @param {Record<string, unknown>} p
 * @param {string[]} omitTitles
 * @returns {{ text: string, slots: string[] }}
 */
function nightFlowFromPayload(p, omitTitles) {
  const songs = p.set_songs;
  if (!songs || typeof songs !== "object") return { text: "", slots: [] };
  const groups = {
    set1: Array.isArray(songs.set1) ? songs.set1 : [],
    set2: Array.isArray(songs.set2) ? songs.set2 : [],
    encore: Array.isArray(songs.encore) ? songs.encore : [],
  };
  if (!groups.set1.length && !groups.set2.length && !groups.encore.length) {
    return { text: "", slots: [] };
  }
  return composeNightSetFlow({
    groups,
    songGaps: p.song_gaps && typeof p.song_gaps === "object" ? p.song_gaps : {},
    bustoutTitles: Array.isArray(p.bustout_titles) ? p.bustout_titles : [],
    tourDebutTitles: Array.isArray(p.tour_debut_titles) ? p.tour_debut_titles : [],
    debutsTrusted: p.tour_debuts_trusted === true,
    lastPlayed: p.last_played && typeof p.last_played === "object" ? p.last_played : {},
    lifetimePlays: p.lifetime_plays && typeof p.lifetime_plays === "object" ? p.lifetime_plays : {},
    omitTitles,
    opener: typeof p.opener_title === "string" ? p.opener_title : "",
    venue: typeof p.venue_name === "string" ? p.venue_name : "",
  });
}

/**
 * Your card — one player fact. Stock wrappers stay on the legacy line.
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function composeCardSentence(p) {
  return composePlayerFacts(p).text;
}

/**
 * Weave global (and pool when present) night rank. Tour rank_change stays
 * on the morning email tour paragraph — never here.
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function composeRelativeRankSentence(p) {
  const rankRaw = p.global_rank;
  const rank =
    rankRaw != null && Number.isFinite(Number(rankRaw)) ? Number(rankRaw) : null;
  if (rank == null) return "";
  const totalRaw = p.global_total_pickers;
  const total =
    totalRaw != null && Number.isFinite(Number(totalRaw))
      ? Number(totalRaw)
      : null;
  const of = total != null ? ` of ${total}` : "";
  const global = `#${rank}${of} globally`;

  let pool = "";
  const poolRankRaw = p.pool_rank;
  if (poolRankRaw != null && Number.isFinite(Number(poolRankRaw))) {
    const poolName = trimText(p.pool_name) || "your pool";
    const poolTotalRaw = p.pool_total_pickers;
    const poolOf =
      poolTotalRaw != null && Number.isFinite(Number(poolTotalRaw))
        ? ` of ${Number(poolTotalRaw)}`
        : "";
    pool = ` and #${Number(poolRankRaw)}${poolOf} in ${poolName}`;
  }

  let verb = "That puts you";
  if (total != null && total > 0) {
    const pct = rank / total;
    if (pct <= 0.15) verb = "That puts you";
    else if (pct >= 0.75) verb = "That lands you";
    else verb = "You sit";
  }
  return `${verb} ${global}${pool}.`;
}

/**
 * 2–4 short sentences: arc + card + relative night, each only when facts exist.
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function composeShowRecapNarrative(p) {
  const input = p && typeof p === "object" ? p : {};
  const player = composePlayerFacts(input);
  const flow = nightFlowFromPayload(input, player.omitTitles);
  const arc = flow.text || composeArcSentence(input);
  const rank = composeRelativeRankSentence(input);
  const parts = [arc, player.text, rank].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return buildLegacyNarrativeLine(input);
}

/**
 * Public composer entry (inbox Tonight / morning night-para / narrative_line).
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function buildNarrativePersonalLine(p) {
  return composeShowRecapNarrative(p);
}

/**
 * Merge show context + user scorecard into payload fields.
 * `slot_hits` stays composer-internal — not a declared catalog var.
 * @param {{
 *   showLevel?: Record<string, unknown>,
 *   userPicks?: Record<string, unknown> | null,
 *   actualSetlist?: Record<string, unknown> | null,
 *   show_score?: number | null,
 *   top_scorer_handle?: string | null,
 *   top_score?: number | null,
 *   global_rank?: number | null,
 *   global_total_pickers?: number | null,
 *   pool_name?: string | null,
 *   pool_rank?: number | null,
 *   pool_total_pickers?: number | null,
 *   showDate?: string | null,
 * }} input
 */
function buildShowRecapEnrichment({
  showLevel = {},
  userPicks = null,
  actualSetlist = null,
  show_score = null,
  top_scorer_handle = null,
  top_score = null,
  global_rank = null,
  global_total_pickers = null,
  pool_name = null,
  pool_rank = null,
  pool_total_pickers = null,
  showDate = null,
} = {}) {
  const bustoutEntries = Array.isArray(showLevel.bustout_entries)
    ? showLevel.bustout_entries
    : [];
  const scorecard = buildUserShowScorecard(
    userPicks,
    attachScoringShowDate(actualSetlist, showDate),
    bustoutEntries
  );
  const { slot_hits, ...publicScorecard } = scorecard;
  const narrative_branch = resolveNarrativeBranch({
    ...scorecard,
    show_score,
  });
  const narrativeInput = {
    narrative_branch,
    user_hit_bustout: scorecard.user_hit_bustout,
    user_bustout_hits: scorecard.user_bustout_hits,
    slot_hits,
    correct_picks_count: scorecard.correct_picks_count,
    total_picks_count: scorecard.total_picks_count,
    setlist_highlight: showLevel.setlist_highlight,
    set_flow_summary: showLevel.set_flow_summary,
    opener_title: showLevel.opener_title,
    encore_title: showLevel.encore_title,
    bustout_titles: showLevel.bustout_titles,
    bustout_entries: bustoutEntries,
    tour_debut_titles: showLevel.tour_debut_titles,
    tour_debuts_trusted: showLevel.tour_debuts_trusted === true,
    set_songs: showLevel.set_songs,
    song_gaps: showLevel.song_gaps,
    last_played: showLevel.last_played,
    venue_name: showLevel.venue_name,
    actualSetlist,
    show_score,
    global_rank,
    global_total_pickers,
    pool_name,
    pool_rank,
    pool_total_pickers,
  };
  const player = composePlayerFacts(narrativeInput);
  const flow = nightFlowFromPayload(narrativeInput, player.omitTitles);
  const rankSentence = composeRelativeRankSentence(narrativeInput);
  /** @type {string[]} */
  const slots = [...flow.slots];
  if (player.slot) slots.push(player.slot);
  if (rankSentence) slots.push("night_rank");
  return {
    ...showLevel,
    ...publicScorecard,
    narrative_branch,
    top_scorer_handle: top_scorer_handle || null,
    top_score: top_score ?? null,
    narrative_line: composeShowRecapNarrative(narrativeInput),
    fact_label: buildShowRecapFactLabel({
      branch: narrative_branch,
      slots,
      showDate,
    }),
  };
}

module.exports = {
  SLOT_RESULT_KEYS,
  SLOT_PROSE,
  buildUserShowScorecard,
  resolveNarrativeBranch,
  buildNarrativePersonalLine,
  composeShowRecapNarrative,
  composeArcSentence,
  composeCardSentence,
  composeRelativeRankSentence,
  buildShowRecapEnrichment,
};

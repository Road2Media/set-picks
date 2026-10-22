/**
 * Pure helpers for the durable `tour_recap` trigger (#510, #1084).
 *
 * Night `show_recap` stays on `showRecapNarrativeCore.js`. The morning
 * standings paragraph stays on `tourRankingsDailyCore.js`. This module is
 * the end-of-tour wrap: one shared opening, a factual rank paragraph, and
 * at most one personal sentence.
 */

"use strict";

const { buildTourRecapFactLabel } = require("./commsFactLabel");
const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const { aggregateTourStandings, assignDisplayRanks } = require("./tourRankingsDailyCore");

const GUESS_FIELDS = ["s1o", "s1c", "s2o", "s2c", "enc", "wild"];

/**
 * @param {string[]} tourDates
 * @param {string} showDate
 * @returns {boolean}
 */
function isFinalShowOfTour(tourDates, showDate) {
  if (!Array.isArray(tourDates) || tourDates.length === 0 || typeof showDate !== "string") {
    return false;
  }
  const sorted = tourDates.filter((d) => typeof d === "string" && d.trim()).slice().sort();
  return sorted[sorted.length - 1] === showDate;
}

/**
 * @param {{ handle?: string, totalPoints?: number, wins?: number, shows?: number }} row
 * @returns {{ handle: string, note: string }}
 */
function honorableMention(row) {
  const pts = typeof row.totalPoints === "number" ? row.totalPoints : 0;
  const shows = typeof row.shows === "number" ? row.shows : 0;
  const wins = typeof row.wins === "number" ? row.wins : 0;
  const winBit = wins > 0 ? `, ${wins} nightly win${wins === 1 ? "" : "s"}` : "";
  return {
    handle: row.handle || "Anonymous",
    note: `${pts} pts across ${shows} show${shows === 1 ? "" : "s"}${winBit}.`,
  };
}

/**
 * @param {Array<{ handle?: string, totalPoints?: number }>} group
 * @returns {string}
 */
function joinedHandles(group) {
  const names = group.map((row) => row.handle || "Anonymous");
  if (names.length <= 1) return names[0] || "Anonymous";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Top 3, then 4th, then 5th. Anyone level with 5th on points is named in that last mention.
 *
 * @param {Array<{ handle: string, totalPoints: number, wins: number, shows: number }>} leaders
 * @returns {{ rows: Array<{ handle: string, points: number, wins: number }>, honorableMentions: Array<{ handle: string, note: string }> }}
 */
function buildTourRecapPodium(leaders) {
  const list = Array.isArray(leaders) ? leaders : [];
  const rows = list.slice(0, 3).map((row) => ({
    handle: row.handle || "Anonymous",
    points: typeof row.totalPoints === "number" ? row.totalPoints : 0,
    wins: typeof row.wins === "number" ? row.wins : 0,
  }));
  /** @type {Array<{ handle: string, note: string }>} */
  const honorableMentions = [];
  if (list[3]) honorableMentions.push(honorableMention(list[3]));
  if (list[4]) {
    const pts = typeof list[4].totalPoints === "number" ? list[4].totalPoints : 0;
    const tied = [list[4]];
    for (let i = 5; i < list.length; i += 1) {
      const nextPts = typeof list[i].totalPoints === "number" ? list[i].totalPoints : 0;
      if (nextPts !== pts) break;
      tied.push(list[i]);
    }
    if (tied.length === 1) {
      honorableMentions.push(honorableMention(tied[0]));
    } else {
      honorableMentions.push({
        handle: joinedHandles(tied),
        note: `tied at ${pts} pts.`,
      });
    }
  }
  return { rows, honorableMentions };
}

/**
 * Picking average, same ratio as the almost-end board: correct slots ÷ (nights × 6).
 * @param {number} correctSlots
 * @param {number} shows
 * @returns {string}
 */
function formatPickingAvg(correctSlots, shows) {
  const denom = shows * 6;
  if (!Number.isFinite(correctSlots) || !Number.isFinite(denom) || denom <= 0) return "";
  const s = Math.max(0, Math.min(1, correctSlots / denom)).toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

/**
 * Five rows for the email grid. A points tie keeps the shared rank. Avg is blank when the count is missing.
 *
 * @param {Array<{ handle?: string, totalPoints?: number, wins?: number, shows?: number, correctSlots?: number }>} leaders
 * @returns {Array<{ rank: number, handle: string, points: number, wins: number, nights: number, avg: string }>}
 */
function buildTourRecapEmailBoard(leaders) {
  const list = (Array.isArray(leaders) ? leaders : []).slice(0, 5);
  let rank = 0;
  let prevPoints = null;
  return list.map((row, i) => {
    const points = typeof row.totalPoints === "number" ? row.totalPoints : 0;
    if (prevPoints === null || points < prevPoints) rank = i + 1;
    prevPoints = points;
    const nights = typeof row.shows === "number" ? row.shows : 0;
    const correct = Number(row.correctSlots);
    return {
      rank,
      handle: row.handle || "Anonymous",
      points,
      wins: typeof row.wins === "number" ? row.wins : 0,
      nights,
      avg: formatPickingAvg(correct, nights),
    };
  });
}

/**
 * Last venue on the calendar row for this tour.
 *
 * @param {unknown} showDatesByTour
 * @param {string | null | undefined} tourKey
 * @returns {string}
 */
function closingVenueForTour(showDatesByTour, tourKey) {
  if (!tourKey || !Array.isArray(showDatesByTour)) return "";
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object" || group.tour !== tourKey) continue;
    const shows = Array.isArray(group.shows) ? group.shows : [];
    const dated = shows
      .filter((show) => show && typeof show.date === "string" && show.date.trim())
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const last = dated[dated.length - 1];
    return typeof last?.venue === "string" ? last.venue.trim() : "";
  }
  return "";
}

/**
 * "a" / "an" before a spoken gap number. Same rule as the night paragraph.
 * @param {number} n
 * @returns {"a" | "an"}
 */
function indefiniteArticleForGap(n) {
  const abs = Math.abs(Math.trunc(Number(n)));
  if (!Number.isFinite(abs)) return "a";
  const s = String(abs);
  if (s === "11" || s === "18" || s.startsWith("8")) return "an";
  return "a";
}

/**
 * @param {unknown} title
 * @returns {string}
 */
function titleKey(title) {
  return String(title ?? "").trim().toLowerCase();
}

/**
 * @param {unknown} songGaps
 * @param {string} title
 * @returns {number | null}
 */
function gapOf(songGaps, title) {
  if (!songGaps || typeof songGaps !== "object") return null;
  const n = Number(/** @type {Record<string, unknown>} */ (songGaps)[titleKey(title)]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Bustout titles whose exact title is in that night's official setlist.
 *
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {string} date
 * @returns {Array<{ title: string, gap: number | null, date: string }>}
 */
function bustoutsPlayed(doc, date) {
  const list = Array.isArray(doc?.officialSetlist) ? doc.officialSetlist : [];
  const played = new Set(list.map(titleKey).filter(Boolean));
  if (played.size === 0) return [];
  const titles = Array.isArray(doc?.bustouts) ? doc.bustouts : [];
  /** @type {Array<{ title: string, gap: number | null, date: string }>} */
  const out = [];
  const seen = new Set();
  for (const raw of titles) {
    const title = String(raw ?? "").trim();
    const key = titleKey(title);
    if (!title || !played.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, gap: gapOf(doc?.songGaps, title), date });
  }
  return out;
}

/**
 * @param {Array<{ date?: string, picks?: unknown[] }>} picksByDate
 * @returns {string}
 */
function leaderKey(picksByDate) {
  const ranked = assignDisplayRanks(aggregateTourStandings(picksByDate));
  /** @type {string[]} */
  const uids = [];
  for (const [uid, info] of ranked) {
    if (info.rank === 1) uids.push(uid);
  }
  return uids.sort().join(",");
}

/**
 * Nights the set of rank-1 players changed. The first night is the start, not a change.
 *
 * @param {Array<{ date?: string, picks?: unknown[] }>} picksByDate
 * @returns {Array<{ date: string, took: string[], lost: string[] }>}
 */
function deriveLeadChanges(picksByDate) {
  const dates = (Array.isArray(picksByDate) ? picksByDate : [])
    .filter((row) => row && typeof row.date === "string" && row.date.trim())
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /** @type {Array<{ date: string, took: string[], lost: string[] }>} */
  const changes = [];
  /** @type {string | null} */
  let prev = null;
  for (let i = 0; i < dates.length; i++) {
    const key = leaderKey(dates.slice(0, i + 1));
    if (prev != null && key !== prev) {
      const before = new Set(prev ? prev.split(",").filter(Boolean) : []);
      const after = new Set(key ? key.split(",").filter(Boolean) : []);
      changes.push({
        date: dates[i].date,
        took: [...after].filter((uid) => !before.has(uid)),
        lost: [...before].filter((uid) => !after.has(uid)),
      });
    }
    prev = key;
  }
  return changes;
}

/**
 * @param {{
 *   setlists?: Array<{ date?: string, doc?: Record<string, unknown> | null }>,
 *   picksByDate?: Array<{ date?: string, picks?: unknown[] }>,
 *   showCount?: number,
 *   closingVenue?: string,
 * }} input
 */
function deriveSharedWrapFacts(input = {}) {
  /** @type {{ title: string, gap: number, date: string } | null} */
  let rarest = null;
  for (const row of Array.isArray(input.setlists) ? input.setlists : []) {
    for (const hit of bustoutsPlayed(row?.doc, row?.date || "")) {
      if (hit.gap == null) continue;
      if (!rarest || hit.gap > rarest.gap) {
        rarest = { title: hit.title, gap: hit.gap, date: hit.date };
      }
    }
  }
  const dated = (Array.isArray(input.picksByDate) ? input.picksByDate : []).filter(
    (row) => row && typeof row.date === "string" && row.date.trim(),
  );
  const leadChanges = deriveLeadChanges(dated);
  return {
    rarestHit: rarest,
    leadChangeCount: dated.length >= 2 ? leadChanges.length : null,
    leadChanges,
    closingVenue: typeof input.closingVenue === "string" ? input.closingVenue.trim() : "",
    showCount: Number(input.showCount) || 0,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} pick
 * @returns {string[]}
 */
function guessTitles(pick) {
  const bag = pick?.picks && typeof pick.picks === "object" ? pick.picks : pick;
  return GUESS_FIELDS.map((field) => String(bag?.[field] ?? "").trim()).filter(Boolean);
}

/**
 * @param {unknown[] | undefined} picks
 * @param {string} uid
 */
function pickForUid(picks, uid) {
  return (Array.isArray(picks) ? picks : []).find((row) => {
    if (!row || typeof row !== "object") return false;
    if (!pickCountsTowardSeason(row)) return false;
    return String(row.userId || row.uid || "").trim() === uid;
  });
}

/**
 * A mark already stored on another tour. A one-tour account has no prior mark.
 *
 * @param {unknown} seasonStats
 * @param {string | null | undefined} tourKey
 * @param {number} points
 * @param {number} wins
 * @returns {"points" | "wins" | null}
 */
function personalMark(seasonStats, tourKey, points, wins) {
  if (!seasonStats || typeof seasonStats !== "object" || Array.isArray(seasonStats)) return null;
  const others = Object.entries(seasonStats).filter(([key]) => key !== tourKey);
  if (!others.length) return null;
  const maxPoints = Math.max(...others.map(([, row]) => Number(row?.totalPoints) || 0));
  const maxWins = Math.max(...others.map(([, row]) => Number(row?.wins) || 0));
  if (Number.isFinite(points) && points > maxPoints && points > 0) return "points";
  if (Number.isFinite(wins) && wins > maxWins && wins > 0) return "wins";
  return null;
}

/**
 * @param {{
 *   uid?: string,
 *   picksByDate?: Array<{ date?: string, picks?: unknown[] }>,
 *   setlists?: Array<{ date?: string, doc?: Record<string, unknown> | null }>,
 *   shared?: ReturnType<typeof deriveSharedWrapFacts> | null,
 *   seasonStats?: unknown,
 *   tourKey?: string | null,
 *   points?: number,
 *   wins?: number,
 *   showsPlayed?: number,
 *   showCount?: number,
 * }} input
 */
function derivePlayerWrapFacts(input = {}) {
  const uid = String(input.uid || "").trim();
  /** @type {Map<string, Record<string, unknown> | null>} */
  const setlistByDate = new Map();
  for (const row of Array.isArray(input.setlists) ? input.setlists : []) {
    if (row?.date) setlistByDate.set(row.date, row.doc || null);
  }

  /** @type {{ date: string, score: number } | null} */
  let best = null;
  /** @type {Array<{ title: string, gap: number | null, date: string }>} */
  const caught = [];
  for (const entry of Array.isArray(input.picksByDate) ? input.picksByDate : []) {
    const pick = pickForUid(entry?.picks, uid);
    if (!pick || typeof entry.date !== "string") continue;
    const score = typeof pick.score === "number" ? pick.score : 0;
    if (score > 0 && (!best || score > best.score || (score === best.score && entry.date < best.date))) {
      best = { date: entry.date, score };
    }
    const guesses = new Set(guessTitles(pick).map(titleKey));
    for (const hit of bustoutsPlayed(setlistByDate.get(entry.date), entry.date)) {
      const key = titleKey(hit.title);
      if (!guesses.has(key)) continue;
      const prev = caught.find((row) => titleKey(row.title) === key);
      if (!prev) {
        caught.push(hit);
      } else if (hit.gap != null && (prev.gap == null || hit.gap > prev.gap)) {
        prev.gap = hit.gap;
        prev.date = hit.date;
      }
    }
  }

  const rare =
    caught
      .filter((hit) => hit.gap != null)
      .slice()
      .sort((a, b) => b.gap - a.gap || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0] || null;

  /** @type {{ kind: "took" | "lost", date: string } | null} */
  let leadChange = null;
  for (const change of input.shared?.leadChanges || []) {
    if (change.took.includes(uid)) leadChange = { kind: "took", date: change.date };
    else if (change.lost.includes(uid)) leadChange = { kind: "lost", date: change.date };
  }

  const played = Number(input.showsPlayed);
  const total = Number(input.showCount);
  const satOut =
    Number.isFinite(played) && Number.isFinite(total) && total > played ? total - played : null;

  return {
    bestNight: best,
    bustoutsCaught: caught,
    rareHitPicked: rare,
    leadChange,
    showsSatOut: satOut,
    personalMark: personalMark(input.seasonStats, input.tourKey, Number(input.points), Number(input.wins)),
  };
}

/**
 * @param {string[]} titles
 * @returns {string}
 */
function joinTitles(titles) {
  if (titles.length <= 1) return titles[0] || "";
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

/**
 * @param {number} n
 * @returns {string}
 */
function winWord(n) {
  return Number(n) === 1 ? "nightly win" : "nightly wins";
}

/**
 * @param {{
 *   tourName?: string,
 *   tourId?: string,
 *   showCount?: number,
 *   participantCount?: number,
 *   rank?: number,
 *   points?: number,
 *   wins?: number,
 *   showsPlayed?: number,
 * }} input
 * @param {ReturnType<typeof deriveSharedWrapFacts> | null | undefined} shared
 * @param {ReturnType<typeof derivePlayerWrapFacts> | null | undefined} player
 */
function composeWrapCopy(input, shared, player) {
  const tourName = input.tourName || input.tourId || "this tour";
  const showCount = Number(input.showCount) || 0;
  const participantCount = Number(input.participantCount) || 0;
  /** @type {string[]} */
  const slots = [];

  let middle =
    `Calling setlists is an inexact science on a good day, and a ${showCount}-show run kept everyone honest. Despite the curveballs, ${participantCount} of you stepped up to lay down your picks.`;
  let openingSlot = "opening_fallback";
  if (shared?.rarestHit) {
    const hit = shared.rarestHit;
    middle = `The rarest hit of the run was ${hit.title}, ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap.`;
    openingSlot = "rarest_hit";
  } else if (shared?.leadChangeCount != null) {
    const n = shared.leadChangeCount;
    middle =
      n === 0
        ? "The tour lead never changed hands."
        : n === 1
          ? "The tour lead changed hands once."
          : `The tour lead changed hands ${n} times.`;
    openingSlot = "lead_changes";
  } else if (shared?.closingVenue && showCount > 0) {
    middle = `${shared.closingVenue} closed the run after ${showCount} shows.`;
    openingSlot = "closing_stand";
  }

  const rank = Number(input.rank);
  const points = Number(input.points);
  const wins = Number(input.wins);
  const played = Number(input.showsPlayed);
  /** @type {string[]} */
  const sentences = [];
  if (Number.isFinite(rank)) {
    const of = participantCount > 0 ? ` of ${participantCount}` : "";
    const pts = Number.isFinite(points) ? ` with ${points} points` : "";
    const win = Number.isFinite(wins) ? ` and ${wins} ${winWord(wins)}` : "";
    const shows =
      Number.isFinite(played) && showCount > 0 ? `, playing ${played} of ${showCount} shows` : "";
    sentences.push(`You finished #${rank}${of}${pts}${win}${shows}.`);
    slots.push("rank");
    if (Number.isFinite(points)) slots.push("points");
    if (Number.isFinite(wins)) slots.push("nightly_wins");
    if (Number.isFinite(played) && showCount > 0) slots.push("shows_played");
  }

  const rareKey = player?.rareHitPicked ? titleKey(player.rareHitPicked.title) : "";
  const listed = (player?.bustoutsCaught || []).filter((hit) => titleKey(hit.title) !== rareKey);
  if (player?.bestNight) {
    sentences.push(`Your best night was ${player.bestNight.date} with ${player.bestNight.score} points.`);
    slots.push("best_night");
  }
  if (listed.length) {
    sentences.push(`You caught ${joinTitles(listed.map((hit) => hit.title))}.`);
    slots.push("bustouts_caught");
  }
  if (player?.showsSatOut != null && player.showsSatOut > 0) {
    const n = player.showsSatOut;
    sentences.push(`You sat out ${n} ${n === 1 ? "show" : "shows"}.`);
    slots.push("shows_sat_out");
  }

  let personal = "";
  if (player?.rareHitPicked) {
    const hit = player.rareHitPicked;
    personal = `You caught ${hit.title} — ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap — on ${hit.date}.`;
    slots.push("rare_hit_picked");
  } else if (player?.leadChange) {
    personal =
      player.leadChange.kind === "took"
        ? `You took the lead on ${player.leadChange.date}.`
        : `You lost the lead on ${player.leadChange.date}.`;
    slots.push("lead_change_involved");
  } else if (player?.personalMark === "points") {
    personal = "This is your highest tour point total.";
    slots.push("personal_mark");
  } else if (player?.personalMark === "wins") {
    personal = "This is the most nightly wins you've had on a tour.";
    slots.push("personal_mark");
  }
  if (personal) sentences.push(personal);
  slots.push(openingSlot);

  return {
    opening_paras: [
      `${tourName} is officially in the books.`,
      middle,
      "Before the next run, here is the final tape.",
    ],
    personal_line: sentences.join(" "),
    personal_clause: personal,
    slots,
  };
}

/**
 * @param {{
 *   handle?: string,
 *   rank: number,
 *   tiedCount?: number,
 *   tiedHandles?: string[],
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount: number,
 *   tourId: string,
 *   tourName: string,
 *   showCount: number,
 *   podium: ReturnType<typeof buildTourRecapPodium>,
 *   emailBoard?: ReturnType<typeof buildTourRecapEmailBoard>,
 *   shared?: ReturnType<typeof deriveSharedWrapFacts> | null,
 *   player?: ReturnType<typeof derivePlayerWrapFacts> | null,
 * }} input
 */
function buildTourRecapPayload(input) {
  const tourName = input.tourName || input.tourId || "this tour";
  const showCount = Number(input.showCount) || 0;
  const participantCount = Number(input.participantCount) || 0;
  const copy = composeWrapCopy(input, input.shared, input.player);
  return {
    handle: input.handle || "Picker",
    rank: input.rank,
    tiedCount: Number.isFinite(Number(input.tiedCount)) ? Number(input.tiedCount) : 1,
    tiedHandles: Array.isArray(input.tiedHandles)
      ? input.tiedHandles.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
      : [],
    points: input.points,
    wins: input.wins,
    showsPlayed: input.showsPlayed,
    participantCount,
    tour_id: input.tourId,
    tour_name: tourName,
    show_count: showCount,
    headline: `${tourName}: Setlist Pick'em Wrap-Up`,
    podium: input.podium,
    email_board: Array.isArray(input.emailBoard) ? input.emailBoard : [],
    opening_paras: copy.opening_paras,
    personal_line: copy.personal_line,
    personal_clause: copy.personal_clause,
    closing_lines: [
      "Thank you to everyone who submitted picks and made this run a success. Setlist Pick'em will be back for the next stretch of shows.",
      "See you on the next run.",
    ],
    result_section_label: "Your final result",
    push_title: "Tour recap is in",
    fact_label: buildTourRecapFactLabel({
      rank: input.rank,
      points: input.points,
      wins: input.wins,
      showsPlayed: input.showsPlayed,
      showCount,
      tourId: input.tourId,
      slots: copy.slots,
    }),
  };
}

module.exports = {
  isFinalShowOfTour,
  buildTourRecapPodium,
  buildTourRecapEmailBoard,
  buildTourRecapPayload,
  closingVenueForTour,
  deriveSharedWrapFacts,
  derivePlayerWrapFacts,
};

/**
 * Pure helpers for the annual wrap (`annual_wrap`, #1111).
 *
 * Same two layers as the tour wrap: the shelf names a fact, this module
 * speaks it only when it is true. A missing fact drops its clause. The send
 * still goes. Night `show_recap` and `tour_recap` stay separate paragraphs.
 *
 * A year is the calendar year of the show date. A Dec 31 show stays in that
 * year. A Jan 1 show is the next year. The board is everyone with at least
 * one graded show that year, on or after game launch, using the tour
 * standings rules.
 *
 * Year crowd pulse is counted here at send time from that year's graded
 * picks and official setlists. The same block is copied onto every payload.
 * The personal section stays about that player.
 */

"use strict";

const { formatFanShowDate } = require("./fanShowDate.cjs");
const { hasNonEmptyPicksObject, pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const { calendarYearOfShowDate } = require("./calendarYearTourStats");
const { aggregateTourStandings, assignDisplayRanks } = require("./tourRankingsDailyCore");
const {
  buildTourRecapPodium,
  buildTourRecapEmailBoard,
  deriveSharedWrapFacts,
  derivePlayerWrapFacts,
} = require("./tourRecapCore");
const { buildAnnualWrapFactLabel } = require("./commsFactLabel");

/**
 * First night gameplay went live. Keep in sync with
 * `src/shared/config/gameLaunch.js`. Shows before this date are not on the
 * year board (#1110).
 */
const GAME_LAUNCH_SHOW_DATE = "2026-04-16";

/** A song named on fewer cards than this is not a hit rate. */
const MIN_HIT_RATE_CARDS = 10;

/** Most-picked names a song the room called on at least this many cards. */
const MIN_MOST_PICKED_CARDS = 2;

const MOST_PICKED_LIMIT = 3;

const GUESS_FIELDS = ["s1o", "s1c", "s2o", "s2c", "enc", "wild"];

const ANNUAL_WRAP_GRADE_CHANNELS = ["inApp"];
const ANNUAL_WRAP_MORNING_CHANNELS = ["inApp", "push", "email"];
const ANNUAL_WRAP_LOOKBACK_DAYS = 14;

/**
 * @param {unknown} title
 * @returns {string}
 */
function titleKey(title) {
  return String(title ?? "").trim().toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function speakDate(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const spoken = formatFanShowDate(value.trim());
  return typeof spoken === "string" && /^\d{2}\/\d{2}\/\d{2}$/.test(spoken) ? spoken : "";
}

/**
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
 * @param {string} venue
 * @param {string} city
 * @returns {string}
 */
function spokenVenue(venue, city) {
  const place = typeof venue === "string" ? venue.trim() : "";
  const town = typeof city === "string" ? city.trim() : "";
  if (!town) return place;
  if (!place) return town;
  if (place.toLowerCase().includes(town.toLowerCase())) return place;
  return `${place}, ${town}`;
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function joinNames(names) {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

/**
 * @param {number} aHits
 * @param {number} aPicks
 * @param {number} bHits
 * @param {number} bPicks
 * @returns {number}
 */
function compareRates(aHits, aPicks, bHits, bPicks) {
  const left = aHits * bPicks;
  const right = bHits * aPicks;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

/**
 * Calendar-year shows on or after game launch, one row per date, oldest first.
 * A later show still on the calendar keeps an earlier night from being the
 * last show of the year.
 *
 * @param {unknown} showDatesByTour
 * @param {number | string} year
 * @returns {Array<{ date: string, venue: string, city: string }>}
 */
function showsInCalendarYear(showDatesByTour, year) {
  const target = Number(year);
  if (!Number.isFinite(target)) return [];
  /** @type {Map<string, { date: string, venue: string, city: string }>} */
  const byDate = new Map();
  for (const group of Array.isArray(showDatesByTour) ? showDatesByTour : []) {
    const shows = Array.isArray(group?.shows) ? group.shows : [];
    for (const show of shows) {
      const date = typeof show?.date === "string" ? show.date.trim() : "";
      if (calendarYearOfShowDate(date) !== target) continue;
      if (date < GAME_LAUNCH_SHOW_DATE) continue;
      if (byDate.has(date)) continue;
      byDate.set(date, {
        date,
        venue: typeof show?.venue === "string" ? show.venue.trim() : "",
        city: typeof show?.city === "string" ? show.city.trim() : "",
      });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * @param {unknown} showDatesByTour
 * @returns {number[]}
 */
function calendarYearsOnCalendar(showDatesByTour) {
  /** @type {Set<number>} */
  const years = new Set();
  for (const group of Array.isArray(showDatesByTour) ? showDatesByTour : []) {
    const shows = Array.isArray(group?.shows) ? group.shows : [];
    for (const show of shows) {
      const year = calendarYearOfShowDate(typeof show?.date === "string" ? show.date.trim() : "");
      if (year && show.date >= GAME_LAUNCH_SHOW_DATE) years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * @param {string} showDate
 * @param {Array<{ date: string }>} shows
 * @returns {boolean}
 */
function isLastShowOfYear(showDate, shows) {
  if (!showDate || !Array.isArray(shows) || shows.length === 0) return false;
  return shows[shows.length - 1].date === showDate;
}

/**
 * @param {string} finalDate
 * @param {string} today YYYY-MM-DD in America/Los_Angeles
 * @returns {boolean}
 */
function shouldAttemptPendingAnnualWrap(finalDate, today) {
  if (!finalDate || !today || finalDate >= today) return false;
  const age = daysBetweenYmd(finalDate, today);
  if (!Number.isFinite(age)) return false;
  return age >= 1 && age <= ANNUAL_WRAP_LOOKBACK_DAYS;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function daysBetweenYmd(a, b) {
  const [ay, am, ad] = String(a).split("-").map((part) => Number.parseInt(part, 10));
  const [by, bm, bd] = String(b).split("-").map((part) => Number.parseInt(part, 10));
  if (![ay, am, ad, by, bm, bd].every((n) => Number.isFinite(n))) return NaN;
  const t0 = Date.UTC(ay, am - 1, ad);
  const t1 = Date.UTC(by, bm - 1, bd);
  return Math.round((t1 - t0) / 86400000);
}

/**
 * The last show is graded when every non-empty card that night is graded.
 * A finale nobody played is ready: the board is the earlier nights.
 *
 * @param {unknown[] | null | undefined} picks
 * @returns {boolean}
 */
function yearFinaleReady(picks) {
  const submitted = (Array.isArray(picks) ? picks : []).filter((row) =>
    hasNonEmptyPicksObject(row?.picks),
  );
  if (submitted.length === 0) return true;
  return submitted.every((row) => row?.isGraded === true);
}

/**
 * @param {Record<string, unknown> | null | undefined} doc
 * @returns {Set<string>}
 */
function playedTitleSet(doc) {
  const list = Array.isArray(doc?.officialSetlist) ? doc.officialSetlist : [];
  return new Set(list.map(titleKey).filter(Boolean));
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
 * Year crowd pulse. Counted from graded cards and official setlists.
 * A card names a song once. A hit means that exact title is in that night's
 * official setlist. A night with no official setlist is left out of this
 * count. A song with fewer than {@link MIN_HIT_RATE_CARDS} cards is not a rate.
 *
 * @param {Array<{ date?: string, picks?: unknown[] }>} picksByDate
 * @param {Array<{ date?: string, doc?: Record<string, unknown> | null }>} setlists
 * @returns {{
 *   songs: Array<{ title: string, cardCount: number, hits: number }>,
 *   mostPicked: Array<{ title: string, cardCount: number, hits: number }>,
 *   highestHitRate: Array<{ title: string, cardCount: number, hits: number }>,
 *   lowestHitRate: Array<{ title: string, cardCount: number, hits: number }>,
 *   uniqueSongs: number,
 *   calls: number,
 *   callHits: number,
 * }}
 */
function buildYearCrowdPulse(picksByDate, setlists) {
  /** @type {Map<string, { title: string, cardCount: number, hits: number }>} */
  const byKey = new Map();
  /** @type {Map<string, Set<string>>} */
  const playedByDate = new Map();
  for (const row of Array.isArray(setlists) ? setlists : []) {
    const date = typeof row?.date === "string" ? row.date : "";
    if (!date) continue;
    const played = playedTitleSet(row.doc);
    if (played.size === 0) continue;
    playedByDate.set(date, played);
  }

  for (const entry of Array.isArray(picksByDate) ? picksByDate : []) {
    const date = typeof entry?.date === "string" ? entry.date : "";
    const played = playedByDate.get(date);
    if (!played) continue;
    for (const pick of Array.isArray(entry.picks) ? entry.picks : []) {
      if (!pickCountsTowardSeason(pick)) continue;
      /** @type {Set<string>} */
      const seen = new Set();
      for (const title of guessTitles(pick)) {
        const key = titleKey(title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        let row = byKey.get(key);
        if (!row) {
          row = { title, cardCount: 0, hits: 0 };
          byKey.set(key, row);
        }
        row.cardCount += 1;
        if (played.has(key)) row.hits += 1;
      }
    }
  }

  const songs = [...byKey.values()].sort(
    (a, b) => b.cardCount - a.cardCount || a.title.localeCompare(b.title),
  );
  const mostPicked = songs.filter((song) => song.cardCount >= MIN_MOST_PICKED_CARDS).slice(0, MOST_PICKED_LIMIT);
  const rated = songs.filter((song) => song.cardCount >= MIN_HIT_RATE_CARDS);
  const highestHitRate = extremeHitRate(rated, "high");
  const lowestHitRate = extremeHitRate(rated, "low");
  const sameGroup =
    highestHitRate.length > 0 &&
    highestHitRate.length === lowestHitRate.length &&
    highestHitRate.every((song, index) => song.title === lowestHitRate[index]?.title);
  const calls = songs.reduce((sum, song) => sum + song.cardCount, 0);
  const callHits = songs.reduce((sum, song) => sum + song.hits, 0);
  return {
    songs,
    mostPicked,
    highestHitRate: sameGroup ? [] : highestHitRate,
    lowestHitRate: sameGroup ? [] : lowestHitRate,
    uniqueSongs: songs.length,
    calls,
    callHits,
  };
}

/**
 * @param {Array<{ title: string, cardCount: number, hits: number }>} rated
 * @param {"high" | "low"} direction
 * @returns {Array<{ title: string, cardCount: number, hits: number }>}
 */
function extremeHitRate(rated, direction) {
  if (!rated.length) return [];
  let best = rated[0];
  for (const song of rated.slice(1)) {
    const cmp = compareRates(song.hits, song.cardCount, best.hits, best.cardCount);
    if (direction === "high" ? cmp > 0 : cmp < 0) best = song;
  }
  return rated
    .filter((song) => compareRates(song.hits, song.cardCount, best.hits, best.cardCount) === 0)
    .sort((a, b) => b.cardCount - a.cardCount || a.title.localeCompare(b.title))
    .slice(0, MOST_PICKED_LIMIT);
}

/**
 * @param {number} hits
 * @param {number} picks
 * @returns {string}
 */
function callsPhrase(hits, picks) {
  if (hits === 0) return `none of ${picks} calls`;
  if (hits === picks) return `all ${picks} calls`;
  return `${hits} of ${picks} calls`;
}

/**
 * @param {Array<{ title: string, cardCount: number, hits: number }>} group
 * @returns {string}
 */
function hitRateNames(group) {
  if (group.length === 1) {
    const song = group[0];
    return `${song.title} (${callsPhrase(song.hits, song.cardCount)})`;
  }
  return joinNames(group.map((song) => `${song.title} (${callsPhrase(song.hits, song.cardCount)})`));
}

/**
 * The shared crowd-pulse block. Empty when the year has no counted songs.
 *
 * @param {ReturnType<typeof buildYearCrowdPulse>} pulse
 * @returns {{ text: string, slots: string[] }}
 */
function composeCrowdPulse(pulse) {
  /** @type {string[]} */
  const sentences = [];
  /** @type {string[]} */
  const slots = [];
  if (pulse.mostPicked.length) {
    const leadCount = pulse.mostPicked[0].cardCount;
    const leaders = pulse.mostPicked.filter((song) => song.cardCount === leadCount);
    const rest = pulse.mostPicked.filter((song) => song.cardCount !== leadCount);
    const each = leaders.length > 1 ? " each" : "";
    let sentence = `The room called ${joinNames(leaders.map((song) => song.title))} the most, on ${leadCount} cards${each}.`;
    if (rest.length === 1) {
      sentence = `The room called ${joinNames(leaders.map((song) => song.title))} the most, on ${leadCount} cards${each}, then ${rest[0].title} on ${rest[0].cardCount}.`;
    } else if (rest.length > 1) {
      const tail = rest.map((song) => `${song.title} on ${song.cardCount}`).join(" and ");
      sentence = `The room called ${joinNames(leaders.map((song) => song.title))} the most, on ${leadCount} cards${each}, then ${tail}.`;
    }
    sentences.push(sentence);
    slots.push("crowd_most_picked");
  }
  if (pulse.highestHitRate.length) {
    sentences.push(
      `Among songs the room called at least ${MIN_HIT_RATE_CARDS} times, ${hitRateNames(pulse.highestHitRate)} ${pulse.highestHitRate.length === 1 ? "was" : "were"} in the setlist the most.`,
    );
    slots.push("crowd_highest_hit_rate");
  }
  if (pulse.lowestHitRate.length) {
    sentences.push(
      `${hitRateNames(pulse.lowestHitRate)} ${pulse.lowestHitRate.length === 1 ? "was" : "were"} in the setlist the least.`,
    );
    slots.push("crowd_lowest_hit_rate");
  }
  if (pulse.uniqueSongs > 0) {
    const noun = pulse.uniqueSongs === 1 ? "song" : "songs";
    let sentence = `The room named ${pulse.uniqueSongs} different ${noun}.`;
    if (pulse.calls >= MIN_HIT_RATE_CARDS) {
      sentence += ` ${pulse.callHits} of ${pulse.calls} calls were in the setlist.`;
    }
    sentences.push(sentence);
    slots.push("crowd_room_rates");
  }
  return { text: sentences.join(" "), slots };
}

/**
 * First true race fact: rarest played song, otherwise the annual lead,
 * otherwise the closing show. Crowd pulse is not this sentence.
 *
 * @param {number} showCount
 * @param {number} participantCount
 * @param {ReturnType<typeof deriveSharedWrapFacts> | null | undefined} shared
 * @returns {{ text: string, slots: string[] }}
 */
function composeYearRaceFact(showCount, participantCount, shared) {
  const hit = shared?.rarestHit;
  if (hit && hit.title && hit.gap != null) {
    /** @type {string[]} */
    const where = [];
    const spoken = speakDate(hit.date);
    if (hit.openingNight && spoken) where.push(`on opening night, ${spoken}`);
    else if (hit.openingNight) where.push("on opening night");
    else if (spoken) where.push(`on ${spoken}`);
    if (hit.venue) where.push(`at ${hit.venue}`);
    /** @type {string[]} */
    const extra = [];
    const lastPlayed = speakDate(hit.lastPlayed);
    if (lastPlayed) extra.push(`last played ${lastPlayed}`);
    if (hit.debutYear) extra.push(`debut ${hit.debutYear}`);
    const whereBit = where.length ? `, ${where.join(", ")}` : "";
    const extraBit = extra.length ? `, ${extra.join(", ")}` : "";
    return {
      text: `The rarest song played all year was ${hit.title}, ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap${whereBit}${extraBit}.`,
      slots: ["rarest_hit"],
    };
  }
  if (shared?.leadChangeCount != null) {
    const n = shared.leadChangeCount;
    const count =
      n === 0
        ? "The annual lead never changed hands."
        : n === 1
          ? "The annual lead changed hands once."
          : `The annual lead changed hands ${n} times.`;
    const takeover = n > 0 ? shared.finalLead : null;
    if (takeover && takeover.handles?.length) {
      const when = speakDate(takeover.date);
      const where = takeover.venue ? ` at ${takeover.venue}` : "";
      const took = when
        ? `${joinNames(takeover.handles)} took it on ${when} and held it through the close${where}.`
        : `${joinNames(takeover.handles)} took it and held it through the close${where}.`;
      return { text: `${count} ${took}`, slots: ["lead_changes"] };
    }
    return { text: count, slots: ["lead_changes"] };
  }
  if (shared?.closingVenue && showCount > 0) {
    const noun = showCount === 1 ? "show" : "shows";
    return {
      text: `${shared.closingVenue} closed the year after ${showCount} ${noun}.`,
      slots: ["closing_stand"],
    };
  }
  return {
    text: `Calling setlists is an inexact science on a good day, and a ${showCount}-show year kept everyone honest. Despite the curveballs, ${participantCount} of you stepped up to lay down your picks.`,
    slots: ["opening_fallback"],
  };
}

/**
 * @param {number} n
 * @returns {string}
 */
function winWord(n) {
  return Number(n) === 1 ? "nightly win" : "nightly wins";
}

/**
 * A mark against an earlier calendar year already on the account.
 * No earlier year means no sentence.
 *
 * @param {{ points?: number, wins?: number } | null | undefined} prior
 * @param {number} points
 * @param {number} wins
 * @returns {"points" | "wins" | null}
 */
function yearPersonalMark(prior, points, wins) {
  if (!prior || typeof prior !== "object") return null;
  const maxPoints = Number(prior.points);
  const maxWins = Number(prior.wins);
  if (!Number.isFinite(maxPoints) && !Number.isFinite(maxWins)) return null;
  if (Number.isFinite(maxPoints) && points > maxPoints && points > 0) return "points";
  if (Number.isFinite(maxWins) && wins > maxWins && wins > 0) return "wins";
  return null;
}

/**
 * @param {{
 *   year?: string | number,
 *   showCount?: number,
 *   participantCount?: number,
 *   rank?: number,
 *   tiedCount?: number,
 *   tiedHandles?: string[],
 *   points?: number,
 *   wins?: number,
 *   showsPlayed?: number,
 *   priorYear?: { points?: number, wins?: number } | null,
 * }} input
 * @param {ReturnType<typeof deriveSharedWrapFacts> | null | undefined} shared
 * @param {ReturnType<typeof derivePlayerWrapFacts> | null | undefined} player
 * @param {ReturnType<typeof buildYearCrowdPulse>} pulse
 */
function composeAnnualWrapCopy(input, shared, player, pulse) {
  const year = String(input.year || "");
  const showCount = Number(input.showCount) || 0;
  const participantCount = Number(input.participantCount) || 0;
  const crowd = composeCrowdPulse(pulse);
  const race = composeYearRaceFact(showCount, participantCount, shared);
  /** @type {string[]} */
  const slots = [...crowd.slots, ...race.slots];

  const rank = Number(input.rank);
  const points = Number(input.points);
  const wins = Number(input.wins);
  const played = Number(input.showsPlayed);
  const tiedNames = Array.isArray(input.tiedHandles)
    ? input.tiedHandles.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
    : [];
  const explicitTied = Number(input.tiedCount);
  const tied = Number.isFinite(explicitTied) ? explicitTied > 1 : tiedNames.length > 0;
  /** @type {string[]} */
  const sentences = [];
  if (Number.isFinite(rank)) {
    const of = participantCount > 0 ? ` of ${participantCount}` : "";
    const pts = Number.isFinite(points) ? `${points} points` : "";
    const win = Number.isFinite(wins) ? `${wins} ${winWord(wins)}` : "";
    const shows =
      Number.isFinite(played) && showCount > 0 ? `, playing ${played} of ${showCount} shows` : "";
    const stats = [pts, win].filter(Boolean).join(" and ");
    if (tied) {
      const withNames = tiedNames.length ? ` with ${joinNames(tiedNames)}` : "";
      const statsBit = stats ? `, with ${stats}` : "";
      sentences.push(`You finished tied for #${rank}${of}${withNames}${statsBit}${shows}.`);
    } else {
      const statsBit = stats ? ` with ${stats}` : "";
      sentences.push(`You finished #${rank}${of}${statsBit}${shows}.`);
    }
    slots.push("rank");
    if (Number.isFinite(points)) slots.push("points");
    if (Number.isFinite(wins)) slots.push("nightly_wins");
    if (Number.isFinite(played) && showCount > 0) slots.push("shows_played");
  }

  const rareKey = player?.rareHitPicked ? titleKey(player.rareHitPicked.title) : "";
  const listed = (player?.bustoutsCaught || []).filter((hit) => titleKey(hit.title) !== rareKey);
  if (player?.bestNight && player.bestNight.score > 0) {
    const when = speakDate(player.bestNight.date) || player.bestNight.date;
    sentences.push(`Your best night was ${when} with ${player.bestNight.score} points.`);
    slots.push("best_night");
  }
  if (listed.length) {
    sentences.push(`You caught ${joinNames(listed.map((hit) => hit.title))}.`);
    slots.push("bustouts_caught");
  }
  if (player?.showsSatOut != null && player.showsSatOut > 0) {
    const n = player.showsSatOut;
    sentences.push(`You sat out ${n} ${n === 1 ? "show" : "shows"}.`);
    slots.push("shows_sat_out");
  }

  /** @type {string[]} */
  const beats = [];
  if (player?.rareHitPicked && player.rareHitPicked.gap != null) {
    const hit = player.rareHitPicked;
    const when = speakDate(hit.date) || hit.date;
    const venue = shared?.venueByDate?.[hit.date] || "";
    const where = venue ? ` at ${venue}` : "";
    const sameAsShared = Boolean(shared?.rarestHit) && titleKey(shared.rarestHit.title) === titleKey(hit.title);
    let tail = "";
    if (!sameAsShared) {
      const fact = shared?.catalogByTitle?.[titleKey(hit.title)];
      /** @type {string[]} */
      const bits = [];
      const lastPlayed = speakDate(fact?.lastPlayed);
      if (lastPlayed) bits.push(`last played ${lastPlayed}`);
      if (fact?.debutYear) bits.push(`debut ${fact.debutYear}`);
      if (bits.length) tail = `, ${bits.join(", ")}`;
    }
    beats.push(
      `You caught ${hit.title}, ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap, on ${when}${where}${tail}.`,
    );
    slots.push("rare_hit_picked");
  }
  if (player?.leadChange) {
    const when = speakDate(player.leadChange.date) || player.leadChange.date;
    beats.push(
      player.leadChange.kind === "took"
        ? `You took the lead on ${when}.`
        : `You lost the lead on ${when}.`,
    );
    slots.push("lead_change_involved");
  }
  const mark = yearPersonalMark(input.priorYear, points, wins);
  if (mark === "points") {
    beats.push("This is your highest year point total.");
    slots.push("personal_mark");
  } else if (mark === "wins") {
    beats.push("This is the most nightly wins you've had in a year.");
    slots.push("personal_mark");
  }
  sentences.push(...beats);

  const openingParas = [
    `${year} is officially in the books.`,
    crowd.text,
    race.text,
    "Before the next year, here is the final tape.",
  ].filter(Boolean);

  return {
    opening_paras: openingParas,
    crowd_summary: crowd.text,
    personal_line: sentences.join(" "),
    personal_clause: beats.join(" "),
    slots,
  };
}

/**
 * @param {ReturnType<typeof buildTourRecapPodium>} podium
 * @returns {ReturnType<typeof buildTourRecapPodium>}
 */
function withAnnualPlaceLabels(podium) {
  const retitle = (label, rank, tied) => (rank === 1 && !tied ? "Annual Winner" : label);
  return {
    ...podium,
    places: (podium.places || []).map((place) => ({
      ...place,
      label: retitle(place.label, place.rank, place.tied),
    })),
    rows: (podium.rows || []).map((row) => ({
      ...row,
      label: retitle(row.label, row.rank, row.tied),
    })),
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
 *   year: string,
 *   showCount: number,
 *   podium: ReturnType<typeof buildTourRecapPodium>,
 *   emailBoard?: ReturnType<typeof buildTourRecapEmailBoard>,
 *   shared?: ReturnType<typeof deriveSharedWrapFacts> | null,
 *   player?: ReturnType<typeof derivePlayerWrapFacts> | null,
 *   pulse: ReturnType<typeof buildYearCrowdPulse>,
 *   priorYear?: { points?: number, wins?: number } | null,
 * }} input
 */
function buildAnnualWrapPayload(input) {
  const year = String(input.year);
  const showCount = Number(input.showCount) || 0;
  const copy = composeAnnualWrapCopy(input, input.shared, input.player, input.pulse);
  return {
    handle: input.handle || "Picker",
    year,
    rank: input.rank,
    tiedCount: Number.isFinite(Number(input.tiedCount)) ? Number(input.tiedCount) : 1,
    tiedHandles: Array.isArray(input.tiedHandles)
      ? input.tiedHandles.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
      : [],
    points: input.points,
    wins: input.wins,
    showsPlayed: input.showsPlayed,
    participantCount: Number(input.participantCount) || 0,
    show_count: showCount,
    headline: `${year}: Setlist Pick'em Wrap-Up`,
    podium: input.podium,
    email_board: Array.isArray(input.emailBoard) ? input.emailBoard : [],
    opening_paras: copy.opening_paras,
    crowd_summary: copy.crowd_summary,
    personal_line: copy.personal_line,
    personal_clause: copy.personal_clause,
    closing_lines: [
      "Thank you to everyone who submitted picks and made this year a success. Setlist Pick'em will be back for the next stretch of shows.",
      "See you next year.",
    ],
    result_section_label: "Your year",
    push_title: "Annual wrap is in",
    fact_label: buildAnnualWrapFactLabel({
      rank: input.rank,
      points: input.points,
      wins: input.wins,
      showsPlayed: input.showsPlayed,
      showCount,
      year,
      slots: copy.slots,
    }),
  };
}

/**
 * One fan-out from data already loaded. Does not read Firestore and does not send.
 *
 * @param {{
 *   year: number | string,
 *   shows: Array<{ date: string, venue?: string, city?: string }>,
 *   picksByDate: Array<{ date: string, picks: unknown[] }>,
 *   setlists: Array<{ date: string, doc: Record<string, unknown> | null }>,
 *   songFacts?: { uniqueSongs?: number, bustouts?: unknown[] } | null,
 *   usersByUid?: Record<string, Record<string, unknown>>,
 *   priorYearByUid?: Record<string, { points?: number, wins?: number } | null>,
 * }} input
 */
function assembleAnnualWrapRecipients(input) {
  const year = String(input.year);
  const shows = Array.isArray(input.shows) ? input.shows : [];
  const picksByDate = Array.isArray(input.picksByDate) ? input.picksByDate : [];
  const leaders = aggregateTourStandings(picksByDate);
  if (leaders.length === 0) {
    return { recipients: [], crowdSummary: "", skipped: "no_eligible_players" };
  }
  const ranked = assignDisplayRanks(leaders);
  const usersByUid = input.usersByUid && typeof input.usersByUid === "object" ? input.usersByUid : {};
  const priorYearByUid = input.priorYearByUid && typeof input.priorYearByUid === "object" ? input.priorYearByUid : {};
  const enriched = leaders.map((row) => ({
    ...row,
    userData: usersByUid[row.uid] || {},
  }));
  const podium = withAnnualPlaceLabels(buildTourRecapPodium(enriched));
  const emailBoard = buildTourRecapEmailBoard(enriched);
  const showCount = shows.length;
  const shared = deriveSharedWrapFacts({
    setlists: input.setlists,
    picksByDate,
    showCount,
    shows,
    songFacts: input.songFacts || null,
  });
  const pulse = buildYearCrowdPulse(picksByDate, input.setlists || []);
  /** @type {Array<{ uid: string, userData: Record<string, unknown>, payload: object, vars: object }>} */
  const recipients = [];
  for (const row of enriched) {
    const info = ranked.get(row.uid);
    if (!info) continue;
    const userData = row.userData || {};
    const handleFromUser = typeof userData.handle === "string" ? userData.handle.trim() : "";
    recipients.push({
      uid: row.uid,
      userData,
      payload: buildAnnualWrapPayload({
        handle: row.handle || handleFromUser || "Picker",
        rank: info.rank,
        tiedCount: info.tiedCount,
        tiedHandles: info.tiedHandles,
        points: row.totalPoints,
        wins: row.wins,
        showsPlayed: row.shows,
        participantCount: leaders.length,
        year,
        showCount,
        podium,
        emailBoard,
        shared,
        player: derivePlayerWrapFacts({
          uid: row.uid,
          picksByDate,
          setlists: input.setlists,
          shared,
          points: row.totalPoints,
          wins: row.wins,
          showsPlayed: row.shows,
          showCount,
        }),
        pulse,
        priorYear: priorYearByUid[row.uid] || null,
      }),
      vars: { uid: row.uid, year },
    });
  }
  const crowdSummary = recipients[0]?.payload?.crowd_summary || "";
  return { recipients, crowdSummary, skipped: null };
}

module.exports = {
  GAME_LAUNCH_SHOW_DATE,
  MIN_HIT_RATE_CARDS,
  MIN_MOST_PICKED_CARDS,
  ANNUAL_WRAP_GRADE_CHANNELS,
  ANNUAL_WRAP_MORNING_CHANNELS,
  ANNUAL_WRAP_LOOKBACK_DAYS,
  showsInCalendarYear,
  calendarYearsOnCalendar,
  isLastShowOfYear,
  shouldAttemptPendingAnnualWrap,
  yearFinaleReady,
  buildYearCrowdPulse,
  composeCrowdPulse,
  composeYearRaceFact,
  yearPersonalMark,
  withAnnualPlaceLabels,
  buildAnnualWrapPayload,
  assembleAnnualWrapRecipients,
};

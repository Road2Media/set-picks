/**
 * Pure helpers for the durable `tour_recap` trigger (#510, #1084, #1136).
 *
 * Night `show_recap` stays on `showRecapNarrativeCore.js`. The morning
 * standings paragraph stays on `tourRankingsDailyCore.js`. This module is
 * the end-of-tour wrap: a short multi-fact opening, a factual rank paragraph,
 * and at most two personal beats. Place labels follow official tour rank.
 * A points tie is one place that names everyone.
 */

"use strict";

const { buildTourRecapFactLabel } = require("./commsFactLabel");
const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const { aggregateTourStandings, assignDisplayRanks } = require("./tourRankingsDailyCore");
const { formatFanShowDate } = require("./fanShowDate.cjs");

/** Ranks 1 through 5 are the published board. A tie at any of those ranks names everyone. */
const PUBLISHED_RANK_MAX = 5;

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
 * @param {number} n
 * @returns {string}
 */
function ordinalPlace(n) {
  const place = Math.trunc(Number(n));
  if (!Number.isFinite(place) || place <= 0) return "";
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  const mod10 = place % 10;
  if (mod10 === 1) return `${place}st`;
  if (mod10 === 2) return `${place}nd`;
  if (mod10 === 3) return `${place}rd`;
  return `${place}th`;
}

/**
 * @param {number} rank
 * @param {boolean} tied
 * @returns {string}
 */
function placeLabel(rank, tied) {
  if (rank === 1) return tied ? "Tied for first" : "Tour Winner";
  if (rank === 2) return tied ? "Tied for second" : "Runner-up";
  if (rank === 3) return tied ? "Tied for third" : "Third Place";
  const word = ordinalPlace(rank);
  return tied ? `Tied for ${word}` : word;
}

/**
 * Published places are competition ranks 1 through 5. Each rank is one place.
 * A tie names everyone at that rank. List order inside the tie stays wins, then handle.
 *
 * `rows` and `honorableMentions` stay for already-sent messages and older clients.
 * `places` is what the in-app board reads.
 *
 * @param {Array<{ uid?: string, handle?: string, totalPoints?: number, wins?: number, shows?: number }>} leaders
 * @returns {{
 *   places: Array<{ rank: number, label: string, tied: boolean, points: number, members: Array<{ handle: string, points: number, wins: number, shows: number }> }>,
 *   rows: Array<{ handle: string, points: number, wins: number, rank: number, label: string, tied: boolean }>,
 *   honorableMentions: Array<{ handle: string, note: string, rank: number, label: string }>,
 * }}
 */
function buildTourRecapPodium(leaders) {
  const source = Array.isArray(leaders) ? leaders : [];
  const list = source.map((row, i) => ({
    uid: typeof row?.uid === "string" && row.uid.trim() ? row.uid.trim() : `podium-${i}`,
    handle: row?.handle || "Anonymous",
    totalPoints: typeof row?.totalPoints === "number" ? row.totalPoints : 0,
    wins: typeof row?.wins === "number" ? row.wins : 0,
    shows: typeof row?.shows === "number" ? row.shows : 0,
  }));
  const ranked = assignDisplayRanks(list);
  /** @type {Map<number, typeof list>} */
  const groups = new Map();
  for (const row of list) {
    const rank = ranked.get(row.uid)?.rank;
    if (!rank || rank > PUBLISHED_RANK_MAX) continue;
    const group = groups.get(rank) || [];
    group.push(row);
    groups.set(rank, group);
  }

  const places = [...groups.keys()].sort((a, b) => a - b).map((rank) => {
    const members = (groups.get(rank) || []).map((row) => ({
      handle: row.handle || "Anonymous",
      points: row.totalPoints,
      wins: row.wins,
      shows: row.shows,
    }));
    const tied = members.length > 1;
    return {
      rank,
      label: placeLabel(rank, tied),
      tied,
      points: members[0]?.points ?? 0,
      members,
    };
  });

  const rows = places
    .filter((place) => place.rank <= 3)
    .map((place) => ({
      handle: place.tied ? joinedHandles(place.members) : place.members[0].handle,
      points: place.points,
      wins: place.members[0]?.wins ?? 0,
      rank: place.rank,
      label: place.label,
      tied: place.tied,
    }));

  const honorableMentions = places
    .filter((place) => place.rank > 3)
    .map((place) => {
      if (place.tied) {
        return {
          handle: joinedHandles(place.members),
          note: `tied for ${ordinalPlace(place.rank)} at ${place.points} pts.`,
          rank: place.rank,
          label: place.label,
        };
      }
      const member = place.members[0];
      return {
        ...honorableMention({
          handle: member.handle,
          totalPoints: member.points,
          wins: member.wins,
          shows: member.shows,
        }),
        rank: place.rank,
        label: place.label,
      };
    });

  return { places, rows, honorableMentions };
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
 * Email grid for ranks 1 through 5. A points tie keeps the shared rank and
 * names everyone at that rank, even when that is more than five people.
 * Avg is blank when the count is missing.
 *
 * @param {Array<{ handle?: string, totalPoints?: number, wins?: number, shows?: number, correctSlots?: number }>} leaders
 * @returns {Array<{ rank: number, handle: string, points: number, wins: number, nights: number, avg: string }>}
 */
function buildTourRecapEmailBoard(leaders) {
  const list = Array.isArray(leaders) ? leaders : [];
  let rank = 0;
  let prevPoints = null;
  /** @type {Array<{ rank: number, handle: string, points: number, wins: number, nights: number, avg: string }>} */
  const board = [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const points = typeof row.totalPoints === "number" ? row.totalPoints : 0;
    if (prevPoints === null || points < prevPoints) rank = i + 1;
    prevPoints = points;
    if (rank > PUBLISHED_RANK_MAX) break;
    const nights = typeof row.shows === "number" ? row.shows : 0;
    const correct = Number(row.correctSlots);
    board.push({
      rank,
      handle: row.handle || "Anonymous",
      points,
      wins: typeof row.wins === "number" ? row.wins : 0,
      nights,
      avg: formatPickingAvg(correct, nights),
    });
  }
  return board;
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
 * Dated shows for one tour, oldest first. City is included when the venue
 * string does not already say it.
 *
 * @param {unknown} showDatesByTour
 * @param {string | null | undefined} tourKey
 * @returns {Array<{ date: string, venue: string, city: string }>}
 */
function showsForTour(showDatesByTour, tourKey) {
  if (!tourKey || !Array.isArray(showDatesByTour)) return [];
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object" || group.tour !== tourKey) continue;
    const shows = Array.isArray(group.shows) ? group.shows : [];
    return shows
      .filter((show) => show && typeof show.date === "string" && show.date.trim())
      .map((show) => ({
        date: show.date.trim(),
        venue: typeof show.venue === "string" ? show.venue.trim() : "",
        city: typeof show.city === "string" ? show.city.trim() : "",
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return [];
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
 * Fan-facing short date. Storage stays YYYY-MM-DD. Same shape as morning copy.
 * @param {unknown} value
 * @returns {string}
 */
function speakDate(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const spoken = formatFanShowDate(value.trim());
  return typeof spoken === "string" ? spoken : "";
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
        leaders: [...after].filter(Boolean),
      });
    }
    prev = key;
  }
  return changes;
}

/**
 * @param {Array<{ date?: string, picks?: unknown[] }>} picksByDate
 * @returns {Map<string, string>}
 */
function handleByUidFromPicks(picksByDate) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const entry of Array.isArray(picksByDate) ? picksByDate : []) {
    for (const row of Array.isArray(entry?.picks) ? entry.picks : []) {
      if (!row || typeof row !== "object") continue;
      const uid = String(row.userId || row.uid || "").trim();
      const handle = typeof row.handle === "string" ? row.handle.trim() : "";
      if (uid && handle) map.set(uid, handle);
    }
  }
  return map;
}

/**
 * @param {unknown} songFacts
 * @returns {Record<string, { lastPlayed: string, debutYear: number | null }>}
 */
function catalogByTitle(songFacts) {
  /** @type {Record<string, { lastPlayed: string, debutYear: number | null }>} */
  const out = {};
  const rows = songFacts && typeof songFacts === "object" && Array.isArray(songFacts.bustouts)
    ? songFacts.bustouts
    : [];
  for (const row of rows) {
    const key = titleKey(row?.title);
    if (!key) continue;
    const lastPlayed = typeof row.lastPlayed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.lastPlayed)
      ? row.lastPlayed
      : "";
    const debut = Number(row.debutYear);
    const debutYear = Number.isFinite(debut) && debut >= 1983 && debut <= 2100 ? Math.trunc(debut) : null;
    const prev = out[key];
    if (!prev) {
      out[key] = { lastPlayed, debutYear };
      continue;
    }
    if (lastPlayed && !prev.lastPlayed) prev.lastPlayed = lastPlayed;
    if (debutYear && prev.debutYear == null) prev.debutYear = debutYear;
  }
  return out;
}

/**
 * @param {Array<{ date?: string, venue?: string, city?: string }>} shows
 * @param {Array<{ date?: string }>} setlists
 * @param {Array<{ date?: string }>} picksByDate
 * @returns {string}
 */
function earliestShowDate(shows, setlists, picksByDate) {
  const fromShows = (Array.isArray(shows) ? shows : [])
    .map((show) => (typeof show?.date === "string" ? show.date.trim() : ""))
    .filter(Boolean);
  if (fromShows.length) return fromShows.slice().sort()[0];
  const rest = []
    .concat(Array.isArray(setlists) ? setlists : [])
    .concat(Array.isArray(picksByDate) ? picksByDate : [])
    .map((row) => (typeof row?.date === "string" ? row.date.trim() : ""))
    .filter(Boolean);
  rest.sort();
  return rest[0] || "";
}

/**
 * The last lead change is a takeover when everyone still leading took it that night.
 *
 * @param {Array<{ date: string, took: string[], lost: string[], leaders?: string[] }>} leadChanges
 * @param {Map<string, string>} handleByUid
 * @param {string} closingVenue
 * @returns {{ date: string, handles: string[], venue: string } | null}
 */
function finalLeadTakeover(leadChanges, handleByUid, closingVenue) {
  const last = leadChanges[leadChanges.length - 1];
  const leaders = Array.isArray(last?.leaders) ? last.leaders : [];
  const took = new Set(Array.isArray(last?.took) ? last.took : []);
  const lost = Array.isArray(last?.lost) ? last.lost : [];
  if (!last || !leaders.length || !lost.length || !leaders.every((uid) => took.has(uid))) return null;
  const handles = leaders
    .map((uid) => handleByUid.get(uid) || "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (!handles.length) return null;
  return { date: last.date, handles, venue: closingVenue || "" };
}

/**
 * @param {{
 *   setlists?: Array<{ date?: string, doc?: Record<string, unknown> | null }>,
 *   picksByDate?: Array<{ date?: string, picks?: unknown[] }>,
 *   showCount?: number,
 *   closingVenue?: string,
 *   shows?: Array<{ date?: string, venue?: string, city?: string }>,
 *   songFacts?: { uniqueSongs?: number, bustouts?: unknown[] } | null,
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
  const shows = Array.isArray(input.shows) ? input.shows : [];
  /** @type {Record<string, string>} */
  const venueByDate = {};
  for (const show of shows) {
    if (!show || typeof show.date !== "string" || !show.date.trim()) continue;
    const place = spokenVenue(show.venue || "", show.city || "");
    if (place) venueByDate[show.date.trim()] = place;
  }
  const orderedDates = Object.keys(venueByDate).sort();
  const lastVenue = orderedDates.length ? venueByDate[orderedDates[orderedDates.length - 1]] : "";
  const closingVenue = lastVenue || (typeof input.closingVenue === "string" ? input.closingVenue.trim() : "");
  const firstDate = earliestShowDate(shows, input.setlists || [], input.picksByDate || []);
  const catalog = catalogByTitle(input.songFacts);
  if (rarest) {
    const fact = catalog[titleKey(rarest.title)] || {};
    rarest = {
      title: rarest.title,
      gap: rarest.gap,
      date: rarest.date,
      venue: venueByDate[rarest.date] || "",
      openingNight: Boolean(firstDate) && rarest.date === firstDate,
      lastPlayed: fact.lastPlayed || "",
      debutYear: fact.debutYear || null,
    };
  }
  const dated = (Array.isArray(input.picksByDate) ? input.picksByDate : []).filter(
    (row) => row && typeof row.date === "string" && row.date.trim(),
  );
  const leadChanges = deriveLeadChanges(dated);
  const unique = Number(input.songFacts?.uniqueSongs);
  return {
    rarestHit: rarest,
    leadChangeCount: dated.length >= 2 ? leadChanges.length : null,
    leadChanges,
    finalLead: finalLeadTakeover(leadChanges, handleByUidFromPicks(dated), closingVenue),
    closingVenue,
    venueByDate,
    catalogByTitle: catalog,
    showCount: Number(input.showCount) || 0,
    uniqueSongs: Number.isFinite(unique) && unique > 0 ? Math.trunc(unique) : 0,
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
 * @param {string[]} names
 * @returns {string}
 */
function joinNames(names) {
  return joinedHandles((names || []).filter(Boolean).map((name) => ({ handle: name })));
}

/**
 * @param {number} showCount
 * @param {number} participantCount
 * @param {number} uniqueSongs
 * @returns {string}
 */
function scaleSentence(showCount, participantCount, uniqueSongs) {
  /** @type {string[]} */
  const bits = [];
  if (showCount > 0) bits.push(`${showCount} ${showCount === 1 ? "show" : "shows"}`);
  if (participantCount > 0) bits.push(`${participantCount} ${participantCount === 1 ? "player" : "players"}`);
  if (uniqueSongs > 0) bits.push(`${uniqueSongs} different ${uniqueSongs === 1 ? "song" : "songs"}`);
  if (bits.length === 0) return "";
  if (bits.length === 1) return `${bits[0][0].toUpperCase()}${bits[0].slice(1)}.`;
  if (bits.length === 2) return `${bits[0][0].toUpperCase()}${bits[0].slice(1)} and ${bits[1]}.`;
  return `${bits[0][0].toUpperCase()}${bits[0].slice(1)}, ${bits[1]}, and ${bits[2]}.`;
}

/**
 * @param {{ title: string, gap: number, date?: string, venue?: string, openingNight?: boolean, lastPlayed?: string, debutYear?: number | null }} hit
 * @returns {string}
 */
function rarestHitSentence(hit) {
  const spoken = speakDate(hit.date);
  /** @type {string[]} */
  const where = [];
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
  return `The rarest hit of the run was ${hit.title}, ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap${whereBit}${extraBit}.`;
}

/**
 * Gap, lead changes, and the close can all be present. A missing fact drops its clause.
 * When none of those exist, the middle sentence stays the older fallback.
 *
 * @param {number} showCount
 * @param {number} participantCount
 * @param {ReturnType<typeof deriveSharedWrapFacts> | null | undefined} shared
 * @returns {{ text: string, slots: string[] }}
 */
function composeSharedOpening(showCount, participantCount, shared) {
  /** @type {string[]} */
  const sentences = [];
  /** @type {string[]} */
  const slots = [];
  const hasRarest = Boolean(shared?.rarestHit);
  const hasLead = shared?.leadChangeCount != null;
  const hasClose = Boolean(shared?.closingVenue) && showCount > 0;
  if (!hasRarest && !hasLead && !hasClose) {
    return {
      text: `Calling setlists is an inexact science on a good day, and a ${showCount}-show run kept everyone honest. Despite the curveballs, ${participantCount} of you stepped up to lay down your picks.`,
      slots: ["opening_fallback"],
    };
  }

  const scale = scaleSentence(showCount, participantCount, Number(shared?.uniqueSongs) || 0);
  if (scale) {
    sentences.push(scale);
    slots.push("tour_scale");
  }
  if (hasRarest && shared?.rarestHit) {
    sentences.push(rarestHitSentence(shared.rarestHit));
    slots.push("rarest_hit");
  }
  let spokeClose = false;
  if (hasLead) {
    const n = shared.leadChangeCount;
    const count =
      n === 0
        ? "The tour lead never changed hands."
        : n === 1
          ? "The tour lead changed hands once."
          : `The tour lead changed hands ${n} times.`;
    const takeover = n > 0 ? shared.finalLead : null;
    if (takeover && takeover.handles?.length) {
      const when = speakDate(takeover.date);
      const where = takeover.venue ? ` at ${takeover.venue}` : "";
      const took = when
        ? `${joinNames(takeover.handles)} took it on ${when} and held it through the close${where}.`
        : `${joinNames(takeover.handles)} took it and held it through the close${where}.`;
      sentences.push(`${count} ${took}`);
      spokeClose = Boolean(takeover.venue);
    } else {
      sentences.push(count);
    }
    slots.push("lead_changes");
  }
  if (hasClose && !spokeClose && shared?.closingVenue) {
    const noun = showCount === 1 ? "show" : "shows";
    sentences.push(`${shared.closingVenue} closed the run after ${showCount} ${noun}.`);
  }
  if (spokeClose || hasClose) slots.push("closing_stand");
  return { text: sentences.join(" "), slots };
}

/**
 * @param {ReturnType<typeof deriveSharedWrapFacts> | null | undefined} shared
 * @param {{ title?: string, date?: string }} hit
 * @param {boolean} sameAsShared
 * @returns {string}
 */
function catalogTail(shared, hit, sameAsShared) {
  if (sameAsShared) return "";
  const fact = shared?.catalogByTitle?.[titleKey(hit.title)];
  if (!fact) return "";
  /** @type {string[]} */
  const bits = [];
  const lastPlayed = speakDate(fact.lastPlayed);
  if (lastPlayed) bits.push(`last played ${lastPlayed}`);
  if (fact.debutYear) bits.push(`debut ${fact.debutYear}`);
  return bits.length ? `, ${bits.join(", ")}` : "";
}

/**
 * @param {{
 *   tourName?: string,
 *   tourId?: string,
 *   showCount?: number,
 *   participantCount?: number,
 *   rank?: number,
 *   tiedCount?: number,
 *   tiedHandles?: string[],
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
  const opening = composeSharedOpening(showCount, participantCount, shared);

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
  if (player?.bestNight) {
    const when = speakDate(player.bestNight.date) || player.bestNight.date;
    sentences.push(`Your best night was ${when} with ${player.bestNight.score} points.`);
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

  /** @type {Array<{ slot: string, text: string }>} */
  const beats = [];
  if (player?.rareHitPicked) {
    const hit = player.rareHitPicked;
    const when = speakDate(hit.date) || hit.date;
    const venue = shared?.venueByDate?.[hit.date] || "";
    const where = venue ? ` at ${venue}` : "";
    const sameAsShared = Boolean(shared?.rarestHit) && titleKey(shared.rarestHit.title) === titleKey(hit.title);
    beats.push({
      slot: "rare_hit_picked",
      text: `You caught ${hit.title} — ${indefiniteArticleForGap(hit.gap)} ${hit.gap} show gap — on ${when}${where}${catalogTail(shared, hit, sameAsShared)}.`,
    });
  }
  if (player?.leadChange) {
    const when = speakDate(player.leadChange.date) || player.leadChange.date;
    beats.push({
      slot: "lead_change_involved",
      text:
        player.leadChange.kind === "took"
          ? `You took the lead on ${when}.`
          : `You lost the lead on ${when}.`,
    });
  }
  if (player?.personalMark === "points") {
    beats.push({ slot: "personal_mark", text: "This is your highest tour point total." });
  } else if (player?.personalMark === "wins") {
    beats.push({
      slot: "personal_mark",
      text: "This is the most nightly wins you've had on a tour.",
    });
  }
  const chosen = beats.slice(0, 2);
  for (const beat of chosen) {
    sentences.push(beat.text);
    slots.push(beat.slot);
  }
  slots.push(...opening.slots);

  return {
    opening_paras: [
      `${tourName} is officially in the books.`,
      opening.text,
      "Before the next run, here is the final tape.",
    ],
    personal_line: sentences.join(" "),
    personal_clause: chosen.map((beat) => beat.text).join(" "),
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
  showsForTour,
  deriveSharedWrapFacts,
  derivePlayerWrapFacts,
};

/**
 * Night-of show context for `show_recap` / `tour_rankings_daily` (#572).
 * Pure helpers — no Firestore I/O. Deterministic TTDMOM narrative (no LLM).
 */

"use strict";

const { formatFanShowDate } = require("./fanShowDate.cjs");

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimTitle(value) {
  return String(value ?? "").trim();
}

/**
 * @param {string} a
 * @param {string} b
 */
function titlesEqual(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Group official setlist into sets (mirrors client `groupOfficialSetlistBySet`).
 * @param {Record<string, unknown> | null | undefined} setlistDoc
 * @returns {{ set1: string[], set2: string[], encore: string[], hasSongs: boolean }}
 */
function groupOfficialSetlistBySet(setlistDoc) {
  if (!setlistDoc || typeof setlistDoc !== "object") {
    return { set1: [], set2: [], encore: [], hasSongs: false };
  }

  const list = Array.isArray(setlistDoc.officialSetlist)
    ? setlistDoc.officialSetlist.map(trimTitle).filter(Boolean)
    : [];

  const encoreSongs = Array.isArray(setlistDoc.encoreSongs)
    ? setlistDoc.encoreSongs.map(trimTitle).filter(Boolean)
    : [];

  const s2o = trimTitle(setlistDoc.s2o ?? setlistDoc.setlist?.s2o);
  const enc = trimTitle(setlistDoc.enc ?? setlistDoc.setlist?.enc);

  let mainList = list;
  let encoreFromList = [];

  if (encoreSongs.length > 0) {
    const firstEncIdx = list.findIndex((t) => titlesEqual(t, encoreSongs[0]));
    if (firstEncIdx >= 0) {
      mainList = list.slice(0, firstEncIdx);
      encoreFromList = list.slice(firstEncIdx);
    }
  } else if (enc) {
    const encIdx = list.findIndex((t) => titlesEqual(t, enc));
    if (encIdx >= 0) {
      mainList = list.slice(0, encIdx);
      encoreFromList = list.slice(encIdx);
    }
  }

  const encore = encoreSongs.length > 0 ? encoreSongs : encoreFromList;

  let set1 = [];
  let set2 = [];
  if (s2o) {
    const s2Idx = mainList.findIndex((t) => titlesEqual(t, s2o));
    if (s2Idx >= 0) {
      set1 = mainList.slice(0, s2Idx);
      set2 = mainList.slice(s2Idx);
    } else {
      set1 = mainList;
    }
  } else {
    set1 = mainList;
  }

  const hasSongs = set1.length + set2.length + encore.length > 0;
  return { set1, set2, encore, hasSongs };
}

/**
 * @param {Record<string, unknown> | null | undefined} setlistDoc
 * @returns {string[]}
 */
function bustoutTitlesFromDoc(setlistDoc) {
  if (!Array.isArray(setlistDoc?.bustouts)) return [];
  return setlistDoc.bustouts.map(trimTitle).filter(Boolean);
}

/**
 * @param {Record<string, unknown> | null | undefined} setlistDoc
 * @returns {string[]}
 */
function tonightTitles(setlistDoc) {
  const { set1, set2, encore } = groupOfficialSetlistBySet(setlistDoc);
  const fromGroups = [...set1, ...set2, ...encore];
  if (fromGroups.length > 0) return fromGroups;
  if (Array.isArray(setlistDoc?.officialSetlist)) {
    return setlistDoc.officialSetlist.map(trimTitle).filter(Boolean);
  }
  return [];
}

/**
 * Titles played on prior tour dates (union).
 * @param {Array<Record<string, unknown> | null | undefined>} priorDocs
 * @returns {Set<string>}
 */
function priorTourTitleSet(priorDocs) {
  const set = new Set();
  for (const doc of priorDocs || []) {
    for (const t of tonightTitles(doc)) {
      set.add(t.toLowerCase());
    }
  }
  return set;
}

/**
 * Songs played tonight that were not played earlier this tour.
 * @param {Record<string, unknown> | null | undefined} setlistDoc
 * @param {Array<Record<string, unknown> | null | undefined>} priorDocs
 * @returns {string[]}
 */
function tourDebutTitles(setlistDoc, priorDocs) {
  const prior = priorTourTitleSet(priorDocs);
  if (prior.size === 0) {
    // First show of tour / no priors: treat all as "new to tour" but keep list short.
    return tonightTitles(setlistDoc).slice(0, 8);
  }
  const debuts = [];
  for (const t of tonightTitles(setlistDoc)) {
    if (!prior.has(t.toLowerCase())) debuts.push(t);
  }
  return debuts;
}

/**
 * Prior show dates to load when computing `tour_debut_titles`.
 * Must be the **full** prior itinerary — truncating to a trailing window
 * falsely labels early-tour songs as debuts when they return later
 * (Dick's 2026-09-04: "4 songs new to this tour — including Plasma."
 * after Plasma on 2026-07-10 fell outside a 12-show lookback).
 *
 * @param {string[]} priorDates ascending YYYY-MM-DD exclusive of tonight
 * @returns {string[]}
 */
function priorDatesForTourDebutLookup(priorDates) {
  if (!Array.isArray(priorDates)) return [];
  return priorDates.filter((d) => typeof d === "string" && d.trim());
}

/** Persisted `comms_show_context.schemaVersion` (bump when rebuild-on-read is required). */
const COMMS_SHOW_CONTEXT_SCHEMA_VERSION = 3;

/**
 * @param {{ set1: string[], set2: string[], encore: string[] }} groups
 * @param {string} opener
 * @param {string} encoreTitle
 * @returns {string}
 */
function composeSetFlowSummary(groups, opener, encoreTitle) {
  const parts = [];
  if (groups.set1.length) {
    parts.push(
      opener
        ? `Set 1 opened with ${opener} (${groups.set1.length} songs)`
        : `Set 1 ran ${groups.set1.length} songs`,
    );
  }
  if (groups.set2.length) {
    parts.push(`Set 2 added ${groups.set2.length}`);
  }
  if (groups.encore.length) {
    parts.push(
      encoreTitle
        ? `encore closed on ${encoreTitle}`
        : `${groups.encore.length}-song encore`,
    );
  }
  if (parts.length === 0) return "";
  const joined = parts.join("; ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

/**
 * Bustout titles with gaps from Phish.net rows (gap ≥ BUSTOUT_MIN_GAP).
 * @param {{ title: string, gap?: number | null }[]} rows
 * @param {number} [minGap=30]
 * @returns {{ title: string, gap: number | null }[]}
 */
function bustoutEntriesFromRows(rows, minGap = 30) {
  const seen = new Set();
  /** @type {{ title: string, gap: number | null }[]} */
  const out = [];
  for (const row of rows || []) {
    if (!row || typeof row.title !== "string") continue;
    const title = row.title.trim();
    if (!title) continue;
    const gap =
      typeof row.gap === "number" && Number.isFinite(row.gap)
        ? Math.trunc(row.gap)
        : null;
    if (gap == null || gap < minGap) continue;
    const norm = title.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({ title, gap });
  }
  return out;
}

/**
 * "a" / "an" before a spoken gap number (eight*, eleven, eighteen → an).
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
 * @param {unknown} title
 * @param {Record<string, unknown> | null | undefined} songGaps
 * @returns {number | null}
 */
function gapForTitle(title, songGaps) {
  if (!songGaps || typeof songGaps !== "object") return null;
  const key = titleKey(title);
  const raw = songGaps[key] ?? songGaps[String(title ?? "").trim()];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/**
 * @param {unknown} title
 * @param {Record<string, unknown> | null | undefined} lastPlayed
 * @returns {string}
 */
function lastPlayedForTitle(title, lastPlayed) {
  if (!lastPlayed || typeof lastPlayed !== "object") return "";
  const raw = lastPlayed[titleKey(title)];
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

/**
 * Highest lifetime play count in this set. An earlier song wins a tie.
 * @param {string[]} songs
 * @param {Record<string, unknown> | null | undefined} lifetimePlays
 * @returns {string}
 */
function crowdFavoriteTitle(songs, lifetimePlays) {
  if (!lifetimePlays || typeof lifetimePlays !== "object") return "";
  let bestTitle = "";
  let best = -1;
  for (const title of songs) {
    const n = Number(lifetimePlays[titleKey(title)]);
    if (!Number.isFinite(n) || n <= 0 || n <= best) continue;
    best = n;
    bestTitle = title;
  }
  return bestTitle;
}

/**
 * Every song has a known gap, and none is above 10.
 * @param {string[]} songs
 * @param {Record<string, unknown> | null | undefined} songGaps
 * @returns {boolean}
 */
function allGapsAtMostTen(songs, songGaps) {
  if (!songs.length) return false;
  return songs.every((title) => {
    const gap = gapForTitle(title, songGaps);
    return gap != null && gap <= 10;
  });
}

/**
 * One song for a set. A bustout stays a bustout. A gap of 20–29 is a rarity,
 * 11–19 is a return, and a set whose gaps are all 10 or fewer is rotation.
 * A trusted tour debut is the next fact. Songs in `omitTitles` are skipped.
 *
 * @param {string[]} songs
 * @param {{
 *   songGaps?: Record<string, unknown>,
 *   bustoutTitles?: string[],
 *   tourDebutTitles?: string[],
 *   debutsTrusted?: boolean,
 *   omitTitles?: string[],
 *   lifetimePlays?: Record<string, unknown>,
 * }} opts
 * @returns {{ title: string, kind: "bustout" | "rarity" | "return" | "rotation" | "debut", gap: number | null } | null}
 */
function pickSetHighlight(songs, opts) {
  const omit = new Set((opts.omitTitles || []).map(titleKey));
  const list = (songs || []).filter((title) => title && !omit.has(titleKey(title)));
  if (!list.length) return null;
  const bustoutKeys = new Set((opts.bustoutTitles || []).map(titleKey));
  const ranked = list.map((title) => ({
    title,
    gap: gapForTitle(title, opts.songGaps),
    bustout: bustoutKeys.has(titleKey(title)),
  }));
  const bustouts = ranked.filter(
    (row) => row.bustout || (row.gap != null && row.gap >= 30),
  );
  bustouts.sort((a, b) => (b.gap || 0) - (a.gap || 0));
  if (bustouts.length) {
    return { title: bustouts[0].title, kind: "bustout", gap: bustouts[0].gap };
  }
  const withGap = ranked.filter((row) => row.gap != null).slice().sort((a, b) => b.gap - a.gap);
  const longest = withGap[0];
  if (longest && longest.gap >= 20 && longest.gap < 30) {
    return { title: longest.title, kind: "rarity", gap: longest.gap };
  }
  if (longest && longest.gap >= 11 && longest.gap < 20) {
    return { title: longest.title, kind: "return", gap: longest.gap };
  }
  if (allGapsAtMostTen(list, opts.songGaps)) {
    return {
      title: crowdFavoriteTitle(list, opts.lifetimePlays),
      kind: "rotation",
      gap: null,
    };
  }
  if (opts.debutsTrusted) {
    const debuts = new Set((opts.tourDebutTitles || []).map(titleKey));
    const debut = list.find((title) => debuts.has(titleKey(title)));
    if (debut) return { title: debut, kind: "debut", gap: null };
  }
  return null;
}

/**
 * Lifetime play counts for the titles in one night. Catalog `total` is a string.
 * @param {Array<{ name?: string, total?: unknown }>} songs
 * @param {string[]} titles
 * @returns {Record<string, number>}
 */
function lifetimePlaysForTitles(songs, titles) {
  const wanted = new Set((titles || []).map(titleKey).filter(Boolean));
  /** @type {Record<string, number>} */
  const map = {};
  if (!wanted.size) return map;
  for (const song of songs || []) {
    const key = titleKey(song?.name);
    if (!wanted.has(key) || map[key] != null) continue;
    const n = Number(song?.total);
    if (!Number.isFinite(n) || n <= 0) continue;
    map[key] = Math.trunc(n);
  }
  return map;
}

/**
 * @param {{ title: string, kind: "bustout" | "rarity" | "return" | "rotation" | "debut", gap: number | null }} hit
 * @param {Record<string, unknown> | null | undefined} lastPlayed
 * @returns {string}
 */
function highlightClause(hit, lastPlayed) {
  if (hit.kind === "debut") {
    return `, highlighted by ${hit.title}, new to this tour`;
  }
  if (hit.kind === "rotation") {
    return hit.title
      ? ` featured heavy rotation songs, with crowd favorite ${hit.title}`
      : " featured heavy rotation songs";
  }
  if (hit.kind === "bustout" && hit.gap == null) return `, highlighted by ${hit.title}`;
  const article = indefiniteArticleForGap(hit.gap);
  const storedDate = hit.gap != null && hit.gap >= 10 ? lastPlayedForTitle(hit.title, lastPlayed) : "";
  const formattedDate = storedDate ? formatFanShowDate(storedDate) : "";
  const date = typeof formattedDate === "string" ? formattedDate : "";
  const dateBit = date ? `, last played on ${date}` : "";
  if (hit.kind === "rarity") {
    return ` featured a relative rarity of late: ${hit.title}, ${article} ${hit.gap} show gap${dateBit}`;
  }
  if (hit.kind === "return") {
    return ` saw the return of ${hit.title} after ${article} ${hit.gap} show gap${dateBit}`;
  }
  return `, highlighted by ${hit.title}, ${article} ${hit.gap} show gap${dateBit}`;
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
 * One sentence per set from the night map. A bustout title that is not in
 * `groups` cannot be chosen. `omitTitles` drops a song the player line already claimed.
 *
 * @param {{
 *   groups: { set1?: string[], set2?: string[], encore?: string[] },
 *   songGaps?: Record<string, unknown>,
 *   bustoutTitles?: string[],
 *   tourDebutTitles?: string[],
 *   debutsTrusted?: boolean,
 *   lastPlayed?: Record<string, unknown>,
 *   omitTitles?: string[],
 *   opener?: string,
 *   venue?: string,
 * }} input
 * @returns {{ text: string, slots: string[] }}
 */
function composeNightSetFlow(input) {
  const groups = input.groups || {};
  const set1 = Array.isArray(groups.set1) ? groups.set1.filter(Boolean) : [];
  const set2 = Array.isArray(groups.set2) ? groups.set2.filter(Boolean) : [];
  const encore = Array.isArray(groups.encore) ? groups.encore.filter(Boolean) : [];
  /** @type {string[]} */
  const parts = [];
  /** @type {string[]} */
  const slots = [];
  const shared = {
    songGaps: input.songGaps,
    bustoutTitles: input.bustoutTitles,
    tourDebutTitles: input.tourDebutTitles,
    debutsTrusted: input.debutsTrusted === true,
    omitTitles: input.omitTitles,
    lifetimePlays: input.lifetimePlays,
  };

  /**
   * @param {string[]} songs
   * @param {string} label
   * @param {string} lengthId
   * @param {string | null} highlightId
   * @param {string} openerFallback
   */
  function pushSet(songs, label, lengthId, highlightId, openerFallback) {
    if (!songs.length) return;
    const article = indefiniteArticleForGap(songs.length) === "an" ? "An" : "A";
    const hit = pickSetHighlight(songs, shared);
    let extra = "";
    if (hit && highlightId) {
      extra = highlightClause(hit, input.lastPlayed);
      slots.push(highlightId);
    } else if (openerFallback) {
      extra = `, opened with ${openerFallback}`;
    } else if (input.venue && !slots.includes("venue_fallback")) {
      extra = ` at ${input.venue}`;
      slots.push("venue_fallback");
    }
    parts.push(`${article} ${songs.length}-song ${label}${extra}.`);
    slots.push(lengthId);
  }

  pushSet(set1, "first set", "set1_length", "set1_highlight", trimTitle(input.opener));
  pushSet(set2, "second set", "set2_length", "set2_highlight", "");
  if (encore.length) {
    const article = indefiniteArticleForGap(encore.length) === "an" ? "An" : "A";
    parts.push(
      `${article} ${encore.length}-song encore featured ${joinTitles(encore)}.`,
    );
    slots.push("encore_length", "encore_titles");
  }
  return { text: parts.join(" "), slots };
}

/**
 * @param {{ title: string, gap?: number | null }[]} entries
 * @returns {string}
 */
function formatBustoutSongGap(entries) {
  const list = (entries || []).filter((e) => e && e.title);
  if (!list.length) return "";
  return list
    .map((e) =>
      e.gap != null && Number.isFinite(e.gap)
        ? `${e.title} - ${indefiniteArticleForGap(e.gap)} ${e.gap} show gap`
        : e.title,
    )
    .join("; ");
}

/**
 * One-liner highlight for push / Tonight block.
 * @param {{
 *   bustoutTitles: string[],
 *   bustoutEntries?: { title: string, gap?: number | null }[],
 *   tourDebuts: string[],
 *   openerTitle: string,
 *   encoreTitle: string,
 * }} input
 * @returns {string}
 */
function composeSetlistHighlight({
  bustoutTitles,
  bustoutEntries,
  tourDebuts,
  openerTitle,
  encoreTitle,
}) {
  const entries =
    Array.isArray(bustoutEntries) && bustoutEntries.length
      ? bustoutEntries
      : (bustoutTitles || []).map((title) => ({ title, gap: null }));
  const bustoutLine = formatBustoutSongGap(entries);
  if (bustoutLine) {
    // Single: "Bustout: Song - a N show gap." Multi: "Bustouts: A - …; B - …." (#780)
    const label = entries.length === 1 ? "Bustout" : "Bustouts";
    return `${label}: ${bustoutLine}.`;
  }
  if (tourDebuts.length >= 3) {
    return `${tourDebuts.length} songs new to this tour — including ${tourDebuts[0]}.`;
  }
  if (tourDebuts.length === 1 || tourDebuts.length === 2) {
    return `Tour debut${tourDebuts.length > 1 ? "s" : ""}: ${tourDebuts.join(", ")}.`;
  }
  if (openerTitle && encoreTitle) {
    return `${openerTitle} opened; ${encoreTitle} closed the night.`;
  }
  if (openerTitle) return `${openerTitle} opened the night.`;
  if (encoreTitle) return `Encore: ${encoreTitle}.`;
  return "";
}

/**
 * @param {{ bustoutTitles: string[], tourDebuts: string[], groups: { set2: string[], encore: string[] } }} input
 * @returns {string[]}
 */
function deriveShowMomentTags({ bustoutTitles, tourDebuts, groups }) {
  /** @type {string[]} */
  const tags = [];
  if (bustoutTitles.length) tags.push("bustout");
  if (tourDebuts.length) tags.push("tour_debut");
  if (groups.encore.length >= 2) tags.push("multi_encore");
  if (groups.set2.length === 0 && groups.encore.length > 0) tags.push("short_main");
  return tags;
}

/**
 * Build the persisted / payload-ready show context artifact.
 * @param {{
 *   showDate: string,
 *   setlistDoc: Record<string, unknown> | null | undefined,
 *   priorTourSetlistDocs?: Array<Record<string, unknown> | null | undefined>,
 *   tourKey?: string | null,
 * }} input
 */
function buildCommsShowContext({
  showDate,
  setlistDoc,
  priorTourSetlistDocs = [],
  tourKey = null,
  /** @type {{ title: string, gap?: number | null }[] | null} */
  bustoutEntries = null,
  /** @type {{ title: string, gap?: number | null }[] | null} */
  phishnetRows = null,
  /** @type {Record<string, string> | null} */
  lastPlayedByTitle = null,
  /** @type {Record<string, number> | null} */
  lifetimePlaysByTitle = null,
}) {
  const slotMap =
    setlistDoc?.setlist && typeof setlistDoc.setlist === "object"
      ? setlistDoc.setlist
      : {};
  const normalizedDoc = {
    ...(setlistDoc || {}),
    s1o: trimTitle(setlistDoc?.s1o) || trimTitle(slotMap.s1o),
    s2o: trimTitle(setlistDoc?.s2o) || trimTitle(slotMap.s2o),
    enc: trimTitle(setlistDoc?.enc) || trimTitle(slotMap.enc),
  };

  const groups = groupOfficialSetlistBySet(normalizedDoc);

  const openerTitle =
    trimTitle(normalizedDoc.s1o) || (groups.set1[0] ? groups.set1[0] : "");
  const encoreTitle =
    trimTitle(normalizedDoc.enc) ||
    (groups.encore[0] ? groups.encore[0] : "");

  const playedKeys = new Set(
    [...groups.set1, ...groups.set2, ...groups.encore].map(titleKey),
  );
  const bustoutTitles = bustoutTitlesFromDoc(normalizedDoc).filter((title) =>
    playedKeys.has(titleKey(title)),
  );
  /** @type {{ title: string, gap: number | null }[]} */
  let entries = Array.isArray(bustoutEntries) ? bustoutEntries.filter((e) => e?.title) : [];
  if (!entries.length && Array.isArray(phishnetRows)) {
    entries = bustoutEntriesFromRows(phishnetRows);
  }
  if (!entries.length && bustoutTitles.length) {
    entries = bustoutTitles.map((title) => ({ title, gap: null }));
  }
  entries = entries.filter((entry) => playedKeys.has(titleKey(entry.title)));
  const titlesFromEntries = entries.map((e) => e.title);
  const resolvedBustoutTitles = titlesFromEntries.length
    ? titlesFromEntries
    : bustoutTitles;

  const tourDebuts = tourDebutTitles(normalizedDoc, priorTourSetlistDocs);
  const priorHasSongs = (priorTourSetlistDocs || []).some(
    (doc) => tonightTitles(doc).length > 0,
  );
  const songGaps = {
    ...(normalizedDoc.songGaps && typeof normalizedDoc.songGaps === "object"
      ? normalizedDoc.songGaps
      : {}),
  };
  for (const entry of entries) {
    const key = titleKey(entry.title);
    if (songGaps[key] == null && entry.gap != null) songGaps[key] = entry.gap;
  }
  const lastPlayed =
    lastPlayedByTitle && typeof lastPlayedByTitle === "object" ? lastPlayedByTitle : {};
  const nightFlow = composeNightSetFlow({
    groups,
    songGaps,
    bustoutTitles: resolvedBustoutTitles,
    tourDebutTitles: tourDebuts,
    debutsTrusted: priorHasSongs,
    lastPlayed,
    lifetimePlays: lifetimePlaysByTitle,
    opener: openerTitle,
  });
  const set_flow_summary = nightFlow.text || composeSetFlowSummary(groups, openerTitle, encoreTitle);
  const setlist_highlight = composeSetlistHighlight({
    bustoutTitles: resolvedBustoutTitles,
    bustoutEntries: entries,
    tourDebuts,
    openerTitle,
    encoreTitle,
  });
  const show_moment_tags = deriveShowMomentTags({
    bustoutTitles: resolvedBustoutTitles,
    tourDebuts,
    groups,
  });

  return {
    showDate,
    tourKey: tourKey || null,
    opener_title: openerTitle || null,
    encore_title: encoreTitle || null,
    bustout_titles: resolvedBustoutTitles,
    bustout_entries: entries,
    tour_debut_titles: tourDebuts,
    tour_debuts_trusted: priorHasSongs,
    set_songs: {
      set1: groups.set1,
      set2: groups.set2,
      encore: groups.encore,
    },
    song_gaps: songGaps,
    last_played: lastPlayed,
    lifetime_plays:
      lifetimePlaysByTitle && typeof lifetimePlaysByTitle === "object" ? lifetimePlaysByTitle : {},
    set_flow_summary: set_flow_summary || null,
    setlist_highlight: setlist_highlight || null,
    show_moment_tags,
    set_counts: {
      set1: groups.set1.length,
      set2: groups.set2.length,
      encore: groups.encore.length,
    },
    schemaVersion: COMMS_SHOW_CONTEXT_SCHEMA_VERSION,
  };
}

/**
 * Fields merged into comms payloads (show-level).
 * @param {Record<string, unknown> | null | undefined} context
 */
function showLevelPayloadFields(context) {
  if (!context || typeof context !== "object") return {};
  return {
    setlist_highlight: context.setlist_highlight || null,
    set_flow_summary: context.set_flow_summary || null,
    bustout_titles: Array.isArray(context.bustout_titles)
      ? context.bustout_titles
      : [],
    bustout_entries: Array.isArray(context.bustout_entries)
      ? context.bustout_entries
      : [],
    tour_debut_titles: Array.isArray(context.tour_debut_titles)
      ? context.tour_debut_titles
      : [],
    tour_debuts_trusted: context.tour_debuts_trusted === true,
    set_songs:
      context.set_songs && typeof context.set_songs === "object"
        ? context.set_songs
        : null,
    song_gaps:
      context.song_gaps && typeof context.song_gaps === "object"
        ? context.song_gaps
        : {},
    last_played:
      context.last_played && typeof context.last_played === "object"
        ? context.last_played
        : {},
    lifetime_plays:
      context.lifetime_plays && typeof context.lifetime_plays === "object"
        ? context.lifetime_plays
        : {},
    opener_title: context.opener_title || null,
    encore_title: context.encore_title || null,
    show_moment_tags: Array.isArray(context.show_moment_tags)
      ? context.show_moment_tags
      : [],
  };
}

module.exports = {
  COMMS_SHOW_CONTEXT_SCHEMA_VERSION,
  groupOfficialSetlistBySet,
  bustoutTitlesFromDoc,
  bustoutEntriesFromRows,
  formatBustoutSongGap,
  tonightTitles,
  priorTourTitleSet,
  tourDebutTitles,
  priorDatesForTourDebutLookup,
  composeSetFlowSummary,
  composeNightSetFlow,
  lifetimePlaysForTitles,
  composeSetlistHighlight,
  deriveShowMomentTags,
  buildCommsShowContext,
  showLevelPayloadFields,
};

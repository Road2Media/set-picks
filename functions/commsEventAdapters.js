/**
 * Thin event adapters for v1 comms triggers (#440 / epic #441).
 *
 * Each handler resolves audience + payload vars and calls the shared
 * orchestrator via `createCommsAdapterRuntime`. Handlers are gated by
 * `COMMS_EVENT_ADAPTERS_ENABLED=true` at the call site in `index.js`.
 */

"use strict";

const {
  parseShowCalendarSnapshotToShows,
  parseShowCalendarSnapshotToShowsByTour,
  isValidIanaTimeZone,
  ymdInTimeZone,
} = require("./phishnetLiveSetlistAutomation");
const { hasNonEmptyPicksObject, resolveTourKeyForDate } = require("./rollupSeasonAggregates");
const {
  createCommsAdapterRuntime,
  isCommsEventAdaptersEnabled,
} = require("./commsAdapterRuntime");
const {
  aggregateTourStandings,
  assignDisplayRanks,
  tourDatesForKey,
  tourDatesThrough,
  priorTourShowDate,
  nextTourShowDate,
  buildTourRankingsDailyPayloadFields,
} = require("./tourRankingsDailyCore");
const {
  inviteContextForUser,
  buildInviteEmailFields,
} = require("./comms/inviteContext.cjs");
const {
  ensureCommsShowContext,
  showLevelPayloadFields,
} = require("./commsShowContext");
const { buildShowRecapEnrichment } = require("./showRecapNarrativeCore");
const { persistableActualSetlistFromOfficialDoc } = require("./scoringCore");
const {
  isFinalShowOfTour,
  buildTourRecapPodium,
  buildTourRecapEmailBoard,
  buildTourRecapPayload,
  closingVenueForTour,
  deriveSharedWrapFacts,
  derivePlayerWrapFacts,
} = require("./tourRecapCore");
const {
  readTourRecapState,
  writeTourRecapState,
  tourRecapFanoutCompleted,
} = require("./tourRecapState");
const { tourCountdownDeliveryPlan } = require("./commsTemplates");
const { mergeCommsDeliverySummaries } = require("./commsDelivery");

const SITE_URL = "https://www.setlistpickem.com";

const DEFAULT_SHOW_TIME_ZONE = "America/Los_Angeles";

/**
 * Morning cron may retry `tour_recap` for late grades for this many days after
 * the finale date (PT calendar days). Older finales must use admin
 * `runCommsTrigger` / War Room replay — never an unbounded historical fan-out
 * (#1033: first live tick blasted archive `2026 Sphere`).
 */
const MAX_TOUR_RECAP_LOOKBACK_DAYS = 14;

/**
 * @param {string} a YYYY-MM-DD
 * @param {string} b YYYY-MM-DD
 * @returns {number} whole calendar days from a → b (UTC date math)
 */
function daysBetweenYmd(a, b) {
  const [ay, am, ad] = String(a)
    .split("-")
    .map((x) => Number.parseInt(x, 10));
  const [by, bm, bd] = String(b)
    .split("-")
    .map((x) => Number.parseInt(x, 10));
  if (![ay, am, ad, by, bm, bd].every((n) => Number.isFinite(n))) return NaN;
  const t0 = Date.UTC(ay, am - 1, ad);
  const t1 = Date.UTC(by, bm - 1, bd);
  return Math.round((t1 - t0) / 86400000);
}

/**
 * Sphere ’26 stays archive / War Room (`deliverSphere2026TourRecapInbox`) only.
 * Live `tour_recap` must not pick up calendar labels like `2026 Sphere`.
 *
 * @param {string} tourKey
 * @returns {boolean}
 */
function isSphereArchiveTourKey(tourKey) {
  return /\bsphere\b/i.test(String(tourKey || "").trim());
}

/**
 * Whether the 8am PT pending scanner should attempt `tour_recap` for this tour.
 *
 * @param {{ tourKey: string, finalDate: string, today: string }} params
 * @returns {boolean}
 */
function shouldAttemptPendingTourRecap({ tourKey, finalDate, today }) {
  if (isSphereArchiveTourKey(tourKey)) return false;
  if (!finalDate || !today || finalDate >= today) return false;
  const age = daysBetweenYmd(finalDate, today);
  if (!Number.isFinite(age)) return false;
  return age >= 1 && age <= MAX_TOUR_RECAP_LOOKBACK_DAYS;
}

/**
 * Morning after a tour finale is `tour_recap` day — skip `tour_rankings_daily`
 * (all channels, including email) so the wrap is one message.
 *
 * @param {string[]} tourDates
 * @param {string} showDate
 * @returns {boolean}
 */
function shouldSkipTourRankingsOnTourRecapMorning(tourDates, showDate) {
  return isFinalShowOfTour(tourDates, showDate);
}
const COUNTDOWN_DAYS = [10, 5, 3, 1];
/** Firestore `in` queries allow at most 30 equality values. */
const FIRESTORE_IN_QUERY_LIMIT = 30;

/**
 * @param {unknown} data
 * @returns {string}
 */
function handleFromUser(data) {
  const h = data && typeof data.handle === "string" ? data.handle.trim() : "";
  return h;
}

/**
 * Build showDate → Set(uid) for users with non-empty picks (#509).
 *
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} showDates
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function loadUserIdsWithPicksForShowDates(db, showDates) {
  const unique = [...new Set(showDates.filter((d) => typeof d === "string" && d.trim()))];
  /** @type {Map<string, Set<string>>} */
  const byDate = new Map();
  for (const d of unique) byDate.set(d, new Set());
  if (unique.length === 0) return byDate;

  for (let i = 0; i < unique.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("picks").where("showDate", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const sd = typeof data.showDate === "string" ? data.showDate.trim() : "";
      const uid = typeof data.userId === "string" ? data.userId.trim() : "";
      if (!uid || !byDate.has(sd)) continue;
      if (hasNonEmptyPicksObject(data.picks)) byDate.get(sd).add(uid);
    }
  }
  return byDate;
}

/**
 * Fire when a user doc gains a non-empty handle (profile setup complete).
 *
 * @param {object | null | undefined} before
 * @param {object | null | undefined} after
 */
function shouldDeliverAccountWelcome(before, after) {
  const afterHandle = handleFromUser(after);
  if (!afterHandle) return false;
  const beforeHandle = handleFromUser(before);
  return !beforeHandle;
}

/**
 * Fire on the first persisted pick doc for a show (initial lock-in).
 *
 * @param {boolean} beforeExists
 * @param {object | null | undefined} before
 * @param {object | null | undefined} after
 */
function shouldDeliverPicksConfirmed(beforeExists, before, after) {
  if (beforeExists) return false;
  if (!after || typeof after !== "object") return false;
  return hasNonEmptyPicksObject(after.picks);
}

/**
 * @param {Array<{ date: string, venue?: string, city?: string, timeZone?: string }>} shows
 * @param {string} showDate
 */
function findShowMeta(shows, showDate) {
  if (!Array.isArray(shows)) return null;
  for (const s of shows) {
    if (s && s.date === showDate) return s;
  }
  return null;
}

/**
 * @param {Iterable<{ id?: string, data?: () => object }>} pickDocs
 * @param {Map<string, number>} scoresByPickId
 * @returns {Map<string, { rank: number, score: number, total: number }>}
 */
function computeGlobalRankByUid(pickDocs, scoresByPickId) {
  /** @type {{ uid: string, score: number }[]} */
  const rows = [];
  for (const doc of pickDocs) {
    const d = doc.data?.() || doc.data || {};
    const uid = typeof d.userId === "string" ? d.userId.trim() : "";
    if (!uid || !hasNonEmptyPicksObject(d.picks)) continue;
    const score = scoresByPickId.get(doc.id) ?? (typeof d.score === "number" ? d.score : 0);
    rows.push({ uid, score });
  }
  rows.sort((a, b) => b.score - a.score);
  /** @type {Map<string, { rank: number, score: number, total: number }>} */
  const out = new Map();
  const total = rows.length;
  let rank = 0;
  let prevScore = null;
  for (let i = 0; i < rows.length; i++) {
    const { uid, score } = rows[i];
    if (prevScore === null || score < prevScore) {
      rank = i + 1;
      prevScore = score;
    }
    out.set(uid, { rank, score, total });
  }
  return out;
}

/**
 * @param {Array<{ date: string, timeZone?: string }>} calendarShows
 * @param {Date} now
 * @param {number[]} countdownDays
 */
function findTourCountdownTargets(calendarShows, now, countdownDays = COUNTDOWN_DAYS) {
  if (!Array.isArray(calendarShows) || calendarShows.length === 0) return [];
  const byTour = new Map();
  for (const show of calendarShows) {
    if (!show?.date) continue;
    const tz =
      typeof show.timeZone === "string" && show.timeZone.trim()
        ? show.timeZone.trim()
        : DEFAULT_SHOW_TIME_ZONE;
    const tourKey = show.tour || show.tour_name || "tour";
    const key = `${tourKey}::${show.date}`;
    if (!byTour.has(tourKey) || show.date < byTour.get(tourKey).firstShowDate) {
      byTour.set(tourKey, {
        tourId: tourKey,
        tour_name: tourKey,
        firstShowDate: show.date,
        first_show_date: show.date,
        first_show_venue: show.venue || "",
        first_show_city: show.city || "",
        timeZone: tz,
        lock_time_local: "7:30 PM",
      });
    }
  }

  /** @type {typeof byTour extends Map<string, infer V> ? V[] : never} */
  const hits = [];
  for (const meta of byTour.values()) {
    if (!isValidIanaTimeZone(meta.timeZone)) continue;
    const todayYmd = ymdInTimeZone(now, meta.timeZone);
    const first = meta.firstShowDate;
    if (!first || todayYmd >= first) continue;
    const msPerDay = 86400000;
    const today = Date.parse(`${todayYmd}T12:00:00Z`);
    const firstMs = Date.parse(`${first}T12:00:00Z`);
    const daysRemaining = Math.round((firstMs - today) / msPerDay);
    if (!countdownDays.includes(daysRemaining)) continue;
    hits.push({ ...meta, days_remaining: daysRemaining });
  }
  return hits;
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   uid: string,
 *   beforeData: object | null | undefined,
 *   afterData: object | null | undefined,
 *   resendApiKey?: string,
 *   logger?: object,
 * }} params
 */
async function handleAccountWelcome({
  db,
  admin,
  uid,
  beforeData,
  afterData,
  resendApiKey,
  logger,
}) {
  if (!isCommsEventAdaptersEnabled()) return null;
  if (!shouldDeliverAccountWelcome(beforeData, afterData)) return null;

  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });
  const calSnap = await db.collection("show_calendar").doc("snapshot").get();
  const shows = parseShowCalendarSnapshotToShows(calSnap.exists ? calSnap.data() : null);
  const upcoming = shows.find((s) => s?.date && s.date >= ymdInTimeZone(new Date(), DEFAULT_SHOW_TIME_ZONE));

  const payload = {
    handle: handleFromUser(afterData),
    tour_name: upcoming?.tour || upcoming?.tour_name || null,
    next_show_date: upcoming?.date || null,
    next_show_venue: upcoming?.venue || null,
  };

  return runtime.deliver("account_welcome", [
    {
      uid,
      userData: afterData || {},
      payload,
      vars: { uid },
    },
  ]);
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   pickId: string,
 *   beforeExists: boolean,
 *   beforeData: object | null | undefined,
 *   afterData: object | null | undefined,
 *   resendApiKey?: string,
 *   logger?: object,
 * }} params
 */
async function handlePicksConfirmed({
  db,
  admin,
  pickId,
  beforeExists,
  beforeData,
  afterData,
  resendApiKey,
  logger,
}) {
  if (!isCommsEventAdaptersEnabled()) return null;
  if (!shouldDeliverPicksConfirmed(beforeExists, beforeData, afterData)) return null;

  const uid = typeof afterData?.userId === "string" ? afterData.userId.trim() : "";
  const showDate = typeof afterData?.showDate === "string" ? afterData.showDate.trim() : "";
  if (!uid || !showDate) return null;

  const calSnap = await db.collection("show_calendar").doc("snapshot").get();
  const shows = parseShowCalendarSnapshotToShows(calSnap.exists ? calSnap.data() : null);
  const meta = findShowMeta(shows, showDate);

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  const payload = {
    handle: handleFromUser(afterData) || handleFromUser(userData),
    show_date: showDate,
    venue_name: meta?.venue || "",
    venue_city: meta?.city || "",
    opener_pick: afterData?.picks?.opener || null,
    closer_pick: afterData?.picks?.closer || null,
    encore_pick: afterData?.picks?.encore || null,
  };

  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });
  return runtime.deliver("picks_confirmed", [
    {
      uid,
      userData,
      payload,
      vars: { uid, showDate },
    },
  ]);
}

/**
 * Post-grade fan-out for show_recap + tour_engagement_reminder (#440).
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   picksSnap: import("firebase-admin").firestore.QuerySnapshot,
 *   newScoresById: Map<string, number>,
 *   tourKey: string | null,
 *   showDatesByTour: unknown,
 *   resendApiKey?: string,
 *   logger?: object,
 * }} params
 */
async function deliverPostRollupComms({
  db,
  admin,
  showDate,
  picksSnap,
  newScoresById,
  tourKey,
  showDatesByTour,
  resendApiKey,
  logger,
}) {
  if (!isCommsEventAdaptersEnabled()) return null;
  if (!picksSnap || picksSnap.empty) return null;

  const calSnap = await db.collection("show_calendar").doc("snapshot").get();
  const calData = calSnap.exists ? calSnap.data() : null;
  const shows = parseShowCalendarSnapshotToShows(calData);
  const meta = findShowMeta(shows, showDate) || {};
  const ranks = computeGlobalRankByUid(picksSnap.docs, newScoresById);
  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });

  const tourDates = tourKey ? tourDatesForKey(showDatesByTour, tourKey) : [];
  const nextDate = nextTourShowDate(tourDates, showDate);
  const nextMeta = nextDate ? findShowMeta(shows, nextDate) || {} : {};
  const showsRemaining =
    tourDates.length > 0 ? tourDates.filter((d) => d > showDate).length : null;
  const securedByNextShow = nextDate
    ? await loadUserIdsWithPicksForShowDates(db, [nextDate])
    : new Map();
  const nextShowSecuredUids = nextDate ? securedByNextShow.get(nextDate) || new Set() : new Set();

  // #572 — night-of narrative context (soft-fail to scorecard-only).
  let showLevel = {};
  let actualSetlist = null;
  try {
    const setlistSnap = await db.collection("official_setlists").doc(showDate).get();
    const setlistDoc = setlistSnap.exists ? setlistSnap.data() || {} : null;
    actualSetlist = setlistDoc
      ? persistableActualSetlistFromOfficialDoc(setlistDoc)
      : null;
    const context = await ensureCommsShowContext({
      db,
      admin,
      showDate,
      setlistDoc,
      showDatesByTour,
      logger,
    });
    showLevel = showLevelPayloadFields(context);
  } catch (e) {
    logger?.warn?.("deliverPostRollupComms.showContext failed", {
      showDate,
      msg: e instanceof Error ? e.message : String(e),
    });
  }

  let topScorerHandle = null;
  let topScore = null;
  for (const [, info] of ranks) {
    if (info?.rank === 1) {
      topScore = info.score;
      break;
    }
  }
  if (topScore != null) {
    for (const pickDoc of picksSnap.docs) {
      const pickData = pickDoc.data() || {};
      const uid = typeof pickData.userId === "string" ? pickData.userId.trim() : "";
      const score = newScoresById.get(pickDoc.id) ?? 0;
      if (uid && score === topScore) {
        topScorerHandle = handleFromUser(pickData) || null;
        break;
      }
    }
  }

  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const recapRecipients = [];
  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const engagementRecipients = [];

  for (const pickDoc of picksSnap.docs) {
    const pickData = pickDoc.data() || {};
    const uid = typeof pickData.userId === "string" ? pickData.userId.trim() : "";
    if (!uid || !hasNonEmptyPicksObject(pickData.picks)) continue;

    const score = newScoresById.get(pickDoc.id) ?? 0;
    const rankInfo = ranks.get(uid) || { rank: null, score, total: ranks.size };
    const wasGraded = pickData.isGraded === true;

    // eslint-disable-next-line no-await-in-loop
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const enrichment = buildShowRecapEnrichment({
      showLevel,
      userPicks: pickData.picks,
      actualSetlist,
      show_score: score,
      top_scorer_handle: topScorerHandle,
      top_score: topScore,
      global_rank: rankInfo.rank,
      global_total_pickers: rankInfo.total,
      showDate,
    });

    recapRecipients.push({
      uid,
      userData,
      payload: {
        handle: handleFromUser(pickData) || handleFromUser(userData),
        show_date: showDate,
        venue_name: meta.venue || "",
        venue_city: meta.city || "",
        show_score: score,
        global_rank: rankInfo.rank,
        global_total_pickers: rankInfo.total,
        ...enrichment,
      },
      vars: { uid, showDate },
    });

    if (!wasGraded && tourKey) {
      const season = userData.seasonStats?.[tourKey];
      const showsBefore = typeof season?.shows === "number" ? season.shows : 0;
      if (showsBefore === 0) {
        engagementRecipients.push({
          uid,
          userData,
          payload: {
            handle: handleFromUser(userData),
            show_score: score,
            global_rank: rankInfo.rank,
            global_total_pickers: rankInfo.total,
            tour_name: tourKey,
            tourId: tourKey,
            shows_remaining: showsRemaining,
            next_show_date: nextDate || "",
            next_show_venue: nextMeta.venue || "",
            // #509: next-show picks (not the graded show just rolled up)
            picks_secured: nextDate ? nextShowSecuredUids.has(uid) : false,
          },
          vars: { uid, tourId: tourKey },
        });
      }
    }
  }

  const recapSummary = await runtime.deliver("show_recap", recapRecipients);
  const engagementSummary =
    engagementRecipients.length > 0
      ? await runtime.deliver("tour_engagement_reminder", engagementRecipients)
      : null;
  // `tour_recap` waits for the next morning (8am PT cron). Last night of
  // tour stays a night `show_recap` only — same split as the Summer '26 one-off.

  return { recapSummary, engagementSummary };
}

/**
 * End-of-tour `tour_recap` fan-out (#510). Fires only when `showDate` is the
 * last date in `showDatesByTour` for `tourKey`. Audience: users with ≥1 graded
 * pick on any show in that tour. Production calls this from the morning-after
 * 8am PT cron (`deliverPendingTourRecaps`), not the night-of rollup.
 * Sphere ’26 replay stays on `deliverSphere2026TourRecapInbox` (War Room / QA only).
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   runtime: { deliver: Function },
 *   showDate: string,
 *   tourKey: string | null,
 *   showDatesByTour: unknown,
 *   logger?: object,
 * }} params
 */
async function deliverTourRecapIfFinalShow({
  db,
  runtime,
  showDate,
  tourKey,
  showDatesByTour,
  logger,
}) {
  if (!tourKey) return null;
  const tourDates = tourDatesForKey(showDatesByTour, tourKey);
  if (!isFinalShowOfTour(tourDates, showDate)) return null;

  const picksByDate = await loadPicksByDates(db, tourDates);
  const leaders = aggregateTourStandings(picksByDate);
  if (leaders.length === 0) {
    logger?.info?.("deliverTourRecapIfFinalShow: no eligible players", {
      tourKey,
      showDate,
    });
    return { skipped: "no_eligible_players", tourId: tourKey };
  }

  const ranked = assignDisplayRanks(leaders);
  /** @type {Array<Record<string, unknown> & { userData: Record<string, unknown> }>} */
  const enriched = [];
  for (const row of leaders) {
    // eslint-disable-next-line no-await-in-loop
    const userSnap = await db.collection("users").doc(row.uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const season = userData.seasonStats && typeof userData.seasonStats === "object"
      ? userData.seasonStats[tourKey]
      : null;
    const correctSlots = Number(season?.correctSlots);
    enriched.push({
      ...row,
      correctSlots: Number.isFinite(correctSlots) ? correctSlots : null,
      userData,
    });
  }
  const podium = buildTourRecapPodium(enriched);
  const emailBoard = buildTourRecapEmailBoard(enriched);
  const participantCount = leaders.length;
  const showCount = tourDates.length;
  const tourName = tourKey;
  let setlists = [];
  try {
    setlists = await loadOfficialSetlistsForDates(db, tourDates);
  } catch (err) {
    logger?.warn?.("deliverTourRecapIfFinalShow: setlist read failed", {
      tourKey,
      message: err?.message || String(err),
    });
  }
  const shared = deriveSharedWrapFacts({
    setlists,
    picksByDate,
    showCount,
    closingVenue: closingVenueForTour(showDatesByTour, tourKey),
  });

  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const recipients = [];
  for (const row of enriched) {
    const info = ranked.get(row.uid);
    const rank = info?.rank ?? recipients.length + 1;
    const userData = row.userData || {};
    recipients.push({
      uid: row.uid,
      userData,
      payload: buildTourRecapPayload({
        handle: row.handle || handleFromUser(userData),
        rank,
        points: row.totalPoints,
        wins: row.wins,
        showsPlayed: row.shows,
        participantCount,
        tourId: tourKey,
        tourName,
        showCount,
        podium,
        emailBoard,
        shared,
        player: derivePlayerWrapFacts({
          uid: row.uid,
          picksByDate,
          setlists,
          shared,
          seasonStats: userData.seasonStats,
          tourKey,
          points: row.totalPoints,
          wins: row.wins,
          showsPlayed: row.shows,
          showCount,
        }),
      }),
      vars: { uid: row.uid, tourId: tourKey },
    });
  }

  logger?.info?.("deliverTourRecapIfFinalShow: fan-out", {
    tourKey,
    showDate,
    recipients: recipients.length,
  });
  return runtime.deliver("tour_recap", recipients);
}

/**
 * Morning-after `tour_recap` for tours whose final show date is already past
 * (America/Los_Angeles, same tz as the 8am cron), within
 * {@link MAX_TOUR_RECAP_LOOKBACK_DAYS}.
 *
 * Once-ever gate: after a successful fan-out (or archive skip), writes
 * `comms_tour_recap_state/{tourId}` and hard-skips that tour forever on later
 * ticks (#1033). Per-uid `fcm_notification_log` dedup remains for channel
 * idempotency; the tour doc is the durable process so each tour only gets one
 * automatic end-of-tour send.
 *
 * Firestore is read only for tours that can still send (finale already past,
 * inside the 14-day lookback) and for Sphere archive labels, which are closed
 * even outside that window. In-progress, future, and older non-Sphere tours
 * are not the recap reference period and are not read. The morning rankings
 * email is a later step in the same cron and keys off yesterday's show.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin?: typeof import("firebase-admin"),
 *   runtime: { deliver: Function },
 *   showDatesByTour: unknown,
 *   now?: Date,
 *   logger?: object,
 * }} params
 * @returns {Promise<Array<{ tourKey: string, finalDate: string, summary: unknown }>>}
 */
async function deliverPendingTourRecaps({
  db,
  admin,
  runtime,
  showDatesByTour,
  now = new Date(),
  logger,
}) {
  if (!Array.isArray(showDatesByTour)) return [];
  const today = ymdInTimeZone(now, DEFAULT_SHOW_TIME_ZONE);
  /** @type {Array<{ tourKey: string, finalDate: string, summary: unknown }>} */
  const out = [];
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tourKey = typeof group.tour === "string" ? group.tour.trim() : "";
    if (!tourKey) continue;
    const tourDates = tourDatesForKey(showDatesByTour, tourKey);
    const finalDate = tourDates.length > 0 ? tourDates[tourDates.length - 1] : "";
    const inRecapWindow = shouldAttemptPendingTourRecap({
      tourKey,
      finalDate,
      today,
    });
    const sphereArchive = isSphereArchiveTourKey(tourKey);
    if (!inRecapWindow && !sphereArchive) {
      if (finalDate && finalDate < today) {
        logger?.info?.("deliverPendingTourRecaps: skip tour", {
          tourKey,
          finalDate,
          today,
          lookbackDays: MAX_TOUR_RECAP_LOOKBACK_DAYS,
        });
      }
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const state = await readTourRecapState({ db, tourKey });
      if (state.terminal) {
        logger?.info?.("deliverPendingTourRecaps: skip tour (state terminal)", {
          tourKey,
          finalDate,
          status: state.data?.status,
        });
        continue;
      }

      if (isSphereArchiveTourKey(tourKey)) {
        if (admin) {
          // eslint-disable-next-line no-await-in-loop
          await writeTourRecapState({
            db,
            admin,
            tourKey,
            status: "skipped_archive",
            finalDate: finalDate || null,
            source: "cron",
          });
        }
        logger?.info?.("deliverPendingTourRecaps: skip Sphere archive tour", {
          tourKey,
          finalDate,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const summary = await deliverTourRecapIfFinalShow({
        db,
        runtime,
        showDate: finalDate,
        tourKey,
        showDatesByTour,
        logger,
      });
      if (summary) out.push({ tourKey, finalDate, summary });

      if (admin && tourRecapFanoutCompleted(summary)) {
        // eslint-disable-next-line no-await-in-loop
        await writeTourRecapState({
          db,
          admin,
          tourKey,
          status: "sent",
          finalDate,
          source: "cron",
          extra: {
            delivered: Number(summary.delivered) || 0,
            processed: Number(summary.processed) || 0,
          },
        });
        logger?.info?.("deliverPendingTourRecaps: marked tour sent", {
          tourKey,
          finalDate,
          delivered: summary.delivered,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger?.error?.("deliverPendingTourRecaps: tour failed", { tourKey, finalDate, msg });
    }
  }
  return out;
}

/**
 * Live-scoring comms: first points + leader change detection.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   beforeScores: Map<string, number>,
 *   afterScores: Map<string, number>,
 *   picksSnap: import("firebase-admin").firestore.QuerySnapshot,
 *   resendApiKey?: string,
 *   logger?: object,
 * }} params
 */
async function deliverLiveScoreComms({
  db,
  admin,
  showDate,
  beforeScores,
  afterScores,
  picksSnap,
  resendApiKey,
  logger,
}) {
  if (!isCommsEventAdaptersEnabled()) return null;

  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });
  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const firstPoints = [];
  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const leaderChanges = [];

  const beforeLeader = leaderUidFromScores(beforeScores, picksSnap);
  const afterLeader = leaderUidFromScores(afterScores, picksSnap);

  for (const pickDoc of picksSnap.docs) {
    const pickData = pickDoc.data() || {};
    const uid = typeof pickData.userId === "string" ? pickData.userId.trim() : "";
    if (!uid) continue;
    const prev = beforeScores.get(pickDoc.id) ?? 0;
    const next = afterScores.get(pickDoc.id) ?? 0;
    if (prev <= 0 && next > 0) {
      // eslint-disable-next-line no-await-in-loop
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      firstPoints.push({
        uid,
        userData,
        payload: {
          handle: handleFromUser(pickData) || handleFromUser(userData),
          show_date: showDate,
          points_earned: next - prev,
        },
        vars: { uid, showDate },
      });
    }
  }

  if (afterLeader && afterLeader !== beforeLeader) {
    const userSnap = await db.collection("users").doc(afterLeader).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const afterScore = scoreForUid(afterScores, picksSnap, afterLeader);
    const margin = leaderMargin(afterScores, picksSnap, afterLeader);
    leaderChanges.push({
      uid: afterLeader,
      userData,
      payload: {
        handle: handleFromUser(userData),
        show_date: showDate,
        leaderboard_name: "Global",
        lead_margin: margin,
        show_score: afterScore,
      },
      vars: { uid: afterLeader, showDate, leaderboard: "global" },
    });
  }

  const firstSummary =
    firstPoints.length > 0 ? await runtime.deliver("score_first_points", firstPoints) : null;
  const leaderSummary =
    leaderChanges.length > 0 ? await runtime.deliver("score_leader", leaderChanges) : null;
  return { firstSummary, leaderSummary };
}

/**
 * @param {Map<string, number>} scoresByPickId
 * @param {import("firebase-admin").firestore.QuerySnapshot} picksSnap
 */
function leaderUidFromScores(scoresByPickId, picksSnap) {
  let max = -1;
  let leader = null;
  let tie = false;
  for (const doc of picksSnap.docs) {
    const d = doc.data() || {};
    const uid = typeof d.userId === "string" ? d.userId.trim() : "";
    if (!uid || !hasNonEmptyPicksObject(d.picks)) continue;
    const score = scoresByPickId.get(doc.id) ?? 0;
    if (score > max) {
      max = score;
      leader = uid;
      tie = false;
    } else if (score === max && score > 0) {
      tie = true;
    }
  }
  if (tie || max <= 0) return null;
  return leader;
}

function scoreForUid(scoresByPickId, picksSnap, uid) {
  for (const doc of picksSnap.docs) {
    const d = doc.data() || {};
    if (d.userId === uid) return scoresByPickId.get(doc.id) ?? 0;
  }
  return 0;
}

function leaderMargin(scoresByPickId, picksSnap, leaderUid) {
  const scores = [];
  for (const doc of picksSnap.docs) {
    const d = doc.data() || {};
    if (!hasNonEmptyPicksObject(d.picks)) continue;
    scores.push(scoresByPickId.get(doc.id) ?? 0);
  }
  scores.sort((a, b) => b - a);
  const top = scores[0] ?? 0;
  const second = scores[1] ?? 0;
  if (leaderUid && top > 0) return top - second;
  return null;
}

/**
 * Daily scheduled tour countdown (#440).
 */
async function runScheduledTourCountdown({ db, admin, resendApiKey, logger, now = new Date() }) {
  if (!isCommsEventAdaptersEnabled()) return null;

  const calSnap = await db.collection("show_calendar").doc("snapshot").get();
  // #514: per-tour first show from showDatesByTour — flat showDates collapses
  // every tour into one pseudo-tour keyed "tour" (earliest legacy opener wins).
  const shows = parseShowCalendarSnapshotToShowsByTour(
    calSnap.exists ? calSnap.data() : null
  );
  const targets = findTourCountdownTargets(shows, now);
  if (targets.length === 0) return { processed: 0, delivered: 0 };

  const usersSnap = await db.collection("users").where("handle", ">", "").limit(500).get();
  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });
  /** @type {import("./commsDelivery").deliverCommsTrigger extends (...args: infer A) => any ? A[0]["recipients"] : never} */
  const recipients = [];

  // #509: batch picks lookup per first-show date so CTA can say View / Edit
  const securedByShow = await loadUserIdsWithPicksForShowDates(
    db,
    targets.map((t) => t.first_show_date || t.firstShowDate)
  );

  for (const target of targets) {
    const firstShow = target.first_show_date || target.firstShowDate || "";
    const securedUids = securedByShow.get(firstShow) || new Set();
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data() || {};
      if (!handleFromUser(userData)) continue;
      recipients.push({
        uid: userDoc.id,
        userData,
        payload: {
          handle: handleFromUser(userData),
          tour_name: target.tour_name,
          days_remaining: target.days_remaining,
          first_show_date: target.first_show_date,
          first_show_venue: target.first_show_venue,
          first_show_city: target.first_show_city,
          lock_time_local: target.lock_time_local,
          picks_secured: firstShow ? securedUids.has(userDoc.id) : false,
        },
        vars: {
          uid: userDoc.id,
          tourId: target.tourId,
          days_remaining: target.days_remaining,
        },
      });
    }
  }

  const parts = [];
  for (const batch of tourCountdownDeliveryPlan(recipients)) {
    // eslint-disable-next-line no-await-in-loop
    parts.push(
      await runtime.deliver("tour_countdown", batch.recipients, { channels: batch.channels })
    );
  }
  if (parts.length === 0) return { processed: 0, delivered: 0, skipped: 0, results: [] };
  return mergeCommsDeliverySummaries(parts);
}

/**
 * Load graded picks for many show dates (chunked `in` queries).
 *
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 * @returns {Promise<Array<{ date: string, picks: Record<string, unknown>[] }>>}
 */
async function loadPicksByDates(db, dates) {
  /** @type {Map<string, Record<string, unknown>[]>} */
  const byDate = new Map();
  for (const d of dates) byDate.set(d, []);
  if (dates.length === 0) return [];

  for (let i = 0; i < dates.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = dates.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("picks").where("showDate", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const sd = typeof data.showDate === "string" ? data.showDate.trim() : "";
      if (!byDate.has(sd)) continue;
      byDate.get(sd).push({ id: doc.id, ...data });
    }
  }

  return dates.map((date) => ({ date, picks: byDate.get(date) || [] }));
}

/**
 * Official setlists for the wrap. A failed read is the caller's problem;
 * a missing night is an empty doc so that night drops out of the facts.
 *
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 * @returns {Promise<Array<{ date: string, doc: Record<string, unknown> | null }>>}
 */
async function loadOfficialSetlistsForDates(db, dates) {
  /** @type {Array<{ date: string, doc: Record<string, unknown> | null }>} */
  const out = [];
  for (const date of dates) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("official_setlists").doc(date).get();
    out.push({ date, doc: snap.exists ? snap.data() || null : null });
  }
  return out;
}

/**
 * Morning-after tour rankings (#440 / #544) — overall tour leaderboard + rank_change.
 *
 * Audience: users with graded picks for last night. Tour rank is among the full
 * cumulative tour board (all graded pickers through last night), not last-night-only.
 * Regrades are reflected automatically because we recompute from current picks.
 */
async function runScheduledTourRankingsDaily({
  db,
  admin,
  resendApiKey,
  logger,
  now = new Date(),
  collectOnly = false,
}) {
  if (!isCommsEventAdaptersEnabled()) return null;

  const calSnap = await db.collection("show_calendar").doc("snapshot").get();
  const calData = calSnap.exists ? calSnap.data() : null;
  const shows = parseShowCalendarSnapshotToShows(calData);
  const showDatesByTour = calData?.showDatesByTour ?? null;
  /** @type {Map<string, { venue?: string, city?: string }>} */
  const showMetaByDate = new Map();
  for (const s of shows) {
    if (s?.date) showMetaByDate.set(s.date, s);
  }

  const yesterdayCandidates = [];
  for (const s of Array.isArray(shows) ? shows : []) {
    if (!s?.date) continue;
    const tz =
      typeof s.timeZone === "string" && s.timeZone.trim()
        ? s.timeZone.trim()
        : DEFAULT_SHOW_TIME_ZONE;
    if (!isValidIanaTimeZone(tz)) {
      logger?.warn?.("runScheduledTourRankingsDaily: skip show with invalid timezone", {
        date: s.date,
        timeZone: tz,
      });
      continue;
    }
    const today = ymdInTimeZone(now, tz);
    const yesterday = ymdInTimeZone(new Date(now.getTime() - 86400000), tz);
    if (s.date === yesterday && today > s.date) yesterdayCandidates.push(s);
  }

  const runtime = createCommsAdapterRuntime({ db, admin, resendApiKey, logger });
  let tourRecapSummaries = [];
  if (!collectOnly) {
    try {
      tourRecapSummaries = await deliverPendingTourRecaps({
        db,
        admin,
        runtime,
        showDatesByTour,
        now,
        logger,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger?.error?.("runScheduledTourRankingsDaily.tourRecap failed", { msg });
    }
  }

  if (yesterdayCandidates.length === 0) {
    return { processed: 0, delivered: 0, tourRecapSummaries };
  }
  /** @type {Array<{ uid: string, userData?: object, payload: object, vars: object }>} */
  const recipients = [];

  for (const show of yesterdayCandidates) {
    try {
      const showDate = show.date;
      const tourKey = resolveTourKeyForDate(showDate, showDatesByTour);
      const tourDates = tourDatesForKey(showDatesByTour, tourKey);
      if (shouldSkipTourRankingsOnTourRecapMorning(tourDates, showDate)) {
        logger?.info?.("runScheduledTourRankingsDaily: skip finale morning (tour_recap day)", {
          showDate,
          tourKey,
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const picksSnap = await db.collection("picks").where("showDate", "==", showDate).get();
      if (picksSnap.empty) continue;
      const datesThrough = tourDates.length > 0 ? tourDatesThrough(tourDates, showDate) : [showDate];
      const priorDate = priorTourShowDate(tourDates, showDate);
      const nextDate = nextTourShowDate(tourDates, showDate);
      const nextMeta = nextDate ? showMetaByDate.get(nextDate) : null;
      const isTourNightOne = !priorDate;

      // #451: night-of show rank for the folded-in "your night" section.
      const globalRanks = computeGlobalRankByUid(picksSnap.docs, new Map());

      // #544: full tour board through last night (+ prior night for rank_change).
      // eslint-disable-next-line no-await-in-loop
      const picksByDate = await loadPicksByDates(db, datesThrough);
      const currentBoard = assignDisplayRanks(aggregateTourStandings(picksByDate));
      let priorBoard = null;
      if (priorDate) {
        const priorPicksByDate = picksByDate.filter((e) => e.date <= priorDate);
        priorBoard = assignDisplayRanks(aggregateTourStandings(priorPicksByDate));
      }

      /** @type {Set<string>} */
      const lastNightUids = new Set();
      /** @type {Map<string, object>} */
      const picksByUid = new Map();
      for (const pickDoc of picksSnap.docs) {
        const pickData = pickDoc.data() || {};
        const uid = typeof pickData.userId === "string" ? pickData.userId.trim() : "";
        if (!uid || pickData.isGraded !== true) continue;
        lastNightUids.add(uid);
        picksByUid.set(uid, pickData);
      }

      // #572 — night-of narrative for email “Tonight” block (soft-fail).
      let showLevel = {};
      let actualSetlist = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        const setlistSnap = await db.collection("official_setlists").doc(showDate).get();
        const setlistDoc = setlistSnap.exists ? setlistSnap.data() || {} : null;
        actualSetlist = setlistDoc
          ? persistableActualSetlistFromOfficialDoc(setlistDoc)
          : null;
        // eslint-disable-next-line no-await-in-loop
        const context = await ensureCommsShowContext({
          db,
          admin,
          showDate,
          setlistDoc,
          showDatesByTour,
          logger,
        });
        showLevel = showLevelPayloadFields(context);
      } catch (e) {
        logger?.warn?.("runScheduledTourRankingsDaily.showContext failed", {
          showDate,
          msg: e instanceof Error ? e.message : String(e),
        });
      }

      for (const uid of lastNightUids) {
        // eslint-disable-next-line no-await-in-loop
        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const rankInfo = globalRanks.get(uid) || null;
        const pickData = picksByUid.get(uid) || {};
        const pickHandle = handleFromUser(pickData);
        const enrichment = buildShowRecapEnrichment({
          showLevel,
          userPicks: pickData.picks,
          actualSetlist,
          show_score: rankInfo?.score ?? null,
          global_rank: rankInfo?.rank ?? null,
          global_total_pickers: rankInfo?.total ?? null,
          showDate,
        });
        const payload = {
          ...buildTourRankingsDailyPayloadFields({
            uid,
            handle: pickHandle || handleFromUser(userData),
            showDate,
            venueName: show.venue || "",
            venueCity: show.city || "",
            showScore: rankInfo?.score ?? null,
            globalRank: rankInfo?.rank ?? null,
            globalTotalPickers: rankInfo?.total ?? null,
            currentBoard,
            priorBoard,
            isTourNightOne,
            nextShowDate: nextDate,
            nextShowVenue: nextMeta?.venue || "",
          }),
          ...enrichment,
        };
        // eslint-disable-next-line no-await-in-loop
        const { inviteCode, poolName } = await inviteContextForUser(db, userData);
        const inviterHandle =
          pickHandle ||
          (typeof userData.handle === "string" ? userData.handle.trim() : "");
        const inviteFields =
          buildInviteEmailFields({
            baseUrl: SITE_URL,
            inviterHandle,
            inviteCode,
            poolName,
            campaign: "tour_rankings_daily",
          }) || {};
        Object.assign(payload, inviteFields);
        recipients.push({
          uid,
          userData,
          payload,
          vars: { uid, showDate },
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger?.error?.("runScheduledTourRankingsDaily.show failed", {
        showDate: show?.date || null,
        msg,
      });
    }
  }

  if (collectOnly) {
    return { processed: recipients.length, delivered: 0, recipients, tourRecapSummaries };
  }

  let rankingsSummary = { processed: 0, delivered: 0, skipped: 0, results: [] };
  try {
    rankingsSummary = await runtime.deliver("tour_rankings_daily", recipients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.error?.("runScheduledTourRankingsDaily.rankings failed", { msg });
  }
  return { ...rankingsSummary, tourRecapSummaries };
}

module.exports = {
  shouldDeliverAccountWelcome,
  shouldDeliverPicksConfirmed,
  findShowMeta,
  shouldSkipTourRankingsOnTourRecapMorning,
  MAX_TOUR_RECAP_LOOKBACK_DAYS,
  daysBetweenYmd,
  isSphereArchiveTourKey,
  shouldAttemptPendingTourRecap,
  computeGlobalRankByUid,
  findTourCountdownTargets,
  loadUserIdsWithPicksForShowDates,
  handleAccountWelcome,
  handlePicksConfirmed,
  deliverPostRollupComms,
  deliverTourRecapIfFinalShow,
  deliverPendingTourRecaps,
  deliverLiveScoreComms,
  runScheduledTourCountdown,
  runScheduledTourRankingsDaily,
  leaderUidFromScores,
};

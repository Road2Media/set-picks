/**
 * Annual wrap fan-out (#1111).
 *
 * In-app goes out when the last show of the calendar year is graded.
 * Email and push go out on the next 8:00 AM Pacific tick, the same job as
 * the tour wrap. A dedup doc that already lists in-app still accepts the
 * morning channels. Nothing here sends a sample.
 *
 * The year is not an edition. An archived tour inside the year does not
 * block the wrap. The board matches the year view: calendar dates on or
 * after game launch.
 */

"use strict";

const { annualYearDocId, calendarYearOfShowDate } = require("./calendarYearTourStats");
const { ymdInTimeZone } = require("./phishnetLiveSetlistAutomation");
const { readProcessState, writeProcessState } = require("./commsProcessState");
const { tourRecapFanoutCompleted } = require("./tourRecapState");
const {
  ANNUAL_WRAP_GRADE_CHANNELS,
  ANNUAL_WRAP_MORNING_CHANNELS,
  showsInCalendarYear,
  calendarYearsOnCalendar,
  isLastShowOfYear,
  shouldAttemptPendingAnnualWrap,
  yearFinaleReady,
  assembleAnnualWrapRecipients,
} = require("./annualWrapCore");

const PICKS_IN_QUERY_LIMIT = 30;
const DEFAULT_TIME_ZONE = "America/Los_Angeles";

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 */
async function loadPicksByDates(db, dates) {
  /** @type {Map<string, Record<string, unknown>[]>} */
  const byDate = new Map();
  for (const date of dates) byDate.set(date, []);
  if (dates.length === 0) return [];
  for (let i = 0; i < dates.length; i += PICKS_IN_QUERY_LIMIT) {
    const chunk = dates.slice(i, i + PICKS_IN_QUERY_LIMIT);
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("picks").where("showDate", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const showDate = typeof data.showDate === "string" ? data.showDate.trim() : "";
      if (!byDate.has(showDate)) continue;
      byDate.get(showDate).push({ id: doc.id, ...data });
    }
  }
  return dates.map((date) => ({ date, picks: byDate.get(date) || [] }));
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
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
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {number} year
 */
async function loadYearSongFacts(db, year) {
  const snap = await db.collection("public_tour_stats").doc(annualYearDocId(year)).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const unique = Number(data.uniqueSongs);
  const bustouts = Array.isArray(data.bustouts) ? data.bustouts : [];
  return {
    uniqueSongs: Number.isFinite(unique) && unique > 0 ? Math.trunc(unique) : 0,
    bustouts: bustouts
      .map((row) => ({
        title: typeof row?.title === "string" ? row.title.trim() : "",
        showDate: typeof row?.showDate === "string" ? row.showDate : "",
        lastPlayed: typeof row?.lastPlayed === "string" ? row.lastPlayed : "",
        debutYear: Number.isFinite(Number(row?.debutYear)) ? Math.trunc(Number(row.debutYear)) : null,
      }))
      .filter((row) => row.title),
  };
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} uids
 */
async function loadUsersByUid(db, uids) {
  /** @type {Record<string, Record<string, unknown>>} */
  const out = {};
  for (const uid of uids) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("users").doc(uid).get();
    out[uid] = snap.exists ? snap.data() || {} : {};
  }
  return out;
}

/**
 * Build and deliver one year. Returns null when `showDate` is not the last
 * show of its calendar year.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   runtime: { deliver: Function },
 *   showDate: string,
 *   showDatesByTour: unknown,
 *   channels: string[],
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 * }} params
 */
async function deliverAnnualWrapForShow({
  db,
  runtime,
  showDate,
  showDatesByTour,
  channels,
  logger,
}) {
  const yearNumber = calendarYearOfShowDate(showDate);
  if (!yearNumber) return null;
  const shows = showsInCalendarYear(showDatesByTour, yearNumber);
  if (!isLastShowOfYear(showDate, shows)) return null;

  const state = await readProcessState({
    db,
    triggerId: "annual_wrap",
    scope: String(yearNumber),
  });
  if (state.terminal) {
    logger?.info?.("deliverAnnualWrapForShow: skip year (state terminal)", {
      year: yearNumber,
      showDate,
      status: state.data?.status,
    });
    return { skipped: "process_terminal", year: String(yearNumber) };
  }

  const dates = shows.map((show) => show.date);
  const picksByDate = await loadPicksByDates(db, dates);
  const finale = picksByDate.find((row) => row.date === showDate);
  if (!yearFinaleReady(finale?.picks)) {
    logger?.info?.("deliverAnnualWrapForShow: finale not graded yet", { year: yearNumber, showDate });
    return { skipped: "finale_not_graded", year: String(yearNumber) };
  }

  let setlists = [];
  try {
    setlists = await loadOfficialSetlistsForDates(db, dates);
  } catch (error) {
    logger?.warn?.("deliverAnnualWrapForShow: setlist read failed", {
      year: yearNumber,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  let songFacts = null;
  try {
    songFacts = await loadYearSongFacts(db, yearNumber);
  } catch (error) {
    logger?.warn?.("deliverAnnualWrapForShow: year stats read failed", {
      year: yearNumber,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const leadersPreview = picksByDate.flatMap((row) => row.picks || []);
  const uids = [...new Set(
    leadersPreview
      .map((row) => String(row?.userId || row?.uid || "").trim())
      .filter(Boolean),
  )];
  const usersByUid = await loadUsersByUid(db, uids);
  const assembled = assembleAnnualWrapRecipients({
    year: yearNumber,
    shows,
    picksByDate,
    setlists,
    songFacts,
    usersByUid,
  });
  if (assembled.skipped) {
    logger?.info?.("deliverAnnualWrapForShow: no eligible players", { year: yearNumber, showDate });
    return { skipped: assembled.skipped, year: String(yearNumber) };
  }

  logger?.info?.("deliverAnnualWrapForShow: fan-out", {
    year: yearNumber,
    showDate,
    channels,
    recipients: assembled.recipients.length,
  });
  const summary = await runtime.deliver("annual_wrap", assembled.recipients, { channels });
  return summary;
}

/**
 * In-app as soon as the year's last show is graded. Failures stay inside
 * this call so a year-wrap miss does not cancel `show_recap`.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   runtime: { deliver: Function },
 *   showDate: string,
 *   showDatesByTour: unknown,
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 * }} params
 */
async function deliverAnnualWrapInAppOnGrade(params) {
  try {
    return await deliverAnnualWrapForShow({
      ...params,
      channels: ANNUAL_WRAP_GRADE_CHANNELS,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    params.logger?.error?.("deliverAnnualWrapInAppOnGrade failed", {
      showDate: params.showDate,
      msg,
    });
    return null;
  }
}

/**
 * Morning email and push, plus in-app when the grade hook has not written it.
 * Marks the year sent only after a morning fan-out actually delivers.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin?: typeof import("firebase-admin"),
 *   runtime: { deliver: Function },
 *   showDatesByTour: unknown,
 *   now?: Date,
 *   logger?: { info?: Function, warn?: Function, error?: Function },
 * }} params
 */
async function deliverPendingAnnualWraps({
  db,
  admin,
  runtime,
  showDatesByTour,
  now = new Date(),
  logger,
}) {
  if (!Array.isArray(showDatesByTour)) return [];
  const today = ymdInTimeZone(now, DEFAULT_TIME_ZONE);
  /** @type {Array<{ year: string, finalDate: string, summary: unknown }>} */
  const out = [];
  for (const yearNumber of calendarYearsOnCalendar(showDatesByTour)) {
    const shows = showsInCalendarYear(showDatesByTour, yearNumber);
    const finalDate = shows.length ? shows[shows.length - 1].date : "";
    if (!shouldAttemptPendingAnnualWrap(finalDate, today)) continue;
    const year = String(yearNumber);
    try {
      // eslint-disable-next-line no-await-in-loop
      const summary = await deliverAnnualWrapForShow({
        db,
        runtime,
        showDate: finalDate,
        showDatesByTour,
        channels: ANNUAL_WRAP_MORNING_CHANNELS,
        logger,
      });
      if (summary) out.push({ year, finalDate, summary });
      if (admin && tourRecapFanoutCompleted(summary)) {
        // eslint-disable-next-line no-await-in-loop
        await writeProcessState({
          db,
          admin,
          triggerId: "annual_wrap",
          scope: year,
          status: "sent",
          finalDate,
          source: "cron",
        });
        logger?.info?.("deliverPendingAnnualWraps: marked year sent", {
          year,
          finalDate,
          delivered: summary.delivered,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger?.error?.("deliverPendingAnnualWraps: year failed", { year, finalDate, msg });
    }
  }
  return out;
}

module.exports = {
  deliverAnnualWrapForShow,
  deliverAnnualWrapInAppOnGrade,
  deliverPendingAnnualWraps,
};

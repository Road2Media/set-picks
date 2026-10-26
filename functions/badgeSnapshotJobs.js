/**
 * Freeze tour and year rank snapshots and award badges once (#1115).
 *
 * A snapshot doc is written once. A later regrade does not rewrite it and
 * does not change `awardedAt`. `comms_tour_recap_state` is not a gate.
 *
 * Tour close: the finale date in `showDatesByTour` is graded, and every
 * other date on that tour has a rollup audit. The show just finalized
 * counts as graded.
 *
 * Year close: after 31 December UTC, once every calendar show in that year
 * has a rollup audit. Points rank is that year's graded picks only.
 */

"use strict";

const { tourDatesForKey } = require("./tourRankingsDailyCore");
const {
  awardsForTourPlayer,
  awardsForYearPlayer,
  buildTourRankSnapshot,
  buildYearRankSnapshot,
  calendarYearOfShowDate,
  showDatesInYear,
  tourSnapshotDocId,
  yearIsClosed,
} = require("./badgeRankSnapshots");

const TOUR_SNAPSHOTS = "tour_rank_snapshots";
const YEAR_SNAPSHOTS = "year_rank_snapshots";
const FIRESTORE_IN_LIMIT = 30;
const MAX_BATCH_OPS = 450;

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 * @returns {Promise<Set<string>>}
 */
async function gradedShowDates(db, dates) {
  /** @type {Set<string>} */
  const graded = new Set();
  const unique = [...new Set(dates.filter((d) => typeof d === "string" && d))];
  for (let i = 0; i < unique.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_LIMIT);
    const refs = chunk.map((date) => db.collection("rollup_audit").doc(date));
    if (refs.length === 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() || {};
      if (data.lastRolledUpAt != null) graded.add(snap.id);
    }
  }
  return graded;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 */
async function loadPicksByDate(db, dates) {
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byDate = new Map();
  for (const date of dates) byDate.set(date, []);
  const unique = [...byDate.keys()];
  for (let i = 0; i < unique.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_LIMIT);
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("picks").where("showDate", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const showDate = typeof data.showDate === "string" ? data.showDate : "";
      if (!byDate.has(showDate)) continue;
      byDate.get(showDate).push(data);
    }
  }
  return [...byDate.entries()].map(([date, picks]) => ({ date, picks }));
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 */
async function loadSetlistsByDate(db, dates) {
  /** @type {Record<string, Record<string, unknown>>} */
  const out = {};
  const unique = [...new Set(dates)];
  for (let i = 0; i < unique.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_LIMIT);
    const refs = chunk.map((date) => db.collection("official_setlists").doc(date));
    if (refs.length === 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const setlist =
        data.setlist && typeof data.setlist === "object" ? { ...data.setlist } : {};
      if (Array.isArray(data.bustouts)) setlist.bustouts = data.bustouts;
      if (Array.isArray(data.officialSetlist)) setlist.officialSetlist = data.officialSetlist;
      if (Array.isArray(data.encoreSongs)) setlist.encoreSongs = data.encoreSongs;
      out[snap.id] = setlist;
    }
  }
  return out;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {typeof import("firebase-admin")} admin
 * @param {Array<{ uid: string, awards: Array<{ id: string, scope: string, sourceThroughShow: string }> }>} plans
 */
async function writeBadgeAwards(db, admin, plans) {
  const pending = plans.filter((plan) => plan.awards.length > 0);
  if (pending.length === 0) return 0;

  let awardsWritten = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const refs = chunk.map((plan) => db.collection("users").doc(plan.uid));
    // eslint-disable-next-line no-await-in-loop
    const snaps = await db.getAll(...refs);
    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };
    for (let n = 0; n < snaps.length; n += 1) {
      const snap = snaps[n];
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const existing =
        data.badges && typeof data.badges === "object" && !Array.isArray(data.badges)
          ? data.badges
          : {};
      /** @type {Record<string, { awardedAt: unknown, scope: string, sourceThroughShow: string }>} */
      const patch = {};
      for (const award of chunk[n].awards) {
        const prior = existing[award.id];
        if (prior && typeof prior === "object") continue;
        patch[award.id] = {
          awardedAt: admin.firestore.FieldValue.serverTimestamp(),
          scope: award.scope,
          sourceThroughShow: award.sourceThroughShow,
        };
      }
      const ids = Object.keys(patch);
      if (ids.length === 0) continue;
      if (ops + 1 > MAX_BATCH_OPS) {
        // eslint-disable-next-line no-await-in-loop
        await flush();
      }
      batch.set(snap.ref, { badges: patch }, { merge: true });
      ops += 1;
      awardsWritten += ids.length;
    }
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
  return awardsWritten;
}

/**
 * @param {Array<Record<string, unknown>>} players
 * @param {Array<{ uid: string, data: Record<string, unknown> }>} users
 * @param {(player: Record<string, unknown>, badges: unknown) => Array<{ id: string, scope: string, sourceThroughShow: string }>} awardsFor
 */
function plansFromPlayers(players, users, awardsFor) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byUid = new Map(users.map((user) => [user.uid, user.data || {}]));
  return players
    .filter((player) => typeof player.uid === "string" && player.uid)
    .map((player) => {
      const data = byUid.get(String(player.uid)) || {};
      return {
        uid: String(player.uid),
        awards: awardsFor(player, data.badges),
      };
    });
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} uids
 */
async function loadUsers(db, uids) {
  /** @type {Array<{ uid: string, data: Record<string, unknown> }>} */
  const users = [];
  const unique = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const refs = chunk.map((uid) => db.collection("users").doc(uid));
    // eslint-disable-next-line no-await-in-loop
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      users.push({ uid: snap.id, data: snap.data() || {} });
    }
  }
  return users;
}

/**
 * @param {string[]} dates
 * @param {Set<string>} graded
 * @param {string | null | undefined} knownGradedDate
 */
function allDatesGraded(dates, graded, knownGradedDate) {
  if (!Array.isArray(dates) || dates.length === 0) return false;
  return dates.every((date) => graded.has(date) || date === knownGradedDate);
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   tourKey: string,
 *   showDatesByTour: unknown,
 *   knownGradedDate?: string | null,
 *   dryRun?: boolean,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function freezeTourRankSnapshot({
  db,
  admin,
  tourKey,
  showDatesByTour,
  knownGradedDate = null,
  dryRun = false,
  logger = undefined,
}) {
  const key = typeof tourKey === "string" ? tourKey.trim() : "";
  if (!key) return { status: "skip", awardsWritten: 0 };
  const dates = tourDatesForKey(showDatesByTour, key);
  if (dates.length === 0) return { status: "skip", awardsWritten: 0 };
  const finale = dates[dates.length - 1];
  const ref = db.collection(TOUR_SNAPSHOTS).doc(tourSnapshotDocId(key));
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() || {} : null;
  if (existingData && existingData.awardsAppliedAt != null) {
    return { status: "frozen", awardsWritten: 0 };
  }

  const graded = await gradedShowDates(db, dates);
  if (!allDatesGraded(dates, graded, knownGradedDate) || (!graded.has(finale) && finale !== knownGradedDate)) {
    return { status: "open", awardsWritten: 0 };
  }

  let snapshot = existingData;
  if (!snapshot) {
    const picksByDate = await loadPicksByDate(db, dates);
    const setlistsByDate = await loadSetlistsByDate(db, dates);
    snapshot = {
      ...buildTourRankSnapshot({
        tourKey: key,
        picksByDate,
        setlistsByDate,
        sourceThroughShow: finale,
      }),
      frozenAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!dryRun) await ref.create(snapshot);
  }

  const through =
    typeof snapshot.sourceThroughShow === "string" ? snapshot.sourceThroughShow : finale;
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const users = await loadUsers(
    db,
    players.map((player) => String(player.uid || ""))
  );
  const plans = plansFromPlayers(players, users, (player, badges) =>
    awardsForTourPlayer(player, badges, {
      tourKey: key,
      sourceThroughShow: through,
    })
  );
  const planned = plans.reduce((sum, plan) => sum + plan.awards.length, 0);
  if (dryRun) {
    return { status: "ready", awardsWritten: planned, players: players.length, tourKey: key };
  }
  const awardsWritten = await writeBadgeAwards(db, admin, plans);
  await ref.set(
    { awardsAppliedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  logger?.info?.("freezeTourRankSnapshot", {
    tourKey: key,
    players: players.length,
    awardsWritten,
  });
  return { status: "frozen", awardsWritten, tourKey: key };
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   year: string,
 *   showDatesByTour: unknown,
 *   knownGradedDate?: string | null,
 *   now?: Date,
 *   dryRun?: boolean,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function freezeYearRankSnapshot({
  db,
  admin,
  year,
  showDatesByTour,
  knownGradedDate = null,
  now = new Date(),
  dryRun = false,
  logger = undefined,
}) {
  if (!yearIsClosed(year, now)) return { status: "open", awardsWritten: 0 };
  const dates = showDatesInYear(showDatesByTour, year);
  if (dates.length === 0) return { status: "skip", awardsWritten: 0 };
  const finale = dates[dates.length - 1];
  const ref = db.collection(YEAR_SNAPSHOTS).doc(year);
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() || {} : null;
  if (existingData && existingData.awardsAppliedAt != null) {
    return { status: "frozen", awardsWritten: 0 };
  }
  const graded = await gradedShowDates(db, dates);
  if (!allDatesGraded(dates, graded, knownGradedDate)) {
    return { status: "open", awardsWritten: 0 };
  }

  let snapshot = existingData;
  if (!snapshot) {
    const picksByDate = await loadPicksByDate(db, dates);
    snapshot = {
      ...buildYearRankSnapshot({
        year,
        picksByDate,
        sourceThroughShow: finale,
      }),
      frozenAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!dryRun) await ref.create(snapshot);
  }

  const through =
    typeof snapshot.sourceThroughShow === "string" ? snapshot.sourceThroughShow : finale;
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const users = await loadUsers(
    db,
    players.map((player) => String(player.uid || ""))
  );
  const plans = plansFromPlayers(players, users, (player, badges) =>
    awardsForYearPlayer(player, badges, {
      year,
      sourceThroughShow: through,
    })
  );
  const planned = plans.reduce((sum, plan) => sum + plan.awards.length, 0);
  if (dryRun) {
    return { status: "ready", awardsWritten: planned, players: players.length, year };
  }
  const awardsWritten = await writeBadgeAwards(db, admin, plans);
  await ref.set(
    { awardsAppliedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  logger?.info?.("freezeYearRankSnapshot", { year, players: players.length, awardsWritten });
  return { status: "frozen", awardsWritten, year };
}

/**
 * @param {unknown} showDatesByTour
 * @returns {string[]}
 */
function tourKeysFromCalendar(showDatesByTour) {
  if (!Array.isArray(showDatesByTour)) return [];
  /** @type {string[]} */
  const keys = [];
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    if (tour) keys.push(tour);
  }
  return keys;
}

/**
 * @param {unknown} showDatesByTour
 * @returns {string[]}
 */
function yearsFromCalendar(showDatesByTour) {
  if (!Array.isArray(showDatesByTour)) return [];
  /** @type {Set<string>} */
  const years = new Set();
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const shows = /** @type {{ shows?: unknown }} */ (group).shows;
    if (!Array.isArray(shows)) continue;
    for (const show of shows) {
      if (!show || typeof show !== "object") continue;
      const year = calendarYearOfShowDate(
        /** @type {{ date?: unknown }} */ (show).date
      );
      if (year) years.add(year);
    }
  }
  return [...years].sort();
}

/**
 * After a rollup commits. Soft-fail friendly.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   showDate: string,
 *   showDatesByTour: unknown,
 *   tourKey: string | null,
 *   logger?: { info?: Function, warn?: Function },
 *   now?: Date,
 * }} params
 */
async function freezeRankSnapshotsAfterShow({
  db,
  admin,
  showDate,
  showDatesByTour,
  tourKey,
  logger = undefined,
  now = new Date(),
}) {
  if (tourKey) {
    await freezeTourRankSnapshot({
      db,
      admin,
      tourKey,
      showDatesByTour,
      knownGradedDate: showDate,
      logger,
    });
  }
  const year = calendarYearOfShowDate(showDate);
  if (year) {
    await freezeYearRankSnapshot({
      db,
      admin,
      year,
      showDatesByTour,
      knownGradedDate: showDate,
      now,
      logger,
    });
  }
}

/**
 * Daily close for every finished tour and calendar year that is not frozen yet.
 * Already-closed periods are included. That is the one-time backfill. Dry-run
 * writes nothing.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   logger?: { info?: Function, warn?: Function },
 *   now?: Date,
 *   dryRun?: boolean,
 * }} params
 */
async function freezeClosedRankSnapshots({
  db,
  admin,
  logger = undefined,
  now = new Date(),
  dryRun = false,
}) {
  const calendarSnap = await db.collection("show_calendar").doc("snapshot").get();
  const showDatesByTour = calendarSnap.exists
    ? (calendarSnap.data() || {}).showDatesByTour
    : null;

  /** @type {Array<Record<string, unknown>>} */
  const tours = [];
  /** @type {Array<Record<string, unknown>>} */
  const years = [];

  for (const tourKey of tourKeysFromCalendar(showDatesByTour)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await freezeTourRankSnapshot({
        db,
        admin,
        tourKey,
        showDatesByTour,
        dryRun,
        logger,
      });
      tours.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("freezeClosedRankSnapshots tour failed", { tourKey, msg });
      tours.push({ status: "error", tourKey, message: msg });
    }
  }

  for (const year of yearsFromCalendar(showDatesByTour)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await freezeYearRankSnapshot({
        db,
        admin,
        year,
        showDatesByTour,
        now,
        dryRun,
        logger,
      });
      years.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("freezeClosedRankSnapshots year failed", { year, msg });
      years.push({ status: "error", year, message: msg });
    }
  }

  return { dryRun, tours, years };
}

module.exports = {
  TOUR_SNAPSHOTS,
  YEAR_SNAPSHOTS,
  freezeClosedRankSnapshots,
  freezeRankSnapshotsAfterShow,
  freezeTourRankSnapshot,
  freezeYearRankSnapshot,
  gradedShowDates,
};

/**
 * Rewind Mode (#1142) — one admin-chosen historical show per week.
 *
 * Writes stay on rewind_* collections. Live `picks`, `users` career totals,
 * and `official_setlists` are never updated here, so show/tour/year boards
 * cannot pick up a Rewind score.
 *
 * The public week doc is an allowlist (counts and labels only). The scoring
 * payload, including the ordered song list, lives on `rewind_answers`, which
 * clients cannot read. A lock callable returns the six slot results to that
 * player. It does not return the full song list.
 *
 * Phish.net: at most the current open week's show, and only when the cache
 * is older than 24 hours (or an admin forces one refresh). No archive crawl.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { resolveAdminCallerRole } = require("./adminAuth");
const {
  buildSetlistDocFromRows,
  fetchPhishnetSetlistForDate,
  normalizeSetlistRows,
} = require("./phishnetLiveSetlistAutomation");
const {
  SCORE_FIELDS,
  calculateSlotScore,
  calculateTotalScore,
  countCorrectSlots,
  guessMatchesEncoreExact,
  normalizeSong,
} = require("./scoringCore");

const REWIND_WEEKS = "rewind_weeks";
const REWIND_ANSWERS = "rewind_answers";
const REWIND_PICKS = "rewind_picks";
const REWIND_STATE = "rewind_state";
const REWIND_CURRENT_ID = "current";

/** Collections a Rewind write must never target. */
const LIVE_LEADERBOARD_COLLECTIONS = Object.freeze([
  "picks",
  "users",
  "official_setlists",
  "rollup_audit",
  "global_stats_leaderboards",
]);

const ANSWER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const ATTRIBUTION = "Setlist data courtesy of Phish.net.";

const SLOT_LABELS = Object.freeze({
  s1o: "Set 1 Opener",
  s1c: "Set 1 Closer",
  s2o: "Set 2 Opener",
  s2c: "Set 2 Closer",
  enc: "Encore",
  wild: "Wildcard",
});

const PUBLIC_WEEK_FIELDS = Object.freeze([
  "weekId",
  "showDate",
  "title",
  "venue",
  "status",
  "opensAt",
  "closesAt",
  "phishNetUrl",
  "playerCount",
  "scoreSum",
  "averageScore",
  "correctSlotCounts",
  "answerCachedAt",
  "updatedAt",
  "attribution",
  "schemaVersion",
]);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function assertRewindAdmin(request) {
  if (!request?.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  if (!resolveAdminCallerRole(request.auth)) {
    throw new HttpsError(
      "permission-denied",
      "Only an admin can perform this action."
    );
  }
}

function assertRewindPlayer(request) {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return uid;
}

function assertYmd(value, label) {
  const v = String(value ?? "").trim();
  if (!YMD.test(v)) {
    throw new HttpsError("invalid-argument", `${label} must be YYYY-MM-DD.`);
  }
  return v;
}

function assertShortText(value, label, max) {
  const v = String(value ?? "").trim();
  if (!v || v.length > max) {
    throw new HttpsError(
      "invalid-argument",
      `${label} must be 1–${max} characters.`
    );
  }
  return v;
}

function addUtcDays(ymd, days) {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function emptySlotCounts() {
  /** @type {Record<string, number>} */
  const out = {};
  for (const id of SCORE_FIELDS) out[id] = 0;
  return out;
}

function normalizeSlotCounts(raw) {
  const out = emptySlotCounts();
  if (!raw || typeof raw !== "object") return out;
  for (const id of SCORE_FIELDS) {
    const n = Number(raw[id]);
    out[id] = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  return out;
}

/**
 * Public week shape. Drops setlist songs even if a caller tried to pass them.
 *
 * @param {Record<string, unknown>} raw
 */
function toPublicRewindWeek(raw) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of PUBLIC_WEEK_FIELDS) {
    if (raw[key] !== undefined && raw[key] !== null) out[key] = raw[key];
  }
  out.playerCount = Math.max(0, Math.trunc(Number(out.playerCount) || 0));
  out.scoreSum = Number(out.scoreSum) || 0;
  out.averageScore = Number(out.averageScore) || 0;
  out.correctSlotCounts = normalizeSlotCounts(out.correctSlotCounts);
  out.attribution = ATTRIBUTION;
  out.schemaVersion = 1;
  return out;
}

function phishNetUrl(showDate) {
  return `https://phish.net/setlists/?d=${encodeURIComponent(showDate)}`;
}

function scoringPayloadFromAnswer(answer) {
  const slots =
    answer && answer.setlist && typeof answer.setlist === "object"
      ? answer.setlist
      : {};
  return {
    s1o: slots.s1o || "",
    s1c: slots.s1c || "",
    s2o: slots.s2o || "",
    s2c: slots.s2c || "",
    enc: slots.enc || "",
    officialSetlist: Array.isArray(answer?.officialSetlist)
      ? answer.officialSetlist
      : [],
    encoreSongs: Array.isArray(answer?.encoreSongs) ? answer.encoreSongs : [],
    bustouts: Array.isArray(answer?.bustouts) ? answer.bustouts : [],
  };
}

function normalizePicks(raw) {
  if (!raw || typeof raw !== "object") {
    throw new HttpsError("invalid-argument", "Pick all six slots before locking.");
  }
  /** @type {Record<string, string>} */
  const picks = {};
  for (const id of SCORE_FIELDS) {
    const value = String(raw[id] ?? "").trim();
    if (!value || value.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "Pick all six slots before locking."
      );
    }
    picks[id] = value;
  }
  return picks;
}

function describeSlot(fieldId, guess, actual) {
  const points = calculateSlotScore(fieldId, guess, actual);
  const withoutBoost = calculateSlotScore(fieldId, guess, {
    ...actual,
    bustouts: [],
  });
  const bustoutBoost = points > withoutBoost && withoutBoost > 0;
  let kind = "miss";
  if (!String(guess ?? "").trim()) kind = "none";
  else if (withoutBoost <= 0) kind = "miss";
  else if (fieldId === "wild") kind = "wildcard_hit";
  else if (
    fieldId === "enc" &&
    guessMatchesEncoreExact(actual, normalizeSong(guess))
  ) {
    kind = "encore_exact";
  } else if (normalizeSong(actual[fieldId]) === normalizeSong(guess)) {
    kind = "exact_slot";
  } else kind = "in_setlist";

  const slotActual =
    fieldId === "wild"
      ? ""
      : typeof actual[fieldId] === "string"
        ? actual[fieldId]
        : "";

  return {
    id: fieldId,
    label: SLOT_LABELS[fieldId] || fieldId,
    guess: String(guess ?? "").trim(),
    actual: slotActual,
    points,
    kind,
    bustoutBoost,
  };
}

/**
 * Player-facing result. Six slots only — no ordered song list.
 */
function buildRewindReveal(week, pick, answer) {
  const actual = scoringPayloadFromAnswer(answer);
  const guesses = pick?.picks || {};
  const slots = SCORE_FIELDS.map((id) => describeSlot(id, guesses[id], actual));
  const score = calculateTotalScore(guesses, actual);
  const correctSlots = countCorrectSlots(guesses, actual);
  return {
    weekId: week.weekId,
    showDate: week.showDate,
    title: week.title || "",
    venue: week.venue || "",
    score,
    correctSlots,
    phishNetUrl: week.phishNetUrl || phishNetUrl(week.showDate),
    attribution: ATTRIBUTION,
    slots,
  };
}

function assertWeekOpen(week, now) {
  if (!week || week.status !== "open") {
    throw new HttpsError("failed-precondition", "This rewind week is closed.");
  }
  const t = now.getTime();
  const opens = Date.parse(String(week.opensAt || ""));
  const closes = Date.parse(String(week.closesAt || ""));
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || t < opens || t >= closes) {
    throw new HttpsError("failed-precondition", "This rewind week is not open.");
  }
}

async function lookupHandle(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  const handle =
    snap.exists && snap.data() && typeof snap.data().handle === "string"
      ? snap.data().handle.trim()
      : "";
  return handle.slice(0, 40) || "Fan";
}

async function rescoreRewindWeek({ db, weekId, answer, now }) {
  const actual = scoringPayloadFromAnswer(answer);
  const snap = await db.collection(REWIND_PICKS).where("weekId", "==", weekId).get();
  const counts = emptySlotCounts();
  let playerCount = 0;
  let scoreSum = 0;
  for (const row of snap.docs) {
    const data = row.data() || {};
    const picks = data.picks || {};
    const score = calculateTotalScore(picks, actual);
    const correctSlots = countCorrectSlots(picks, actual);
    for (const id of SCORE_FIELDS) {
      if (calculateSlotScore(id, picks[id], actual) > 0) counts[id] += 1;
    }
    playerCount += 1;
    scoreSum += score;
    await row.ref.set(
      {
        score,
        correctSlots,
        rescoredAt: now.toISOString(),
      },
      { merge: true }
    );
  }
  return {
    playerCount,
    scoreSum,
    averageScore: playerCount ? scoreSum / playerCount : 0,
    correctSlotCounts: counts,
  };
}

async function saveRewindWeek({ db, input, now = new Date() }) {
  const body = input && typeof input === "object" ? input : {};
  const weekId = assertYmd(body.weekId, "weekId");
  const showDate = assertYmd(body.showDate, "showDate");
  const today = now.toISOString().slice(0, 10);
  if (showDate >= today) {
    throw new HttpsError(
      "invalid-argument",
      "Rewind shows must already have been played."
    );
  }
  const closesOn = assertYmd(body.closesOn || weekId, "closesOn");
  if (closesOn < weekId) {
    throw new HttpsError(
      "invalid-argument",
      "closesOn must be on or after the week open date."
    );
  }
  const title = assertShortText(body.title, "title", 80);
  const venue = assertShortText(body.venue, "venue", 80);
  const status = body.status === "closed" ? "closed" : "open";

  const weekRef = db.collection(REWIND_WEEKS).doc(weekId);
  const prevSnap = await weekRef.get();
  const prev = prevSnap.exists ? prevSnap.data() || {} : null;
  if (
    prev &&
    prev.showDate &&
    prev.showDate !== showDate &&
    Number(prev.playerCount) > 0
  ) {
    throw new HttpsError(
      "failed-precondition",
      "This week already has locks. Close it instead of changing the show."
    );
  }
  const showChanged = Boolean(prev && prev.showDate && prev.showDate !== showDate);

  const doc = toPublicRewindWeek({
    weekId,
    showDate,
    title,
    venue,
    status,
    opensAt: `${weekId}T00:00:00.000Z`,
    closesAt: `${addUtcDays(closesOn, 1)}T00:00:00.000Z`,
    phishNetUrl: phishNetUrl(showDate),
    playerCount: showChanged ? 0 : prev?.playerCount || 0,
    scoreSum: showChanged ? 0 : prev?.scoreSum || 0,
    averageScore: showChanged ? 0 : prev?.averageScore || 0,
    correctSlotCounts: showChanged
      ? emptySlotCounts()
      : prev?.correctSlotCounts || emptySlotCounts(),
    answerCachedAt: showChanged ? undefined : prev?.answerCachedAt,
    updatedAt: now.toISOString(),
    setlist: body.setlist,
    officialSetlist: body.officialSetlist,
    bustouts: body.bustouts,
  });

  await weekRef.set(doc);
  if (showChanged) {
    await db.collection(REWIND_ANSWERS).doc(weekId).delete();
  }
  if (status === "open") {
    await db.collection(REWIND_STATE).doc(REWIND_CURRENT_ID).set({
      weekId,
      updatedAt: now.toISOString(),
    });
  }
  return { ok: true, week: doc };
}

async function refreshRewindAnswer({
  db,
  weekId,
  apiKey,
  now = new Date(),
  force = false,
  fetchSetlist = fetchPhishnetSetlistForDate,
}) {
  const id = assertYmd(weekId, "weekId");
  const weekRef = db.collection(REWIND_WEEKS).doc(id);
  const weekSnap = await weekRef.get();
  if (!weekSnap.exists) {
    throw new HttpsError("not-found", "No rewind week for that date.");
  }
  const week = weekSnap.data() || {};
  const cachedAt = Date.parse(String(week.answerCachedAt || ""));
  const age = Number.isFinite(cachedAt) ? now.getTime() - cachedAt : Infinity;
  if (!force && age < ANSWER_MAX_AGE_MS) {
    return {
      ok: true,
      skipped: true,
      weekId: id,
      showDate: week.showDate,
      songCount: 0,
      playersRescored: Number(week.playerCount) || 0,
    };
  }
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new HttpsError(
      "failed-precondition",
      "Phish.net API key is not configured (set secret PHISHNET_API_KEY)."
    );
  }

  const payload = await fetchSetlist(week.showDate, key);
  const rows = normalizeSetlistRows(payload);
  if (!rows.length) {
    throw new HttpsError(
      "failed-precondition",
      "Phish.net returned no songs for that show."
    );
  }
  const built = buildSetlistDocFromRows(rows, {}, {
    nowMs: now.getTime(),
    firstRowObservedAtMs: 0,
    lastSet1ChangeAtMs: 0,
  });
  const answer = {
    weekId: id,
    showDate: week.showDate,
    setlist: built.setlist,
    officialSetlist: built.officialSetlist,
    encoreSongs: built.encoreSongs,
    bustouts: built.bustouts,
    cachedAt: now.toISOString(),
  };
  await db.collection(REWIND_ANSWERS).doc(id).set(answer);
  const totals = await rescoreRewindWeek({ db, weekId: id, answer, now });
  await weekRef.set(
    {
      answerCachedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...totals,
    },
    { merge: true }
  );
  return {
    ok: true,
    skipped: false,
    weekId: id,
    showDate: week.showDate,
    songCount: built.officialSetlist.length,
    playersRescored: totals.playerCount,
  };
}

async function runScheduledRewindAnswerRefresh({
  db,
  apiKey,
  now = new Date(),
  fetchSetlist = fetchPhishnetSetlistForDate,
}) {
  const currentSnap = await db.collection(REWIND_STATE).doc(REWIND_CURRENT_ID).get();
  if (!currentSnap.exists) {
    return { ok: true, fetched: false, reason: "no-current" };
  }
  const weekId = String(currentSnap.data()?.weekId || "").trim();
  if (!YMD.test(weekId)) {
    return { ok: true, fetched: false, reason: "bad-pointer" };
  }
  const weekSnap = await db.collection(REWIND_WEEKS).doc(weekId).get();
  if (!weekSnap.exists) {
    return { ok: true, fetched: false, reason: "missing-week" };
  }
  if (weekSnap.data()?.status !== "open") {
    return { ok: true, fetched: false, reason: "closed" };
  }
  const result = await refreshRewindAnswer({
    db,
    weekId,
    apiKey,
    now,
    force: false,
    fetchSetlist,
  });
  return {
    ok: true,
    fetched: result.skipped !== true,
    reason: result.skipped ? "fresh" : "refreshed",
    weekId,
    showDate: result.showDate,
  };
}

async function loadAnswerForWeek(db, week) {
  const snap = await db.collection(REWIND_ANSWERS).doc(week.weekId).get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "This week's setlist isn't cached yet."
    );
  }
  const answer = snap.data() || {};
  if (answer.showDate && answer.showDate !== week.showDate) {
    throw new HttpsError(
      "failed-precondition",
      "Setlist cache is for a different show. Refresh it."
    );
  }
  return answer;
}

async function lockRewindPick({ db, uid, input, now = new Date() }) {
  const body = input && typeof input === "object" ? input : {};
  const weekId = assertYmd(body.weekId, "weekId");
  const weekSnap = await db.collection(REWIND_WEEKS).doc(weekId).get();
  if (!weekSnap.exists) {
    throw new HttpsError("not-found", "No rewind week for that date.");
  }
  const week = weekSnap.data() || {};
  assertWeekOpen(week, now);
  const answer = await loadAnswerForWeek(db, week);
  const pickRef = db.collection(REWIND_PICKS).doc(`${weekId}_${uid}`);
  const existing = await pickRef.get();
  if (existing.exists) {
    return {
      ok: true,
      alreadyLocked: true,
      reveal: buildRewindReveal(week, existing.data(), answer),
    };
  }

  const picks = normalizePicks(body.picks);
  const actual = scoringPayloadFromAnswer(answer);
  const score = calculateTotalScore(picks, actual);
  const correctSlots = countCorrectSlots(picks, actual);
  const handle = await lookupHandle(db, uid);
  const pickDoc = {
    userId: uid,
    weekId,
    showDate: week.showDate,
    handle,
    picks,
    score,
    correctSlots,
    lockedAt: now.toISOString(),
  };

  await db.runTransaction(async (tx) => {
    const again = await tx.get(pickRef);
    if (again.exists) return;
    const weekNowSnap = await tx.get(db.collection(REWIND_WEEKS).doc(weekId));
    const base = weekNowSnap.exists ? weekNowSnap.data() || {} : {};
    const counts = normalizeSlotCounts(base.correctSlotCounts);
    for (const id of SCORE_FIELDS) {
      if (calculateSlotScore(id, picks[id], actual) > 0) counts[id] += 1;
    }
    const playerCount = Math.max(0, Math.trunc(Number(base.playerCount) || 0)) + 1;
    const scoreSum = (Number(base.scoreSum) || 0) + score;
    tx.set(pickRef, pickDoc);
    tx.set(
      db.collection(REWIND_WEEKS).doc(weekId),
      {
        playerCount,
        scoreSum,
        averageScore: scoreSum / playerCount,
        correctSlotCounts: counts,
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );
  });

  const written = await pickRef.get();
  return {
    ok: true,
    alreadyLocked: false,
    reveal: buildRewindReveal(week, written.exists ? written.data() : pickDoc, answer),
  };
}

async function readRewindReveal({ db, uid, input }) {
  const body = input && typeof input === "object" ? input : {};
  const weekId = assertYmd(body.weekId, "weekId");
  const weekSnap = await db.collection(REWIND_WEEKS).doc(weekId).get();
  if (!weekSnap.exists) {
    throw new HttpsError("not-found", "No rewind week for that date.");
  }
  const week = weekSnap.data() || {};
  const pickSnap = await db.collection(REWIND_PICKS).doc(`${weekId}_${uid}`).get();
  if (!pickSnap.exists) {
    throw new HttpsError("failed-precondition", "Lock a card before the reveal.");
  }
  const answer = await loadAnswerForWeek(db, week);
  return {
    ok: true,
    reveal: buildRewindReveal(week, pickSnap.data(), answer),
  };
}

module.exports = {
  ANSWER_MAX_AGE_MS,
  ATTRIBUTION,
  LIVE_LEADERBOARD_COLLECTIONS,
  PUBLIC_WEEK_FIELDS,
  REWIND_ANSWERS,
  REWIND_CURRENT_ID,
  REWIND_PICKS,
  REWIND_STATE,
  REWIND_WEEKS,
  SCORE_FIELDS,
  assertRewindAdmin,
  assertRewindPlayer,
  buildRewindReveal,
  lockRewindPick,
  readRewindReveal,
  refreshRewindAnswer,
  runScheduledRewindAnswerRefresh,
  saveRewindWeek,
  toPublicRewindWeek,
};

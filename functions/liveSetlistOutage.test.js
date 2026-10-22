"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  LIVE_WINDOW_BACKOFF_CAP_MAX_MINUTES,
  LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES,
  OFF_WINDOW_BACKOFF_CAP_MINUTES,
  OUTAGE_ESCALATION_MS,
  PLAYER_STATUS_MESSAGES,
  applyLiveSetlistServiceStatusCommand,
  buildOpsAlertContent,
  deliverLiveSetlistOpsAlert,
  nextBackoffDelayMs,
  parseOpsAlertEmails,
  planPublicStatusOnFailure,
  planPublicStatusOnSuccess,
  planUpstreamFailure,
  planUpstreamSuccess,
  publicServiceStatusDocId,
  sanitizeUpstreamError,
  syncLiveSetlistPublicStatus,
} = require("./liveSetlistOutage");
const {
  normalizeSetlistRows,
  pollSingleShowDate,
  signatureFromRows,
} = require("./phishnetLiveSetlistAutomation");

const SHOW = "2026-07-17";

function timestamp(ms) {
  return { _millis: ms, toMillis: () => ms };
}

function adminStub() {
  return {
    firestore: {
      Timestamp: {
        fromMillis: (ms) => timestamp(ms),
        fromDate: (date) => timestamp(date.getTime()),
      },
      FieldValue: {
        serverTimestamp: () => ({ _sentinel: "serverTimestamp" }),
        delete: () => ({ _sentinel: "delete" }),
      },
    },
  };
}

function applyWrite(prev, value, merge) {
  const next = merge ? { ...prev } : {};
  for (const [field, fieldValue] of Object.entries(value || {})) {
    if (fieldValue && fieldValue._sentinel === "delete") delete next[field];
    else next[field] = fieldValue;
  }
  return next;
}

function memoryDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  function makeRef(docPath) {
    return {
      path: docPath,
      async get() {
        const data = docs.get(docPath);
        return {
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined),
        };
      },
      async set(value, opts) {
        const merge = Boolean(opts?.merge);
        docs.set(docPath, applyWrite(docs.get(docPath) || {}, value, merge));
      },
      collection(name) {
        return {
          doc: (id) => makeRef(`${docPath}/${name}/${id}`),
        };
      },
    };
  }
  return {
    docs,
    collection(name) {
      return { doc: (id) => makeRef(`${name}/${id}`) };
    },
    batch() {
      const ops = [];
      return {
        set(ref, value, opts) {
          ops.push(() => ref.set(value, opts));
        },
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
  };
}

function silentLogger() {
  return { info() {}, warn() {}, error() {} };
}

async function poll(harness, overrides = {}) {
  return pollSingleShowDate({
    db: harness.db,
    admin: harness.admin,
    showDate: SHOW,
    apiKey: "test-key",
    logger: silentLogger(),
    inLiveWindow: true,
    ...overrides,
  });
}

test("sanitizeUpstreamError keeps status and strips HTML and secrets", () => {
  const raw =
    'HTTP 403: <html><title>Phish.net Security</title><body>apikey=SUPERSECRET</body></html>';
  const clean = sanitizeUpstreamError(raw);
  assert.match(clean, /HTTP 403/);
  assert.match(clean, /Phish.net Security/);
  assert.equal(clean.includes("SUPERSECRET"), false);
  assert.equal(clean.includes("<"), false);
  assert.ok(clean.length <= 240);
});

test("nextBackoffDelayMs caps live window at 3-5 minutes and off-window at 30", () => {
  assert.equal(
    nextBackoffDelayMs({ failureCount: 1, inLiveWindow: true, rng: () => 0 }),
    60_000
  );
  assert.equal(
    nextBackoffDelayMs({ failureCount: 6, inLiveWindow: true, rng: () => 0 }),
    LIVE_WINDOW_BACKOFF_CAP_MIN_MINUTES * 60_000
  );
  assert.equal(
    nextBackoffDelayMs({ failureCount: 6, inLiveWindow: true, rng: () => 0.999 }),
    LIVE_WINDOW_BACKOFF_CAP_MAX_MINUTES * 60_000
  );
  assert.equal(
    nextBackoffDelayMs({ failureCount: 8, inLiveWindow: false, rng: () => 0 }),
    OFF_WINDOW_BACKOFF_CAP_MINUTES * 60_000
  );
});

test("planUpstreamFailure alerts once at 3 live failures and escalates after 30 minutes", () => {
  const quiet = planUpstreamFailure({
    automation: {},
    failureCount: 2,
    inLiveWindow: true,
    nowMs: 1_000,
    showDate: SHOW,
  });
  assert.equal(quiet.sendInitial, false);
  assert.equal(quiet.publishDegraded, false);

  const offWindow = planUpstreamFailure({
    automation: {},
    failureCount: 4,
    inLiveWindow: false,
    nowMs: 1_000,
    showDate: SHOW,
  });
  assert.equal(offWindow.sendInitial, false);
  assert.equal(offWindow.publishDegraded, false);

  const first = planUpstreamFailure({
    automation: { outageStartedAt: timestamp(1_000) },
    failureCount: 3,
    inLiveWindow: true,
    nowMs: 5_000,
    showDate: SHOW,
  });
  assert.equal(first.sendInitial, true);
  assert.equal(first.sendEscalation, false);

  const again = planUpstreamFailure({
    automation: { outageStartedAt: timestamp(1_000), outageAlertedAt: timestamp(5_000) },
    failureCount: 4,
    inLiveWindow: true,
    nowMs: 6_000,
    showDate: SHOW,
  });
  assert.equal(again.sendInitial, false);
  assert.equal(again.sendEscalation, false);

  const late = planUpstreamFailure({
    automation: { outageStartedAt: timestamp(1_000), outageAlertedAt: timestamp(5_000) },
    failureCount: 6,
    inLiveWindow: true,
    nowMs: 1_000 + OUTAGE_ESCALATION_MS,
    showDate: SHOW,
  });
  assert.equal(late.sendEscalation, true);
  assert.equal(late.sendInitial, false);
});

test("planUpstreamSuccess requests one recovery and clears an unalerted outage", () => {
  const recovered = planUpstreamSuccess({
    automation: {
      outageAlertedAt: timestamp(1),
      outageStartedAt: timestamp(1),
      lastError: "HTTP 403: blocked",
      failureCount: 4,
    },
    showDate: SHOW,
  });
  assert.equal(recovered.sendRecovery, true);
  const second = planUpstreamSuccess({
    automation: {
      outageAlertedAt: timestamp(1),
      recoveryAlertedAt: timestamp(2),
      outageStartedAt: timestamp(1),
    },
    showDate: SHOW,
  });
  assert.equal(second.sendRecovery, false);
  const unalerted = planUpstreamSuccess({
    automation: { outageStartedAt: timestamp(1), failureCount: 1 },
    showDate: SHOW,
  });
  assert.equal(unalerted.sendRecovery, false);
  assert.equal(unalerted.clearUnalertedOutage, true);
});

test("public status plans publish once and clear only automatic or opted-in banners", () => {
  assert.equal(planPublicStatusOnFailure(null).action, "degrade");
  assert.equal(
    planPublicStatusOnFailure({ status: "degraded", activatedBy: "automation" }).action,
    "keep"
  );
  assert.equal(
    planPublicStatusOnFailure({ status: "degraded", activatedBy: "admin" }).action,
    "keep"
  );
  assert.equal(planPublicStatusOnSuccess(null).action, "keep");
  assert.equal(
    planPublicStatusOnSuccess({ status: "degraded", activatedBy: "automation" }).action,
    "resolve"
  );
  assert.equal(
    planPublicStatusOnSuccess({
      status: "degraded",
      activatedBy: "admin",
      clearOnRecovery: false,
    }).action,
    "keep"
  );
  assert.equal(
    planPublicStatusOnSuccess({
      status: "degraded",
      activatedBy: "admin",
      clearOnRecovery: true,
    }).action,
    "resolve"
  );
});

test("player copy matches the standings client", () => {
  const src = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "features",
      "scoring",
      "model",
      "liveSetlistServiceStatus.js"
    ),
    "utf8"
  );
  assert.match(src, new RegExp(PLAYER_STATUS_MESSAGES.phishnet_stalled.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("buildOpsAlertContent does not echo raw HTML", () => {
  const content = buildOpsAlertContent({
    kind: "outage",
    showDate: SHOW,
    sanitizedError: sanitizeUpstreamError("<html>apikey=SECRET</html>"),
    failureCount: 3,
    firstFailureAt: "t0",
    lastFailureAt: "t1",
    nextPollAt: "t2",
  });
  assert.equal(content.text.includes("SECRET"), false);
  assert.equal(content.text.includes("<html>"), false);
  assert.match(content.text, /War Room manual save \/ Force poll/);
});

test("parseOpsAlertEmails ignores blanks and non-addresses", () => {
  assert.deepEqual(
    parseOpsAlertEmails({
      LIVE_SETLIST_OPS_ALERT_EMAILS: " ops@example.com, nope, second@example.com ",
    }),
    ["ops@example.com", "second@example.com"]
  );
});

test("deliverLiveSetlistOpsAlert writes one inbox and one email, then dedups", async () => {
  const db = memoryDb({
    "users/admin-1": { email: "ops@example.com" },
  });
  const admin = adminStub();
  const sent = [];
  const resendClient = {
    emails: {
      send: async (payload) => {
        sent.push(payload);
        return { data: { id: "re_1" } };
      },
    },
  };
  const event = {
    kind: "outage",
    showDate: SHOW,
    messageId: "live_setlist_polling_2026-07-17_1_outage",
    sanitizedError: "HTTP 403: Phish.net Security",
    failureCount: 3,
    firstFailureAt: "t0",
    lastFailureAt: "t1",
    nextPollAt: "t2",
  };
  const first = await deliverLiveSetlistOpsAlert({
    db,
    admin,
    logger: silentLogger(),
    resendClient,
    superAdminUids: ["admin-1"],
    extraEmails: [],
    event,
  });
  const second = await deliverLiveSetlistOpsAlert({
    db,
    admin,
    logger: silentLogger(),
    resendClient,
    superAdminUids: ["admin-1"],
    extraEmails: ["ops@example.com"],
    event,
  });
  assert.equal(first.inboxWrites, 1);
  assert.equal(first.emailsSent, 1);
  assert.equal(second.skipped, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to[0], "ops@example.com");
  assert.equal(sent[0].text.includes("<html>"), false);
  const inbox = db.docs.get(
    `users/admin-1/commsInbox/${event.messageId}`
  );
  assert.equal(inbox.templateId, "live-setlist-ops");
  assert.equal(inbox.payload.showDate, SHOW);
});

test("manual service status publish and clear", async () => {
  const db = memoryDb();
  const admin = adminStub();
  const published = await applyLiveSetlistServiceStatusCommand({
    db,
    admin,
    showDate: SHOW,
    action: "publish",
    messageKey: "phishnet_stalled",
    clearOnRecovery: false,
  });
  assert.equal(published.status, "degraded");
  const doc = db.docs.get(`public_service_status/${publicServiceStatusDocId(SHOW)}`);
  assert.equal(doc.activatedBy, "admin");
  assert.equal(doc.clearOnRecovery, false);
  assert.equal(doc.message, PLAYER_STATUS_MESSAGES.phishnet_stalled);
  assert.equal("lastError" in doc, false);

  await syncLiveSetlistPublicStatus({
    db,
    admin,
    logger: silentLogger(),
    showDate: SHOW,
    phase: "success",
  });
  assert.equal(
    db.docs.get(`public_service_status/${publicServiceStatusDocId(SHOW)}`).status,
    "degraded"
  );

  const cleared = await applyLiveSetlistServiceStatusCommand({
    db,
    admin,
    showDate: SHOW,
    action: "clear",
  });
  assert.equal(cleared.status, "operational");
  await assert.rejects(
    () =>
      applyLiveSetlistServiceStatusCommand({
        db,
        admin,
        showDate: SHOW,
        action: "publish",
        messageKey: "freeform",
      }),
    /unknown messageKey/
  );
});

test("poll: three live failures alert once and publish one degraded status", async () => {
  const harness = {
    db: memoryDb({
      [`live_setlist_automation/${SHOW}`]: {
        showDate: SHOW,
        enabled: true,
        failureCount: 2,
        outageStartedAt: timestamp(1_000),
      },
    }),
    admin: adminStub(),
  };
  const alerts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async text() {
      return "<html><title>Phish.net Security</title>apikey=SECRET</html>";
    },
  });
  try {
    const first = await poll(harness, {
      deliverOpsAlert: async (event) => {
        alerts.push(event);
      },
      rng: () => 0,
    });
    assert.equal(first.failureCount, 3);
    assert.equal(first.backoffMinutes <= 5, true);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].kind, "outage");
    assert.equal(alerts[0].sanitizedError.includes("SECRET"), false);
    assert.match(alerts[0].sanitizedError, /HTTP 403/);
    const automation = harness.db.docs.get(`live_setlist_automation/${SHOW}`);
    assert.equal(automation.failureCount, 3);
    assert.ok(automation.outageAlertedAt);
    const status = harness.db.docs.get(
      `public_service_status/${publicServiceStatusDocId(SHOW)}`
    );
    assert.equal(status.status, "degraded");
    assert.equal(status.activatedBy, "automation");
    assert.equal(status.clearOnRecovery, true);
    assert.equal("lastError" in status, false);

    const skipped = await poll(harness, {
      deliverOpsAlert: async (event) => {
        alerts.push(event);
      },
    });
    assert.equal(skipped.skipped, "backoff");
    assert.equal(alerts.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("poll: off-window failure keeps the 30 minute cap and does not alert", async () => {
  const now = 1_700_000_000_000;
  const originalNow = Date.now;
  Date.now = () => now;
  const harness = {
    db: memoryDb({
      [`live_setlist_automation/${SHOW}`]: {
        showDate: SHOW,
        enabled: true,
        failureCount: 5,
      },
    }),
    admin: adminStub(),
  };
  const alerts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async text() {
      return "nope";
    },
  });
  try {
    const result = await poll(harness, {
      inLiveWindow: false,
      deliverOpsAlert: async (event) => {
        alerts.push(event);
      },
    });
    assert.equal(result.failureCount, 6);
    assert.equal(result.backoffMinutes, 30);
    assert.equal(alerts.length, 0);
    assert.equal(
      harness.db.docs.get(`public_service_status/${publicServiceStatusDocId(SHOW)}`),
      undefined
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("poll: forced success clears stale nextPollAt for no-rows, no-change, and changed", async () => {
  const now = 1_700_000_000_000;
  const originalNow = Date.now;
  Date.now = () => now;
  const stale = timestamp(now + 30 * 60_000);
  const rows = [
    { set: "1", position: 1, song: "AC/DC Bag" },
    { set: "2", position: 1, song: "Tweezer" },
  ];
  const originalFetch = globalThis.fetch;

  try {
    const noRows = {
      db: memoryDb({
        [`live_setlist_automation/${SHOW}`]: {
          showDate: SHOW,
          enabled: true,
          failureCount: 4,
          lastError: "HTTP 403: old",
          lastErrorAt: timestamp(now - 60_000),
          nextPollAt: stale,
          outageStartedAt: timestamp(now - 10 * 60_000),
          outageAlertedAt: timestamp(now - 8 * 60_000),
        },
        [`public_service_status/${publicServiceStatusDocId(SHOW)}`]: {
          service: "live_setlist",
          showDate: SHOW,
          status: "degraded",
          activatedBy: "automation",
          clearOnRecovery: true,
          messageKey: "phishnet_stalled",
        },
      }),
      admin: adminStub(),
    };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ data: [] });
      },
    });
    const empty = await poll(noRows, { force: true, rng: () => 0 });
    assert.equal(empty.reason, "no-rows");
    assert.equal(empty.opsRecovery.kind, "recovery");
    assert.equal(empty.opsRecovery.changed, false);
    const emptyDoc = noRows.db.docs.get(`live_setlist_automation/${SHOW}`);
    assert.equal(emptyDoc.failureCount, 0);
    assert.equal(emptyDoc.lastError, undefined);
    assert.equal(emptyDoc.previousError.includes("HTTP 403"), true);
    assert.equal(emptyDoc.lastSuccessfulPollMode, "force");
    const delay = emptyDoc.nextPollAt.toMillis() - now;
    assert.ok(delay >= 90_000 && delay <= 150_000, `delay ${delay}`);
    assert.equal(
      noRows.db.docs.get(`public_service_status/${publicServiceStatusDocId(SHOW)}`).status,
      "operational"
    );

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ data: rows });
      },
    });
    const changedHarness = {
      db: memoryDb({
        [`live_setlist_automation/${SHOW}`]: {
          showDate: SHOW,
          enabled: true,
          failureCount: 3,
          lastError: "HTTP 403: old",
          nextPollAt: stale,
          outageStartedAt: timestamp(now - 5 * 60_000),
          outageAlertedAt: timestamp(now - 4 * 60_000),
        },
      }),
      admin: adminStub(),
    };
    const changed = await poll(changedHarness, { force: true, rng: () => 0 });
    assert.equal(changed.changed, true);
    assert.equal(changed.opsRecovery.changed, true);
    assert.equal(
      changedHarness.db.docs.get(`live_setlist_automation/${SHOW}`).failureCount,
      0
    );

    const normalized = normalizeSetlistRows({ data: rows });
    const signature = signatureFromRows(normalized);
    const written = changedHarness.db.docs.get(`official_setlists/${SHOW}`);
    const noChangeHarness = {
      db: memoryDb({
        [`official_setlists/${SHOW}`]: written,
        [`live_setlist_automation/${SHOW}`]: {
          ...changedHarness.db.docs.get(`live_setlist_automation/${SHOW}`),
          failureCount: 2,
          lastError: "HTTP 500: blip",
          nextPollAt: stale,
          outageStartedAt: timestamp(now - 60_000),
        },
      }),
      admin: adminStub(),
    };
    assert.equal(written.sourceMeta.signature, signature);
    const unchanged = await poll(noChangeHarness, { force: true, rng: () => 0 });
    const unchangedDoc = noChangeHarness.db.docs.get(`live_setlist_automation/${SHOW}`);
    assert.equal(unchangedDoc.failureCount, 0);
    assert.equal(unchangedDoc.lastError, undefined);
    assert.equal(unchanged.opsRecovery, null);
    if (unchanged.reason === "unchanged") {
      assert.equal(unchangedDoc.lastResult, "no-change");
    }
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("poll: second success after an alerted outage does not request another recovery", async () => {
  const now = 1_700_000_000_000;
  const originalNow = Date.now;
  Date.now = () => now;
  const harness = {
    db: memoryDb({
      [`live_setlist_automation/${SHOW}`]: {
        showDate: SHOW,
        enabled: true,
        failureCount: 3,
        lastError: "HTTP 403: blocked",
        outageStartedAt: timestamp(now - 60_000),
        outageAlertedAt: timestamp(now - 30_000),
      },
    }),
    admin: adminStub(),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ data: [] });
    },
  });
  try {
    const first = await poll(harness, { inLiveWindow: true });
    assert.ok(first.opsRecovery);
    const second = await poll(harness, { force: true });
    assert.equal(second.opsRecovery, null);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("poll: live-window escalation sends once", async () => {
  const now = 1_800_000_000_000;
  const originalNow = Date.now;
  Date.now = () => now;
  const harness = {
    db: memoryDb({
      [`live_setlist_automation/${SHOW}`]: {
        showDate: SHOW,
        enabled: true,
        failureCount: 4,
        outageStartedAt: timestamp(now - OUTAGE_ESCALATION_MS - 1_000),
        outageAlertedAt: timestamp(now - OUTAGE_ESCALATION_MS),
        nextPollAt: timestamp(now - 1_000),
      },
    }),
    admin: adminStub(),
  };
  const alerts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async text() {
      return "HTTP blocked";
    },
  });
  try {
    await poll(harness, {
      deliverOpsAlert: async (event) => {
        alerts.push(event.kind);
      },
      rng: () => 0,
    });
    assert.deepEqual(alerts, ["escalation"]);
    harness.db.docs.get(`live_setlist_automation/${SHOW}`).nextPollAt = timestamp(now - 1);
    await poll(harness, {
      deliverOpsAlert: async (event) => {
        alerts.push(event.kind);
      },
      rng: () => 0,
    });
    assert.deepEqual(alerts, ["escalation"]);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

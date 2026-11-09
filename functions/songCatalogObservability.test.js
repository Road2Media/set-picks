const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SONG_CATALOG_HEALTH_EVENT,
  SONG_CATALOG_MIN_BYTES,
  SONG_CATALOG_STALE_AFTER_MS,
  SONG_CATALOG_SYNC_EVENT,
  buildSongCatalogSyncEntry,
  emitSongCatalogSync,
  evaluateSongCatalogObjectHealth,
  runSongCatalogHealthCheck,
  scrubSongCatalogLogMessage,
  songCatalogHealthReadFailure,
} = require("./songCatalogObservability.js");

const NOW = Date.parse("2026-11-09T18:30:00.000Z");

test("scrubSongCatalogLogMessage redacts apikey and caps length", () => {
  const raw =
    "Phish.net HTTP 500 https://api.phish.net/v5/songs.json?apikey=super-secret&order_by=song";
  const out = scrubSongCatalogLogMessage(raw);
  assert.equal(out.includes("super-secret"), false);
  assert.match(out, /apikey=REDACTED/);
  assert.equal(scrubSongCatalogLogMessage("x".repeat(400)).length, 300);
});

test("buildSongCatalogSyncEntry keeps a stable alert shape", () => {
  const entry = buildSongCatalogSyncEntry({
    ok: false,
    trigger: "schedule",
    reason: "exception",
    songCount: 0,
    durationMs: 42.2,
    archivePath: null,
    detail: "failed apikey=abc",
  });
  assert.equal(entry.event, SONG_CATALOG_SYNC_EVENT);
  assert.equal(entry.ok, false);
  assert.equal(entry.trigger, "schedule");
  assert.equal(entry.reason, "exception");
  assert.equal(entry.durationMs, 42);
  assert.equal(entry.archivePath, null);
  assert.equal(entry.detail.includes("abc"), false);
});

test("emitSongCatalogSync uses error severity only when ok is false", () => {
  const info = [];
  const error = [];
  const logger = {
    info: (...args) => info.push(args),
    error: (...args) => error.push(args),
  };
  emitSongCatalogSync(logger, {
    ok: true,
    trigger: "admin",
    reason: "uploaded",
    songCount: 900,
    durationMs: 10,
    archivePath: "song-catalog/archive/2026-11-09T18-00-00Z.json",
    detail: "uploaded",
  });
  emitSongCatalogSync(logger, {
    ok: false,
    trigger: "nope",
    reason: "missing_api_key",
    detail: "PHISHNET_API_KEY missing; skip sync.",
  });
  assert.equal(info.length, 1);
  assert.equal(info[0][0], SONG_CATALOG_SYNC_EVENT);
  assert.equal(info[0][1].trigger, "admin");
  assert.equal(info[0][1].songCount, 900);
  assert.equal(error.length, 1);
  assert.equal(error[0][1].trigger, "schedule");
  assert.equal(error[0][1].ok, false);
  assert.equal(error[0][1].songCount, 0);
});

test("evaluateSongCatalogObjectHealth marks a recent catalog fresh", () => {
  const updated = new Date(NOW - 60 * 60 * 1000).toISOString();
  const entry = evaluateSongCatalogObjectHealth({
    exists: true,
    updated,
    sizeBytes: SONG_CATALOG_MIN_BYTES,
    nowMs: NOW,
  });
  assert.equal(entry.ok, true);
  assert.equal(entry.reason, "fresh");
  assert.equal(entry.ageHours, 1);
  assert.equal(entry.object, "song-catalog.json");
  assert.equal(entry.thresholdHours, 18);
});

test("evaluateSongCatalogObjectHealth flags missing, tiny, unknown, and stale objects", () => {
  assert.equal(
    evaluateSongCatalogObjectHealth({ exists: false, nowMs: NOW }).reason,
    "missing"
  );

  assert.equal(
    evaluateSongCatalogObjectHealth({
      exists: true,
      updated: new Date(NOW - 60_000).toISOString(),
      sizeBytes: 100,
      nowMs: NOW,
    }).reason,
    "too_small"
  );

  assert.equal(
    evaluateSongCatalogObjectHealth({
      exists: true,
      updated: "not-a-date",
      sizeBytes: 50_000,
      nowMs: NOW,
    }).reason,
    "unknown_age"
  );

  const stale = evaluateSongCatalogObjectHealth({
    exists: true,
    updated: new Date(NOW - SONG_CATALOG_STALE_AFTER_MS - 1).toISOString(),
    sizeBytes: 50_000,
    nowMs: NOW,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale");
  assert.equal(stale.event, SONG_CATALOG_HEALTH_EVENT);

  const exact = evaluateSongCatalogObjectHealth({
    exists: true,
    updated: new Date(NOW - SONG_CATALOG_STALE_AFTER_MS).toISOString(),
    sizeBytes: 50_000,
    nowMs: NOW,
  });
  assert.equal(exact.ok, true);
  assert.equal(exact.reason, "fresh");
});

test("runSongCatalogHealthCheck reads metadata and logs a failure", async () => {
  const logs = [];
  const bucket = {
    file(path) {
      assert.equal(path, "song-catalog.json");
      return {
        async exists() {
          return [false];
        },
        async getMetadata() {
          throw new Error("should not download or stat a missing object");
        },
      };
    },
  };
  const entry = await runSongCatalogHealthCheck({
    bucket,
    logger: {
      info: () => logs.push("info"),
      error: (_msg, payload) => logs.push(payload),
    },
    nowMs: NOW,
  });
  assert.equal(entry.reason, "missing");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ok, false);
});

test("songCatalogHealthReadFailure scrubs the storage error", () => {
  const entry = songCatalogHealthReadFailure(
    "getMetadata failed apikey=token-value"
  );
  assert.equal(entry.ok, false);
  assert.equal(entry.reason, "metadata_read_failed");
  assert.equal(entry.detail.includes("token-value"), false);
});

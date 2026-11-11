const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePhishnetSongRow,
  isPhishNetPayloadOk,
  catalogArchiveObjectPath,
  CATALOG_ARCHIVE_PREFIX,
  CATALOG_STORAGE_PATH,
  CATALOG_BAND_ALIAS_PATH,
} = require("./phishnetSongCatalog.js");

test("isPhishNetPayloadOk accepts error:false", () => {
  assert.equal(isPhishNetPayloadOk({ error: false, data: [] }), true);
});

test("normalizePhishnetSongRow maps v5 row", () => {
  const row = {
    songid: 1,
    song: "Tweezer",
    slug: "tweezer",
    times_played: 414,
    gap: 5,
    last_played: "2025-12-31",
    debut: "1990-09-28",
  };
  assert.deepEqual(normalizePhishnetSongRow(row), {
    name: "Tweezer",
    total: "414",
    gap: "5",
    last: "2025-12-31",
    debut: "1990-09-28",
    slug: "tweezer",
  });
});

test("normalizePhishnetSongRow maps missing slug to empty string", () => {
  const out = normalizePhishnetSongRow({ song: "Wilson", times_played: 100 });
  assert.equal(out.slug, "");
});

test("normalizePhishnetSongRow maps missing debut to empty string", () => {
  const out = normalizePhishnetSongRow({
    song: "Wilson",
    times_played: 100,
    gap: 1,
    last_played: "2026-01-01",
  });
  assert.equal(out.debut, "");
});

test("normalizePhishnetSongRow returns null for empty song", () => {
  assert.equal(normalizePhishnetSongRow({ song: "  " }), null);
});

test("catalogArchiveObjectPath uses colon-safe UTC stamp under archive prefix", () => {
  assert.equal(
    catalogArchiveObjectPath("2026-07-21T18:00:00.000Z"),
    `${CATALOG_ARCHIVE_PREFIX}2026-07-21T18-00-00Z.json`
  );
  assert.equal(
    catalogArchiveObjectPath("2026-07-21T06:30:45.123Z"),
    `${CATALOG_ARCHIVE_PREFIX}2026-07-21T06-30-45Z.json`
  );
});

test("catalogArchiveObjectPath rejects invalid timestamps", () => {
  assert.throws(() => catalogArchiveObjectPath("not-a-date"), /Invalid catalog archive/);
});

// Regression guard for #261: the displayed `Gap` and `Last` in
// `SongAutocomplete` must always come from the same Phish.net row so they
// cannot drift relative to each other. Worst-case staleness should move both
// in lockstep (bounded by the cron window); mismatch between them in a single
// snapshot would break the user-visible "gap = shows since last_played"
// invariant the bustout UX relies on.
test(
  "normalizePhishnetSongRow reads gap and last_played from the same row",
  () => {
    const row = {
      songid: 42,
      song: "Ghost",
      times_played: 300,
      gap: 75,
      last_played: "2023-12-31",
    };
    const out = normalizePhishnetSongRow(row);
    assert.equal(out.gap, "75");
    assert.equal(out.last, "2023-12-31");

    const rowRecent = { ...row, gap: 0, last_played: "2025-07-15" };
    const outRecent = normalizePhishnetSongRow(rowRecent);
    assert.equal(outRecent.gap, "0");
    assert.equal(outRecent.last, "2025-07-15");

    // Missing either field falls back to the sentinel independently — never
    // composes a value from a different row's data.
    const rowPartial = { song: "Wilson", gap: 12 };
    const outPartial = normalizePhishnetSongRow(rowPartial);
    assert.equal(outPartial.gap, "12");
    assert.equal(outPartial.last, "—");
  }
);

test("song catalog alias is a second object and does not replace the live path", () => {
  assert.equal(CATALOG_STORAGE_PATH, "song-catalog.json");
  assert.equal(CATALOG_BAND_ALIAS_PATH, "song-catalog/phish.json");
  assert.notEqual(CATALOG_BAND_ALIAS_PATH, CATALOG_STORAGE_PATH);
  assert.equal(CATALOG_BAND_ALIAS_PATH.startsWith(CATALOG_ARCHIVE_PREFIX), false);
});

/**
 * Unit tests for Functions tour-stats aggregation (#665).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  aggregateTourSetlistStats,
  toPublicTourStatsPayload,
  buildSongEnrichmentByTitle,
  lastPlayedBeforeFromHistory,
  tourLabelToSlug,
} = require("./aggregateTourSetlistStats.cjs");
const {
  lastPlayedRowKey,
  buildPriorLastPlayedMap,
  seedLastPlayedFromPrior,
  stampLastPlayedDates,
  mergeLastPlayedByRowCache,
  accumulatePlayDatesFromSetlists,
  stampLastPlayedFromLocalHistory,
} = require("./publicTourStats");

describe("tourLabelToSlug", () => {
  it("kebab-cases 2026 Sphere", () => {
    assert.equal(tourLabelToSlug("2026 Sphere"), "2026-sphere");
  });
  it("kebab-cases Summer Tour 2026", () => {
    assert.equal(tourLabelToSlug("Summer Tour 2026"), "summer-tour-2026");
  });
});

describe("aggregateTourSetlistStats", () => {
  it("counts a same-night return as another play and one unique title", () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: "2026-10-09",
          setlist: {
            officialSetlist: ["Tweezer", "Plasma", "Tweezer", "Plasma", "Tweezer"],
            bustouts: ["Tweezer"],
            songGaps: { tweezer: 40, plasma: 2 },
          },
        },
      ],
      { tourShowCount: 1 }
    );
    assert.equal(stats.uniqueSongs, 2);
    assert.equal(stats.totalSongPlays, 5);
    assert.equal(stats.topSongs.find((r) => r.title === "Tweezer").timesPlayed, 3);
    assert.equal(stats.bustouts.length, 1);
    assert.equal(stats.bustouts[0].title, "Tweezer");
  });

  it("returns ALL songs and gap highlights — no top-N truncation (#709)", () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Song ${String(i).padStart(2, "0")}`);
    const songGaps = Object.fromEntries(
      titles.map((t, i) => [t.toLowerCase(), 10 + (i % 15)])
    );
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: "2026-07-25",
          setlist: { officialSetlist: titles, bustouts: [], songGaps },
        },
      ],
      { tourShowCount: 1 }
    );
    assert.equal(stats.topSongs.length, 40);
    assert.equal(stats.uniqueSongs, 40);
    assert.equal(stats.gapHighlights.length, 40);
    const pub = toPublicTourStatsPayload(stats);
    assert.equal(pub.topSongs.length, 40);
    assert.equal(pub.gapHighlights.length, 40);
  });
});

describe("buildSongEnrichmentByTitle (#666)", () => {
  it("normalizes titles and parses total/debut/slug from catalog rows", () => {
    const map = buildSongEnrichmentByTitle([
      { name: "Ghost", total: "623", debut: "1997-06-13", slug: "ghost" },
      { name: "Tweezer", total: "512", debut: "1990" },
      { name: "No Data", total: "—", debut: "" },
      { name: "Weird Year", total: "3", debut: "0999-01-01" },
      { name: "  ", total: "5", debut: "2000" },
    ]);
    assert.deepEqual(map.get("ghost"), {
      lifetimePlays: 623,
      debutYear: 1997,
      slug: "ghost",
      lastPlayedCatalog: null,
    });
    assert.deepEqual(map.get("tweezer"), {
      lifetimePlays: 512,
      debutYear: 1990,
      slug: null,
      lastPlayedCatalog: null,
    });
    assert.equal(map.has("no data"), false);
    assert.deepEqual(map.get("weird year"), {
      lifetimePlays: 3,
      debutYear: null,
      slug: null,
      lastPlayedCatalog: null,
    });
    assert.equal(map.has(""), false);
  });

  it("keeps catalog last_played when it is a YYYY-MM-DD date", () => {
    const map = buildSongEnrichmentByTitle([
      { name: "Ghost", total: "1", debut: "1997", last: "2024-12-31", slug: "ghost" },
      { name: "Bad Last", total: "1", debut: "1990", last: "—" },
    ]);
    assert.equal(map.get("ghost").lastPlayedCatalog, "2024-12-31");
    assert.equal(map.get("bad last").lastPlayedCatalog, null);
  });
});

describe("lastPlayedBeforeFromHistory (#709 follow-up)", () => {
  it("returns the latest date strictly before the show date", () => {
    assert.equal(
      lastPlayedBeforeFromHistory(
        ["2019-06-16", "2021-08-01", "2024-12-31", "2026-07-22"],
        "2026-07-22"
      ),
      "2024-12-31"
    );
  });

  it("returns null when no prior date or inputs are invalid", () => {
    assert.equal(lastPlayedBeforeFromHistory(["2026-07-22"], "2026-07-22"), null);
    assert.equal(lastPlayedBeforeFromHistory([], "2026-07-22"), null);
    assert.equal(lastPlayedBeforeFromHistory(["2020-01-01"], "not-a-date"), null);
    assert.equal(lastPlayedBeforeFromHistory(null, "2026-07-22"), null);
  });
});

describe("toPublicTourStatsPayload enrichment (#666)", () => {
  const stats = aggregateTourSetlistStats(
    [
      {
        showDate: "2026-04-16",
        setlist: {
          officialSetlist: ["Ghost", "Obscure Original"],
          bustouts: ["Ghost"],
          songGaps: { ghost: 47, "obscure original": 12 },
        },
      },
    ],
    { tourShowCount: 1 }
  );

  it("attaches lifetimePlays/debutYear per row, null for unknown songs", () => {
    const map = buildSongEnrichmentByTitle([
      { name: "GHOST", total: "623", debut: "1997-06-13" },
    ]);
    const pub = toPublicTourStatsPayload(stats, map);
    const ghost = pub.topSongs.find((r) => r.title === "Ghost");
    assert.equal(ghost.lifetimePlays, 623);
    assert.equal(ghost.debutYear, 1997);
    const obscure = pub.topSongs.find((r) => r.title === "Obscure Original");
    assert.equal(obscure.lifetimePlays, null);
    assert.equal(obscure.debutYear, null);
    assert.equal(pub.bustouts[0].lifetimePlays, 623);
    assert.equal(pub.gapHighlights[0].title, "Obscure Original");
    assert.equal(pub.gapHighlights[0].debutYear, null);
  });

  it("omits enrichment fields entirely when no map is provided", () => {
    const pub = toPublicTourStatsPayload(stats);
    assert.ok(pub.topSongs.every((r) => !("lifetimePlays" in r)));
    assert.ok(pub.bustouts.every((r) => !("debutYear" in r)));
  });
});

describe("toPublicTourStatsPayload", () => {
  it("strips topSongs.showDates and keeps aggregate fields", () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: "2026-04-16",
          setlist: {
            officialSetlist: ["Ghost", "Tweezer"],
            bustouts: ["Ghost"],
            songGaps: { ghost: 47, tweezer: 5 },
          },
        },
        {
          showDate: "2026-04-18",
          setlist: {
            officialSetlist: ["Ghost", "Bathtub Gin"],
            bustouts: [],
            songGaps: { ghost: 1, "bathtub gin": 12 },
          },
        },
      ],
      { tourShowCount: 2 }
    );
    const pub = toPublicTourStatsPayload(stats);
    assert.equal(pub.uniqueSongs, 3);
    assert.equal(pub.showsWithSetlist, 2);
    assert.ok(pub.topSongs.every((r) => !("showDates" in r)));
    assert.ok(pub.topSongs.some((r) => r.title === "Ghost" && r.timesPlayed === 2));
    assert.ok(Array.isArray(pub.bustouts));
    assert.ok(Array.isArray(pub.gapHighlights));
  });
});
/**
 * Unit tests for public tour-stats lastPlayed preserve helpers (#840).
 */
describe("lastPlayedRowKey (#840)", () => {
  it("normalizes title + showDate", () => {
    assert.equal(
      lastPlayedRowKey("  HARPUA ", "2026-07-22"),
      "harpua|2026-07-22"
    );
  });

  it("rejects incomplete inputs", () => {
    assert.equal(lastPlayedRowKey("", "2026-07-22"), "");
    assert.equal(lastPlayedRowKey("Fee", "07-22"), "");
    assert.equal(lastPlayedRowKey(null, null), "");
  });
});

describe("buildPriorLastPlayedMap (#840 / #918)", () => {
  it("indexes bustouts + gapHighlights with valid lastPlayed", () => {
    const map = buildPriorLastPlayedMap({
      bustouts: [
        { title: "Harpua", showDate: "2026-07-22", lastPlayed: "2019-06-16" },
        { title: "No Date", showDate: "2026-07-22", lastPlayed: "" },
      ],
      gapHighlights: [
        { title: "Fee", showDate: "2026-07-23", lastPlayed: "2025-08-01" },
      ],
    });
    assert.equal(map.get("harpua|2026-07-22"), "2019-06-16");
    assert.equal(map.get("fee|2026-07-23"), "2025-08-01");
    assert.equal(map.has("no date|2026-07-22"), false);
  });

  it("merges durable lastPlayedByRow cache even when arrays dropped the row (#918)", () => {
    const map = buildPriorLastPlayedMap({
      bustouts: [],
      gapHighlights: [
        { title: "Fee", showDate: "2026-07-23", lastPlayed: "2025-08-01" },
      ],
      lastPlayedByRow: {
        "foam|2026-07-22": "2025-12-01",
        "fee|2026-07-23": "2020-01-01", // array row wins on conflict
        bad: "2025-01-01",
        "ghost|07-22": "2025-01-01",
      },
    });
    assert.equal(map.get("foam|2026-07-22"), "2025-12-01");
    assert.equal(map.get("fee|2026-07-23"), "2025-08-01");
    assert.equal(map.has("bad"), false);
    assert.equal(map.has("ghost|07-22"), false);
  });

  it("tolerates null / malformed docs", () => {
    assert.equal(buildPriorLastPlayedMap(null).size, 0);
    assert.equal(buildPriorLastPlayedMap({ bustouts: "nope" }).size, 0);
  });
});

describe("mergeLastPlayedByRowCache (#918)", () => {
  it("keeps prior keys and merges newly stamped rows", () => {
    const prior = new Map([
      ["foam|2026-07-22", "2025-12-01"],
      ["old|2026-06-01", "2024-01-01"],
    ]);
    const cache = mergeLastPlayedByRowCache(prior, [
      { title: "Fee", showDate: "2026-07-23", lastPlayed: "2025-08-01" },
      { title: "Blank", showDate: "2026-07-24" },
    ]);
    assert.equal(cache["foam|2026-07-22"], "2025-12-01");
    assert.equal(cache["old|2026-06-01"], "2024-01-01");
    assert.equal(cache["fee|2026-07-23"], "2025-08-01");
    assert.equal(cache["blank|2026-07-24"], undefined);
  });
});

describe("stampLastPlayedFromLocalHistory (#918)", () => {
  it("fills blank high-gap rows from cross-tour official setlists", () => {
    const playDatesByTitle = new Map();
    accumulatePlayDatesFromSetlists(playDatesByTitle, [
      {
        showDate: "2026-04-18",
        setlist: { officialSetlist: ["Foam", "Esther"] },
      },
      {
        showDate: "2026-07-10",
        setlist: { officialSetlist: ["Foam"] },
      },
      {
        showDate: "2026-07-22",
        setlist: { officialSetlist: ["Foam"] },
      },
    ]);
    const gaps = [
      { title: "Foam", showDate: "2026-07-22", gap: 19 },
      { title: "Esther", showDate: "2026-07-29", gap: 20 },
      {
        title: "Already",
        showDate: "2026-07-22",
        gap: 12,
        lastPlayed: "2020-01-01",
      },
      { title: "Never Seen", showDate: "2026-07-22", gap: 11 },
    ];
    const stamped = stampLastPlayedFromLocalHistory(gaps, playDatesByTitle);
    assert.equal(stamped, 2);
    assert.equal(gaps[0].lastPlayed, "2026-07-10");
    assert.equal(gaps[1].lastPlayed, "2026-04-18");
    assert.equal(gaps[2].lastPlayed, "2020-01-01");
    assert.equal(gaps[3].lastPlayed, undefined);
  });

  it("lets local stamps skip phish.net history in stampLastPlayedDates", async () => {
    const playDatesByTitle = new Map([
      ["foam", new Set(["2026-04-18", "2026-07-22"])],
    ]);
    const payload = {
      bustouts: [],
      gapHighlights: [{ title: "Foam", showDate: "2026-07-22", gap: 19 }],
    };
    stampLastPlayedFromLocalHistory(payload.gapHighlights, playDatesByTitle);
    const enrichmentByTitle = new Map([
      ["foam", { slug: "foam", lastPlayedCatalog: "2026-07-22" }],
    ]);
    const result = await stampLastPlayedDates([payload], {
      enrichmentByTitle,
      apiKey: "test-key",
      logger: { info() {}, warn() {} },
    });
    assert.equal(payload.gapHighlights[0].lastPlayed, "2026-04-18");
    assert.equal(result.lookups, 0);
  });
});

describe("seedLastPlayedFromPrior (#840)", () => {
  it("seeds blank rows and leaves existing stamps untouched", () => {
    const prior = buildPriorLastPlayedMap({
      bustouts: [
        { title: "Harpua", showDate: "2026-07-22", lastPlayed: "2019-06-16" },
      ],
      gapHighlights: [
        { title: "Fee", showDate: "2026-07-23", lastPlayed: "2025-08-01" },
        { title: "Ghost", showDate: "2026-07-24", lastPlayed: "2024-01-01" },
      ],
    });
    const gaps = [
      { title: "Fee", showDate: "2026-07-23", gap: 14 },
      { title: "Ghost", showDate: "2026-07-24", gap: 12, lastPlayed: "2020-01-01" },
      { title: "New Song", showDate: "2026-07-25", gap: 11 },
    ];
    const seeded = seedLastPlayedFromPrior(gaps, prior);
    assert.equal(seeded, 1);
    assert.equal(gaps[0].lastPlayed, "2025-08-01");
    assert.equal(gaps[1].lastPlayed, "2020-01-01");
    assert.equal(gaps[2].lastPlayed, undefined);
  });

  it("keeps prior stamps so stampLastPlayedDates skips history for them", async () => {
    const enrichmentByTitle = new Map([
      [
        "fee",
        {
          slug: "fee",
          lastPlayedCatalog: "2026-07-23", // ≥ night → would need history without seed
        },
      ],
    ]);
    const payload = {
      bustouts: [],
      gapHighlights: [{ title: "Fee", showDate: "2026-07-23", gap: 14 }],
    };
    seedLastPlayedFromPrior(
      payload.gapHighlights,
      new Map([["fee|2026-07-23", "2025-08-01"]])
    );
    const result = await stampLastPlayedDates([payload], {
      enrichmentByTitle,
      apiKey: "test-key",
      logger: { info() {}, warn() {} },
    });
    assert.equal(payload.gapHighlights[0].lastPlayed, "2025-08-01");
    assert.equal(result.lookups, 0);
    assert.equal(result.fromCatalog, 0);
    assert.equal(result.fromHistory, 0);
  });
});

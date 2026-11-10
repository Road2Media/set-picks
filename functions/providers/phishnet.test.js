const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ProviderRequestError,
  fetchSetlistForDate,
  fetchShowsForYear,
  fetchSongs,
  normalizeSetlistRows,
  normalizeShows,
  responseOk,
} = require("./phishnet");
const {
  getProvider,
  listRegisteredBands,
  phishProviderArgs,
} = require("./registry");
const { resolveProviderDispatches } = require("./dispatch");
const { normalizePhishShows } = require("../phishnetShowCalendar");
const {
  fetchPhishnetSetlistForDate,
  normalizeSetlistRows: legacyNormalizeSetlistRows,
} = require("../phishnetLiveSetlistAutomation");
const { fetchPhishnetSongsNormalized } = require("../phishnetSongCatalog");

const PHISH_ARGS = {
  baseUrl: "https://api.phish.net/v5",
  artistId: 1,
  secretName: "PHISHNET_API_KEY",
};

function jsonResponse({ status = 200, body, ok }) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: ok == null ? status >= 200 && status < 300 : ok,
    status,
    async text() {
      return text;
    },
  };
}

test("responseOk matches the Phish.net success envelope", () => {
  for (const error of [undefined, null, false, 0, "0"]) {
    const payload = error === undefined ? { data: [] } : { error, data: [] };
    assert.equal(responseOk(payload), true, String(error));
  }
  assert.equal(responseOk({ error: false, data: [] }), true);
  assert.equal(responseOk({ error: 1, error_message: "nope" }), false);
  assert.equal(responseOk({ error: "2" }), false);
  assert.equal(responseOk({ error: true }), false);
  assert.equal(responseOk(null), true);
});

test("registry is phishnet only and mirrors BandConfig coordinates", () => {
  const bands = listRegisteredBands();
  assert.equal(bands.length, 1);
  assert.equal(bands[0].id, "phish");
  assert.equal(bands[0].providerId, "phishnet");
  assert.deepEqual(bands[0].providerArgs, PHISH_ARGS);
  assert.equal(getProvider("phishnet").fetchShowsForYear, fetchShowsForYear);
  assert.throws(() => getProvider("songfish"), /Unknown providerId: songfish/);

  const bandsSrc = fs.readFileSync(
    path.join(__dirname, "../../src/shared/config/bands.js"),
    "utf8"
  );
  assert.match(bandsSrc, /baseUrl: 'https:\/\/api\.phish\.net\/v5'/);
  assert.match(bandsSrc, /artistId: 1/);
  assert.match(bandsSrc, /secretName: 'PHISHNET_API_KEY'/);
  assert.match(bandsSrc, /providerId: 'phishnet'/);
});

test("dispatch copies the secret onto providerArgs and does not read env", () => {
  const rows = resolveProviderDispatches({ PHISHNET_API_KEY: "  secret-key  " });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].band.id, "phish");
  assert.equal(rows[0].providerArgs.apiKey, "secret-key");
  assert.equal(rows[0].providerArgs.baseUrl, PHISH_ARGS.baseUrl);
  assert.equal(rows[0].provider.fetchSongs, fetchSongs);
  const missing = resolveProviderDispatches({});
  assert.equal(missing[0].providerArgs.apiKey, "");
});

test("provider sources do not import firebase or touch storage", () => {
  const dir = path.join(__dirname);
  const files = ["phishnet/index.js", "registry.js", "dispatch.js"];
  for (const file of files) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    assert.equal(/require\(["']firebase-admin["']\)/.test(src), false, file);
    assert.equal(/require\(["']firebase-functions["']\)/.test(src), false, file);
    assert.equal(src.includes("defineSecret("), false, file);
    assert.equal(src.includes(".collection("), false, file);
    assert.equal(src.includes(".bucket("), false, file);
    assert.equal(src.includes("process.env"), false, file);
  }
});

test("fetchShowsForYear returns the envelope and does not filter rows", async () => {
  const original = global.fetch;
  let seen = "";
  global.fetch = async (url) => {
    seen = String(url);
    return jsonResponse({
      body: {
        error: false,
        data: [
          { artistid: 2, showdate: "2026-01-01", venue: "Other" },
          {
            artistid: 1,
            showdate: "2026-01-02",
            venue: "Sphere",
            exclude_from_stats: 1,
          },
        ],
      },
    });
  };
  try {
    const payload = await fetchShowsForYear("2026", {
      ...PHISH_ARGS,
      apiKey: "test-key",
    });
    assert.equal(payload.data.length, 2);
    assert.equal(payload.data[0].artistid, 2);
  } finally {
    global.fetch = original;
  }
  assert.equal(
    seen,
    "https://api.phish.net/v5/shows/showyear/2026.json?order_by=showdate&apikey=test-key"
  );
});

test("fetchShowsForYear keeps the calendar module's error strings", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => jsonResponse({ body: "nope", status: 200 });
    await assert.rejects(
      () => fetchShowsForYear("2024", { ...PHISH_ARGS, apiKey: "k" }),
      /Phish\.net shows\/showyear\/2024: non-JSON body\./
    );

    global.fetch = async () =>
      jsonResponse({
        status: 503,
        body: { error: false, data: [] },
      });
    await assert.rejects(
      () => fetchShowsForYear("2024", { ...PHISH_ARGS, apiKey: "k" }),
      /Phish\.net shows\/showyear\/2024: HTTP 503/
    );

    global.fetch = async () =>
      jsonResponse({
        body: { error: 2, error_message: "Invalid API key." },
      });
    await assert.rejects(
      () => fetchShowsForYear("2024", { ...PHISH_ARGS, apiKey: "k" }),
      /Phish\.net shows\/showyear\/2024: Invalid API key\./
    );
  } finally {
    global.fetch = original;
  }
});

test("normalizeShows matches normalizePhishShows", () => {
  const rows = [
    {
      artistid: 1,
      showdate: "2026-10-10",
      venue: "Orion Amphitheater",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
      exclude_from_stats: 1,
    },
    {
      artistid: 2,
      showdate: "2026-10-11",
      venue: "Side Project",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
    },
    {
      artistid: 1,
      showdate: "2026-10-12",
      venue: "Orion Amphitheater",
      city: "Huntsville",
      state: "AL",
      country: "USA",
      tour_name: "2026 Fall Tour",
      exclude_from_stats: 0,
    },
    {
      artistid: 1,
      showdate: "2026-01-28",
      venue: "Moon Palace",
      city: "Cancun",
      state: "",
      country: "Mexico",
      tour_name: "2026 Mexico",
    },
  ];
  const fromProvider = normalizeShows(rows, phishProviderArgs());
  const fromLegacy = normalizePhishShows(rows);
  assert.deepEqual(fromProvider, fromLegacy);
  assert.deepEqual(
    fromProvider.map((show) => show.date),
    ["2026-01-28", "2026-10-12"]
  );
  assert.equal(fromProvider[0].timeZone, "America/Cancun");
  assert.equal(fromProvider[0].city, "Cancun, Mexico");
  assert.equal(fromProvider[1].timeZone, "America/Chicago");
  assert.equal(fromProvider[1].venue, "Orion Amphitheater, Huntsville, AL");
});

test("normalizeSetlistRows matches the automation export", () => {
  const payload = {
    error: false,
    data: [
      { set: "2", idx: 2, song: "Zero", gap: "4" },
      { set: "1", idx: 1, song: "AC/DC Bag", gap: 12 },
      { set: "E", idx: 1, song: "Tweezer Reprise", gap: 0 },
      { set: "1", position: 2, song: "Bathtub Gin" },
    ],
  };
  assert.deepEqual(
    normalizeSetlistRows(payload.data, phishProviderArgs()),
    legacyNormalizeSetlistRows(payload)
  );
  assert.equal(legacyNormalizeSetlistRows(payload)[0].title, "AC/DC Bag");
  assert.equal(legacyNormalizeSetlistRows(payload)[0].gap, 12);
  assert.throws(
    () => legacyNormalizeSetlistRows({ error: 2, error_message: "Invalid key" }),
    /Invalid key/
  );
  assert.throws(
    () => normalizeSetlistRows({ data: [] }, phishProviderArgs()),
    /no data array/
  );
});

test("fetchSetlistForDate throws on a rejected envelope and the legacy fetch returns it", async () => {
  const original = global.fetch;
  const envelope = { error: 2, error_message: "Invalid API key.", data: [] };
  global.fetch = async (url) => {
    assert.match(
      String(url),
      /^https:\/\/api\.phish\.net\/v5\/setlists\/showdate\/2026-07-21\.json\?apikey=test-key$/
    );
    return jsonResponse({ body: envelope });
  };
  try {
    await assert.rejects(
      () => fetchSetlistForDate("2026-07-21", { ...PHISH_ARGS, apiKey: "test-key" }),
      (error) => {
        assert.ok(error instanceof ProviderRequestError);
        assert.equal(error.kind, "envelope");
        assert.equal(error.message, "Invalid API key.");
        assert.deepEqual(error.payload, envelope);
        return true;
      }
    );
    const legacy = await fetchPhishnetSetlistForDate("2026-07-21", "test-key");
    assert.deepEqual(legacy, envelope);
  } finally {
    global.fetch = original;
  }
});

test("fetchSetlistForDate keeps live-poll transport errors", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => jsonResponse({ status: 429, body: "slow down" });
    await assert.rejects(
      () => fetchPhishnetSetlistForDate("2026-07-21", "test-key"),
      (error) => {
        assert.equal(error.message, "HTTP 429: slow down");
        return true;
      }
    );

    global.fetch = async () => jsonResponse({ status: 200, body: "not-json" });
    await assert.rejects(
      () => fetchPhishnetSetlistForDate("2026-07-21", "test-key"),
      /Phish\.net returned non-JSON payload\./
    );

    const network = new Error("socket hang up");
    global.fetch = async () => {
      throw network;
    };
    await assert.rejects(
      () => fetchPhishnetSetlistForDate("2026-07-21", "test-key"),
      (error) => error === network
    );
  } finally {
    global.fetch = original;
  }
});

test("fetchSongs returns the envelope and the catalog wrapper still normalizes", async () => {
  const original = global.fetch;
  let seen = "";
  global.fetch = async (url) => {
    seen = String(url);
    return jsonResponse({
      body: {
        error: 0,
        data: [
          {
            song: "Tweezer",
            slug: "tweezer",
            times_played: 3,
            gap: 1,
            last_played: "2026-01-01",
            debut: "1990-09-28",
          },
        ],
      },
    });
  };
  try {
    const payload = await fetchSongs({ ...PHISH_ARGS, apiKey: "test-key" });
    assert.equal(payload.data.length, 1);
    const songs = await fetchPhishnetSongsNormalized("test-key");
    assert.equal(songs.length, 1);
    assert.equal(songs[0].name, "Tweezer");
    assert.equal(songs[0].slug, "tweezer");
  } finally {
    global.fetch = original;
  }
  assert.equal(
    seen,
    "https://api.phish.net/v5/songs.json?apikey=test-key&order_by=song&direction=asc&limit=10000"
  );
});

test("fetchSongs keeps the catalog error strings", async () => {
  const original = global.fetch;
  try {
    await assert.rejects(
      () => fetchSongs({ ...PHISH_ARGS, apiKey: "  " }),
      /Phish\.net API key is empty\./
    );
    global.fetch = async () => {
      throw new Error("ECONNRESET");
    };
    await assert.rejects(
      () => fetchPhishnetSongsNormalized("k"),
      (error) => {
        assert.equal(error.message, "ECONNRESET");
        return true;
      }
    );
    global.fetch = async () =>
      jsonResponse({
        body: { error: false, data: [] },
      });
    await assert.rejects(
      () => fetchPhishnetSongsNormalized("k"),
      /Phish\.net returned no songs\./
    );
  } finally {
    global.fetch = original;
  }
});

test("index.js dispatches through the registry and no longer inlines the setlist URL", () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
  assert.match(indexSrc, /defineSecret\("PHISHNET_API_KEY"\)/);
  assert.match(indexSrc, /listProviderDispatches\(\)/);
  assert.match(indexSrc, /fetchSetlistForDate\(/);
  assert.equal(indexSrc.includes("api.phish.net/v5/setlists/showdate"), false);
  assert.equal(indexSrc.includes('schedule: "*/2 * * * *"'), true);
  assert.equal(indexSrc.includes('schedule: "0 6 * * *"'), true);
  assert.equal(indexSrc.includes('schedule: "0 */6 * * *"'), true);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  SEO_EPIC,
  KEYWORD_LANDING_PATH,
  GATED_PHISH_PICKS_PATH,
  hasLiveGscCredentials,
  normalizeQuery,
  normalizeLandingPath,
  isSeoOrganicLanding,
  last7dWindow,
  mondayOnOrBefore,
  addDaysYmd,
  matchRegistryToGsc,
  topNewQueries,
  filterOrganicLandings,
  assembleSnapshot,
  buildPackMarkdown,
  buildWeeklyLogObject,
  formatCtr,
} from "./seoGscSnapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registry = JSON.parse(
  readFileSync(path.join(root, "docs/seo/query-registry.json"), "utf8"),
);
const fixture = JSON.parse(
  readFileSync(
    path.join(root, "scripts/seo/fixtures/weekly-snapshot.fixture.json"),
    "utf8",
  ),
);
const cli = path.join(root, "scripts/seo/gsc-weekly-snapshot.mjs");

describe("seoGscSnapshot helpers (#932)", () => {
  it("normalizes queries (case, quotes, whitespace)", () => {
    assert.equal(normalizeQuery("Phish Setlist Game"), "phish setlist game");
    assert.equal(normalizeQuery("setlist pick'em"), "setlist pickem");
    assert.equal(normalizeQuery("  setlist   pick’em  "), "setlist pickem");
  });

  it("normalizes landing paths and rejects /phish-picks", () => {
    assert.equal(normalizeLandingPath("/tour-stats/2026-summer-tour/"), "/tour-stats/2026-summer-tour");
    assert.equal(
      normalizeLandingPath("https://www.setlistpickem.com/phish-setlist-prediction-game?utm=x"),
      KEYWORD_LANDING_PATH,
    );
    assert.equal(isSeoOrganicLanding("/tour-stats"), true);
    assert.equal(isSeoOrganicLanding("/tour-stats/2026-summer-tour"), true);
    assert.equal(isSeoOrganicLanding(KEYWORD_LANDING_PATH), true);
    assert.equal(isSeoOrganicLanding("/"), false);
    assert.equal(isSeoOrganicLanding(GATED_PHISH_PICKS_PATH), false);
  });

  it("last7d window is yesterday inclusive (7 days) and Monday weekStarting", () => {
    const w = last7dWindow(new Date("2026-09-08T16:00:00Z"), "America/Denver");
    assert.equal(w.runDate, "2026-09-08");
    assert.equal(w.endDate, "2026-09-07");
    assert.equal(w.startDate, "2026-09-01");
    assert.equal(w.weekStarting, "2026-08-31");
    assert.equal(mondayOnOrBefore("2026-09-01"), "2026-08-31");
    assert.equal(addDaysYmd("2026-09-01", -1), "2026-08-31");
  });

  it("matches registry ids and ranks top new queries", () => {
    const { registry: rows, unmatched } = matchRegistryToGsc(
      [
        { query: "phish setlist game", impressions: 42, clicks: 11, position: 3.1 },
        { query: "brand new fan query", impressions: 5, clicks: 0, position: 20 },
        { query: "another new", impressions: 12, clicks: 2, position: 14 },
      ],
      registry.queries,
    );
    const c1 = rows.find((r) => r.id === "C1");
    assert.equal(c1.impressions, 42);
    assert.equal(c1.targetPath, KEYWORD_LANDING_PATH);
    const s7 = rows.find((r) => r.id === "S7");
    assert.equal(s7.impressions, null);
    assert.equal(unmatched.length, 2);
    const top = topNewQueries(unmatched, 1);
    assert.equal(top[0].query, "another new");
    assert.equal(top[0].impressions, 12);
  });

  it("filters GA4 organic landings to tour-stats + keyword page", () => {
    const rows = filterOrganicLandings([
      { landingPage: "/tour-stats", sessions: 3, totalUsers: 3 },
      { landingPage: "/", sessions: 40, totalUsers: 35 },
      { landingPage: GATED_PHISH_PICKS_PATH, sessions: 1, totalUsers: 1 },
      { landingPage: KEYWORD_LANDING_PATH, sessions: 8, totalUsers: 7 },
    ]);
    assert.deepEqual(
      rows.map((r) => r.landingPage).sort(),
      ["/phish-setlist-prediction-game", "/tour-stats"].sort(),
    );
  });

  it("hasLiveGscCredentials is true only with SA JSON, token, or ADC path", () => {
    assert.equal(hasLiveGscCredentials({}), false);
    assert.equal(hasLiveGscCredentials({ GSC_SERVICE_ACCOUNT_JSON: "  " }), false);
    assert.equal(hasLiveGscCredentials({ GSC_ACCESS_TOKEN: "ya29.x" }), true);
    assert.equal(
      hasLiveGscCredentials({ GOOGLE_APPLICATION_CREDENTIALS: "/tmp/sa.json" }),
      true,
    );
  });

  it("formatCtr treats fractions as percent", () => {
    assert.equal(formatCtr(0.148), "14.8%");
    assert.equal(formatCtr(null), "unknown");
  });
});

describe("seoGscSnapshot fixture pack (#932)", () => {
  const assembled = assembleSnapshot(fixture, registry, {
    runDate: fixture.runDate,
    startDate: fixture.startDate,
    endDate: fixture.endDate,
    weekStarting: fixture.weekStarting,
  });
  const pack = buildPackMarkdown({
    ...assembled.window,
    source: assembled.source,
    siteUrl: assembled.siteUrl,
    site: assembled.site,
    registryRows: assembled.registryRows,
    newQueries: assembled.newQueries,
    ga4: assembled.ga4,
  });

  it("assembles registry hits and drops home /phish-picks from GA4", () => {
    assert.equal(assembled.site.impressions, 128);
    assert.equal(assembled.registryRows.find((r) => r.id === "C1").clicks, 11);
    assert.equal(assembled.registryRows.find((r) => r.id === "C6").impressions, 18);
    assert.equal(assembled.registryRows.find((r) => r.id === "S4").impressions, null);
    assert.ok(assembled.newQueries.some((q) => q.query.includes("summer tour stats")));
    assert.ok(assembled.ga4.rows.every((r) => r.landingPage !== "/"));
    assert.ok(assembled.ga4.rows.every((r) => r.landingPage !== GATED_PHISH_PICKS_PATH));
    assert.ok(assembled.ga4.rows.some((r) => r.landingPage === "/tour-stats/2026-summer-tour"));
  });

  it("pack starts with the facts heading and never mentions a merge/deploy action", () => {
    assert.ok(pack.startsWith("## SEO Optimize pack"));
    assert.doesNotMatch(pack, /\[SKIP-PRD\]/);
    assert.match(pack, /SEO Optimize pack/);
    assert.match(pack, new RegExp(`#${SEO_EPIC}`));
    assert.match(pack, /aggregates only/i);
    assert.match(pack, /No Google\/Bing SERP HTML scraping/);
    assert.match(pack, /No `\/phish-picks` route/);
    assert.match(pack, /SEO_OPTIMIZE_AUTONOMY/);
    assert.doesNotMatch(pack, /E3 \(#934\) is out of scope/);
    assert.doesNotMatch(pack, /will merge/i);
    assert.doesNotMatch(pack, /comms:deploy/);
  });

  it("weekly log object keeps registry ids only on queries[]", () => {
    const log = buildWeeklyLogObject({
      weekStarting: assembled.window.weekStarting,
      loggedAt: "2026-09-08T12:00:00Z",
      source: assembled.source,
      property: assembled.siteUrl,
      window: "last_7_days",
      site: assembled.site,
      queries: assembled.registryRows,
      newQueries: assembled.newQueries,
      ga4Organic: assembled.ga4,
    });
    const ids = new Set(registry.queries.map((q) => q.id));
    for (const row of log.queries) {
      assert.ok(ids.has(row.id), `unknown id ${row.id}`);
    }
    assert.equal(log.source, "gsc-fixture");
  });
});

describe("gsc-weekly-snapshot CLI", () => {
  it("fixture mode prints a pack and exits 0", () => {
    const r = spawnSync(process.execPath, [cli, "--fixture"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GSC_SERVICE_ACCOUNT_JSON: "", GSC_ACCESS_TOKEN: "" },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^## SEO Optimize pack/);
    assert.doesNotMatch(r.stdout, /\[SKIP-PRD\]/);
    assert.match(r.stdout, /phish setlist game/);
    assert.match(r.stderr, /\(dry\) Pass --write/);
  });

  it("live mode without credentials SKIP-exits 0 (fork-safe)", () => {
    const r = spawnSync(process.execPath, [cli], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GSC_SERVICE_ACCOUNT_JSON: "",
        GSC_ACCESS_TOKEN: "",
        GOOGLE_APPLICATION_CREDENTIALS: "",
      },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /^SKIP: no live GSC credentials/);
  });

  it("refuses --post --fixture", () => {
    const r = spawnSync(process.execPath, [cli, "--fixture", "--post"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Refusing --post with --fixture/);
  });
});

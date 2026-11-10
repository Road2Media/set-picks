/**
 * Pure helpers for weekly GSC + GA4 organic SEO packs (#932 / epic #926).
 *
 * Facts only — never invent impressions/clicks/position. Never scrape SERP HTML.
 * Tour-stats surfaces stay aggregates-only (no full night setlists).
 */

export const SEO_EPIC = 926;
export const SEO_CHILD = 932;
export const DEFAULT_SITE_URL = "https://www.setlistpickem.com/";
export const DEFAULT_GA4_PROPERTY = "527619709";
export const DEFAULT_TZ = "America/Denver";
export const KEYWORD_LANDING_PATH = "/phish-setlist-prediction-game";
export const TOUR_STATS_PREFIX = "/tour-stats";
export const GATED_PHISH_PICKS_PATH = "/phish-picks";
export const TOP_NEW_QUERY_LIMIT = 15;
export const GSC_QUERY_ROW_LIMIT = 250;

export const GSC_READONLY_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const GA4_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function hasLiveGscCredentials(env = process.env) {
  return Boolean(
    String(env.GSC_SERVICE_ACCOUNT_JSON || "").trim() ||
      String(env.GSC_ACCESS_TOKEN || "").trim() ||
      String(env.GOOGLE_APPLICATION_CREDENTIALS || "").trim(),
  );
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLandingPath(raw) {
  let s = String(raw || "").trim();
  if (!s || s === "(not set)" || s === "(other)") return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return "";
    }
  }
  const q = s.indexOf("?");
  if (q >= 0) s = s.slice(0, q);
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/**
 * Organic landings we measure: /tour-stats* and the keyword page.
 * Never /phish-picks (gated #975).
 *
 * @param {string} raw
 * @returns {boolean}
 */
export function isSeoOrganicLanding(raw) {
  const p = normalizeLandingPath(raw);
  if (!p || p === GATED_PHISH_PICKS_PATH) return false;
  if (p === KEYWORD_LANDING_PATH) return true;
  return p === TOUR_STATS_PREFIX || p.startsWith(`${TOUR_STATS_PREFIX}/`);
}

/**
 * @param {Date} now
 * @param {string} [timeZone]
 * @returns {string} YYYY-MM-DD
 */
export function calendarDateInTz(now, timeZone = DEFAULT_TZ) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/**
 * @param {string} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
export function addDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * ISO Monday on or before ymd.
 * @param {string} ymd
 * @returns {string}
 */
export function mondayOnOrBefore(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 Sun … 1 Mon
  const back = dow === 0 ? 6 : dow - 1;
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

/**
 * Last-7-complete-days window (yesterday inclusive), matching GA4 7daysAgo→yesterday.
 *
 * @param {Date} [now]
 * @param {string} [timeZone]
 */
export function last7dWindow(now = new Date(), timeZone = DEFAULT_TZ) {
  const runDate = calendarDateInTz(now, timeZone);
  const endDate = addDaysYmd(runDate, -1);
  const startDate = addDaysYmd(endDate, -6);
  return {
    runDate,
    startDate,
    endDate,
    weekStarting: mondayOnOrBefore(startDate),
    window: "last_7_days",
    timeZone,
  };
}

/**
 * @param {{ queries?: Array<{ id?: string, query?: string, targetPath?: string, intent?: string, priority?: string }> }} registry
 */
export function assertRegistryShape(registry) {
  if (!registry || !Array.isArray(registry.queries)) {
    throw new Error("query-registry.json missing queries[]");
  }
  for (const row of registry.queries) {
    if (!row?.id || !row?.query) {
      throw new Error("query-registry row missing id or query");
    }
    if (row.targetPath === GATED_PHISH_PICKS_PATH) {
      throw new Error(`${row.id} must not target ${GATED_PHISH_PICKS_PATH}`);
    }
  }
  return registry;
}

/**
 * @param {Array<{ id: string, query: string, targetPath?: string, intent?: string, priority?: string }>} registryQueries
 * @returns {Map<string, object>}
 */
export function indexRegistryByNormalizedQuery(registryQueries) {
  const map = new Map();
  for (const row of registryQueries) {
    const key = normalizeQuery(row.query);
    if (key) map.set(key, row);
  }
  return map;
}

/**
 * @param {Array<{ query: string, impressions?: number|null, clicks?: number|null, ctr?: number|null, position?: number|null }>} gscRows
 * @param {Array<{ id: string, query: string, targetPath?: string, intent?: string, priority?: string }>} registryQueries
 */
export function matchRegistryToGsc(gscRows, registryQueries) {
  const byNorm = indexRegistryByNormalizedQuery(registryQueries);
  const seenIds = new Set();
  const matched = [];
  const unmatched = [];

  for (const row of gscRows || []) {
    const key = normalizeQuery(row.query);
    const reg = byNorm.get(key);
    if (reg) {
      seenIds.add(reg.id);
      matched.push({
        id: reg.id,
        query: reg.query,
        targetPath: reg.targetPath || "",
        intent: reg.intent || "",
        priority: reg.priority || "",
        impressions: numOrNull(row.impressions),
        clicks: numOrNull(row.clicks),
        ctr: numOrNull(row.ctr),
        position: numOrNull(row.position),
      });
    } else if (key) {
      unmatched.push({
        query: String(row.query || "").trim(),
        impressions: numOrNull(row.impressions),
        clicks: numOrNull(row.clicks),
        ctr: numOrNull(row.ctr),
        position: numOrNull(row.position),
      });
    }
  }

  const registry = registryQueries.map((reg) => {
    const hit = matched.find((m) => m.id === reg.id);
    if (hit) return hit;
    return {
      id: reg.id,
      query: reg.query,
      targetPath: reg.targetPath || "",
      intent: reg.intent || "",
      priority: reg.priority || "",
      impressions: null,
      clicks: null,
      ctr: null,
      position: null,
    };
  });

  return { registry, unmatched, seenIds };
}

/**
 * @param {Array<{ query: string, impressions?: number|null, clicks?: number|null, position?: number|null }>} unmatched
 * @param {number} [limit]
 */
export function topNewQueries(unmatched, limit = TOP_NEW_QUERY_LIMIT) {
  return [...(unmatched || [])]
    .filter((row) => normalizeLandingPath(row.query) !== GATED_PHISH_PICKS_PATH)
    .sort((a, b) => {
      const imp = (b.impressions ?? -1) - (a.impressions ?? -1);
      if (imp !== 0) return imp;
      return (b.clicks ?? -1) - (a.clicks ?? -1);
    })
    .slice(0, limit);
}

/**
 * @param {Array<{ landingPage?: string, sessions?: number|null, totalUsers?: number|null, channel?: string }>} rows
 */
export function filterOrganicLandings(rows) {
  return (rows || [])
    .map((row) => ({
      landingPage: normalizeLandingPath(row.landingPage),
      sessions: numOrNull(row.sessions),
      totalUsers: numOrNull(row.totalUsers),
      channel: row.channel || "Organic Search",
    }))
    .filter((row) => isSeoOrganicLanding(row.landingPage));
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function numOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number|null|undefined} n
 * @param {number} [digits]
 */
export function formatMetric(n, digits = 1) {
  if (n === null || n === undefined) return "unknown";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

/**
 * @param {{
 *   weekStarting: string,
 *   loggedAt: string,
 *   source: string,
 *   property: string,
 *   window: string,
 *   site: { impressions: number|null, clicks: number|null, ctr: number|null, avgPosition: number|null },
 *   queries: Array<object>,
 *   newQueries?: Array<object>,
 *   ga4Organic?: { propertyId?: string, rows?: Array<object>, status?: string },
 *   notes?: string,
 * }} log
 */
export function buildWeeklyLogObject(log) {
  return {
    weekStarting: log.weekStarting,
    loggedAt: log.loggedAt,
    source: log.source,
    property: log.property,
    window: log.window || "last_7_days",
    site: log.site,
    queries: log.queries,
    newQueries: log.newQueries || [],
    ga4Organic: log.ga4Organic || { status: "unknown", rows: [] },
    serpSpotCheck: {
      faviconOnSiteSearch: null,
      aiOverviewCitation: null,
      notes: "Manual spot-check only. Do not scrape Google/Bing SERP HTML.",
    },
    notes: log.notes || "",
  };
}

/**
 * @param {{
 *   runDate: string,
 *   startDate: string,
 *   endDate: string,
 *   weekStarting: string,
 *   source: string,
 *   siteUrl: string,
 *   site: { impressions: number|null, clicks: number|null, ctr: number|null, avgPosition: number|null },
 *   registryRows: Array<object>,
 *   newQueries: Array<object>,
 *   ga4: { propertyId?: string, status: string, rows?: Array<object>, note?: string },
 *   credentialNote?: string,
 * }} p
 */
export function buildPackMarkdown(p) {
  const site = p.site || {};
  const registryRows = p.registryRows || [];
  const newQueries = p.newQueries || [];
  const ga4Rows = p.ga4?.rows || [];
  const appeared = registryRows.filter((r) => r.impressions != null);
  const missing = registryRows.filter((r) => r.impressions == null);

  const registryTable = [
    "| id | query | impressions | clicks | position | targetPath |",
    "|----|-------|------------:|-------:|---------:|------------|",
    ...registryRows.map(
      (r) =>
        `| ${r.id} | ${escapeMdCell(r.query)} | ${formatMetric(r.impressions, 0)} | ${formatMetric(r.clicks, 0)} | ${formatMetric(r.position)} | \`${r.targetPath || ""}\` |`,
    ),
  ].join("\n");

  const newTable =
    newQueries.length === 0
      ? "_No non-registry queries in this GSC pull (or fixture had none)._"
      : [
          "| query | impressions | clicks | position |",
          "|-------|------------:|-------:|---------:|",
          ...newQueries.map(
            (r) =>
              `| ${escapeMdCell(r.query)} | ${formatMetric(r.impressions, 0)} | ${formatMetric(r.clicks, 0)} | ${formatMetric(r.position)} |`,
          ),
        ].join("\n");

  const ga4Table =
    p.ga4?.status !== "ok" || ga4Rows.length === 0
      ? `_GA4 organic landings: ${p.ga4?.status || "unknown"}${p.ga4?.note ? ` — ${p.ga4.note}` : ""}_`
      : [
          "| landingPage | sessions | totalUsers |",
          "|-------------|---------:|-----------:|",
          ...ga4Rows.map(
            (r) =>
              `| \`${r.landingPage}\` | ${formatMetric(r.sessions, 0)} | ${formatMetric(r.totalUsers, 0)} |`,
          ),
        ].join("\n");

  const agentPrompt = `Using docs/SEO_OPTIMIZE_AUTONOMY.md, docs/SEO_GEO_PLAYBOOK.md §4,
docs/seo/query-registry.json, and this facts pack, run SEO Optimize for
goal query_coverage covering the last 7 complete days. Post a scored pack
on #926. Open a draft PR to staging only if scored DRAFT_PR
(seoRoutes titles, FAQ, llms, H2s). Never merge, never deploy, never scrape
Google/Bing SERP HTML, never add /phish-picks, never publish full night
setlists (aggregates only on /tour-stats). If #933 gap briefs are missing,
Ingest competitor title/H1 gaps from
content/marketing/933-competitor-title-h1-gap-brief.md (do not invent titles).`;

  return `## SEO Optimize pack — ${p.runDate} (window: last 7 days)

**Epic:** #${SEO_EPIC} · **Child:** #${SEO_CHILD} · **Registry:** \`docs/seo/query-registry.json\`  
**Source:** \`${p.source}\` · **GSC property:** \`${p.siteUrl}\`  
**Dates:** \`${p.startDate}\` → \`${p.endDate}\` (week starting \`${p.weekStarting}\`)  
**GA4 property:** \`${p.ga4?.propertyId || DEFAULT_GA4_PROPERTY}\` (organic landings only; same Optimize property as \`crew/scripts/ga4_snapshot.py\`)

This comment is a **facts pack**, not a merge or deploy. Agents draft only. The scheduled Action never opens PRs.

### Policy

- Aggregates only on \`/tour-stats*\` (never full night setlists)
- No Google/Bing SERP HTML scraping
- No paid links
- No \`/phish-picks\` route (C7 stays on \`${KEYWORD_LANDING_PATH}\`)

### Site totals (GSC)

| impressions | clicks | CTR | avg position |
|------------:|-------:|----:|-------------:|
| ${formatMetric(site.impressions, 0)} | ${formatMetric(site.clicks, 0)} | ${formatCtr(site.ctr)} | ${formatMetric(site.avgPosition)} |

Registry queries with GSC rows this window: **${appeared.length}** / ${registryRows.length}. Still missing: ${
    missing.length ? missing.map((r) => r.id).join(", ") : "_none_"
  }.

### Registry queries

${registryTable}

### Top new queries (not in registry)

${newTable}

### GA4 organic landings (\`/tour-stats*\` + \`${KEYWORD_LANDING_PATH}\`)

${ga4Table}

### Agent prompt (Cloud Agent / Cursor)

\`\`\`text
${agentPrompt}
\`\`\`

### Ask for PM / EiC

- [ ] Review S-cluster + C6/C7 coverage vs this week's impressions
- [ ] Approve any draft copy PR to **staging** (never merge from this pack)
- [ ] Manual SERP favicon / AI Overview spot-check (visual only — no HTML scrape)

${p.credentialNote ? `### Credential note\n\n${p.credentialNote}\n` : ""}`;
}

/**
 * @param {number|null|undefined} ctr
 */
export function formatCtr(ctr) {
  if (ctr === null || ctr === undefined) return "unknown";
  const pct = ctr > 1 ? ctr : ctr * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * @param {string} value
 */
function escapeMdCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Normalize a fixture or live payload into pack + log inputs.
 *
 * @param {object} fixture
 * @param {{ queries: Array<object> }} registry
 * @param {{ runDate?: string, startDate?: string, endDate?: string, weekStarting?: string }} [window]
 */
export function assembleSnapshot(fixture, registry, window = {}) {
  assertRegistryShape(registry);
  const site = {
    impressions: numOrNull(fixture.site?.impressions),
    clicks: numOrNull(fixture.site?.clicks),
    ctr: numOrNull(fixture.site?.ctr),
    avgPosition: numOrNull(fixture.site?.avgPosition),
  };
  const gscRows = Array.isArray(fixture.queries) ? fixture.queries : [];
  const { registry: registryRows, unmatched } = matchRegistryToGsc(
    gscRows,
    registry.queries,
  );
  const newQueries = topNewQueries(
    Array.isArray(fixture.newQueries) ? fixture.newQueries : unmatched,
  );
  const ga4Status = fixture.ga4?.status || (fixture.ga4?.rows ? "ok" : "unknown");
  const ga4Rows = filterOrganicLandings(fixture.ga4?.rows || []);

  return {
    site,
    registryRows,
    newQueries,
    ga4: {
      propertyId: fixture.ga4?.propertyId || DEFAULT_GA4_PROPERTY,
      status: ga4Status,
      rows: ga4Rows,
      note: fixture.ga4?.note || "",
    },
    window: {
      runDate: window.runDate || fixture.runDate || "",
      startDate: window.startDate || fixture.startDate || "",
      endDate: window.endDate || fixture.endDate || "",
      weekStarting: window.weekStarting || fixture.weekStarting || "",
    },
    source: fixture.source || "gsc-fixture",
    siteUrl: fixture.property || fixture.siteUrl || DEFAULT_SITE_URL,
  };
}

# SEO query registry + weekly log

**Epic:** #926 · **E0:** #931 · **E1:** #932 · **E3:** #934  
**Ops playbook:** [`docs/SEO_GEO_PLAYBOOK.md`](../SEO_GEO_PLAYBOOK.md) §4  
**Scored tune loop:** [`docs/SEO_OPTIMIZE_AUTONOMY.md`](../SEO_OPTIMIZE_AUTONOMY.md)  
**Canonical host:** `https://www.setlistpickem.com`

Machine-readable fan-intent IDs live in **[`query-registry.json`](./query-registry.json)**. Optimize packs and GSC pulls must key off those IDs — do not invent parallel Markdown tables.

**#932 (E1)** automates last-7d GSC + GA4 organic → an SEO Optimize **facts** pack on #926.  
**#934 (E3)** is the agent-driven scored loop on top of that pack (`DRAFT_PR` / `REQUEST_INDEX` / `OFFSITE_SHARE` / `WAIT_EVIDENCE` / `NOOP`). Copy-paste prompt + template: [`docs/SEO_OPTIMIZE_AUTONOMY.md`](../SEO_OPTIMIZE_AUTONOMY.md). No weekly Action opens PRs.

```bash
# Fixture / dry-run (no network, no #926 comment)
npm run seo:gsc-weekly-snapshot -- --fixture
npm run test:seo-gsc-snapshot

# Live pull (needs GSC_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)
npm run seo:gsc-weekly-snapshot -- --write
npm run seo:gsc-weekly-snapshot -- --write --post   # comment on #926
```

Workflow: `.github/workflows/seo-gsc-weekly-schedule.yml` (`workflow_dispatch` + Monday cron). Posts only when live credentials exist; otherwise SKIP (fork-safe). Secrets and human SA steps: playbook §4. Manual GSC UI pulls remain valid if the secret is not set yet.

## Policy (do not violate)

- Tour Insights pages are **aggregates only** (most played, bustouts, gaps). Never publish full night setlists.
- No Google/Bing SERP HTML scraping. Spot-checks are visual / URL Inspection only.
- No paid links, PBNs, or scraped directories.
- No `/phish-picks` route (gated #975). C7 targets `/phish-setlist-prediction-game`.

## Registry

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Stable forever once used in a log (B1, C6, S4, …). |
| `query` | yes | One primary string per row. Variants go in `notes`. |
| `intent` | yes | `stats` \| `game` \| `brand` \| `geo` |
| `targetPath` | yes | Site path only (`/tour-stats/2026-summer-tour`), not a full URL. |
| `priority` | yes | `P0` \| `P1` \| `P2` |
| `notes` | yes | Variants, policy, related issues. |

Target paths in this seed: keyword `/phish-setlist-prediction-game`, hub `/tour-stats`, summer `/tour-stats/2026-summer-tour`, brand `/`.

Add/remove rows as pages ship; **keep IDs stable**. Prefer a new id over redefining an old query.

## Weekly append-only log (`crew/output/seo/`)

`crew/output/` is **gitignored**. Do not commit snapshots, CSVs, or JSONL dumps.

### After a GSC pull (local or cloud agent)

1. Search Console → Performance → **last 7 days** → Totals (impressions, clicks, CTR, avg position). Use the **www** property / www URLs.
2. Performance → Queries: look up registry ids (at least C1, C6, C7, S1, S3, plus S4–S7 after summer reindex). Record impressions / clicks / position when GSC shows the query; leave `null` when it does not appear.
3. Optional: export the Queries CSV to your machine. **Do not** commit it.
4. Write (or append) under `crew/output/seo/` — create the directory if needed:

```bash
mkdir -p crew/output/seo
```

**Canonical machine file:** `crew/output/seo/weekly-log.jsonl`  
Append **one JSON object per week**. Never rewrite or delete earlier lines.

```bash
# Example: append a filled clone of the committed template
# (edit the object first — do not append empty nulls as a “week”).
cat docs/seo/weekly-log.example.json >> crew/output/seo/weekly-log.jsonl
printf '\n' >> crew/output/seo/weekly-log.jsonl
```

Optional dated copy for humans: `crew/output/seo/YYYY-MM-DD.json` (same object as that week’s JSONL line).

5. After a **live** script run (`--write`), the JSONL line is already appended. Copy site totals from the pack (or playbook §4 archive table if the Action has not posted yet).
6. Live `--post` (or the weekly Action) comments the pack on #926. Do not paste full GSC exports. Fixture mode must never `--post`.

### Cadence

Sunday or Monday, matching playbook §4. One row per week starting date (`weekStarting`, ISO date of that Monday).

### Optional post-show intent refresh

When public tour-stats / `comms_show_context` shows a notable bustout, you may append a **same-week note** (or a second JSONL object with `"source": "post-show"`) calling out S3/S4/S5 — still aggregates only, still no SERP scrape. Do not add a new registry id for a one-night song name.

### Schema (log object)

See [`weekly-log.example.json`](./weekly-log.example.json). Required keys: `weekStarting`, `source`, `site`, `queries` (array of `{ id, impressions, clicks, position }`). `source` is `gsc-api` for the Action, `gsc-fixture` for dry-run, or `gsc-manual` for a UI pull.

`queries[].id` **must** match `query-registry.json`. Unknown ids are a procedure bug, not a new keyword.

## What not to do

- Do not commit `crew/output/seo/**`.
- Do not scrape SERPs or competitor HTML here. Competitor title/H1 briefs are #933 — allowlist + refuse in `crew/knowledge/allowlists/domains.md`; scanner `python3 -m crew.scripts.seo_title_h1_scan`; durable brief `content/marketing/933-competitor-title-h1-gap-brief.md`.
- Do not treat empty playbook §4 cells as the registry — this JSON is the source of IDs.
- Do not claim a Vercel preview “works” from curl (401). Do not claim Safari/WebKit verified without human evidence.

## Check

```bash
npm run test:seo-query-registry
npm run test:seo-gsc-snapshot
```

Registry: required ids (C1, C6, C7, S1, S3) plus the #931 fan strings. Snapshot: fixture pack + fork-safe SKIP when credentials are missing.

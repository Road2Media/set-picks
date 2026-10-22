# SEO / GEO playbook

**Purpose:** Ops + measurement checklist for epic [#657](https://github.com/pat792/set-picks/issues/657) so organic and generative findability work is observable.  
**Canonical host:** `https://www.setlistpickem.com` (apex `setlistpickem.com` **308 → www**; do not expect apex to index).  
**Related:** Child **G** [#664](https://github.com/pat792/set-picks/issues/664).

---

## 1. Properties & surfaces

| Surface | URL / path | Notes |
|---------|------------|--------|
| Homepage | `https://www.setlistpickem.com/` | Canonical; social scrapers get OG shell via `middleware.js` + `og-home-html.mjs` (**not** Googlebot — see #658) |
| How it works | `/how-it-works` | In `public/sitemap.xml` |
| Scoring | `/how-scoring-works` | In `public/sitemap.xml` |
| About | `/about` | **v1.56.0 (#941):** origin story; in `public/sitemap.xml` |
| Keyword landing | `/phish-setlist-prediction-game` | In `public/sitemap.xml` (#660 / #940) |
| Sitemap | `/sitemap.xml` | Listed in `robots.txt` |
| LLM / agent brief | `/llms.txt` | Static marketing summary + name variants + archive disambiguation (#661). **#930:** Tour Insights definitions (unique / frequency / 30+ bustouts) + summer deep link. |
| SEO config | `src/shared/config/seo.js` | Titles, description, OG image version — sync via `npm run verify:seo-strings` (#663) |
| Helmet + JSON-LD | `src/features/landing/ui/LandingSeo.jsx` | Client source of truth for browsers; homepage FAQ/HowTo also in prerender HTML |
| Public profiles | `/user/:userId` | **`noindex,follow`** (#661) — not sitemap targets |
| Dashboard | `/dashboard/*` | **Private** — `robots.txt` Disallow; never prerender for crawlers |
| Tour Insights | `/tour-stats`, `/tour-stats/:slug` | Product `_index` + docs **auto-update** nightly (filter / hub). **SEO prerender** auto-expands `/tour-stats/{slug}` + sitemap/`llms` on the next production build when the thin-page gate passes (**#959** / v1.63.0). Static opt-in seed: Sphere + `2026-summer-tour` in `seoRoutes.js`. See §1.1. |

**Search Console:** Prefer a **Domain** property (`setlistpickem.com`) or the **URL-prefix** property for `https://www.setlistpickem.com/`. When inspecting, always use **www** URLs. Apex showing “Page with redirect” is expected and healthy.

### 1.1 Product `_index` vs SEO auto-expand (#959)

Two different “auto” layers — do not conflate them.

| Layer | What updates | Gate | Who |
|-------|--------------|------|-----|
| Product `_index` | `public_tour_stats/_index` + per-slug docs; public filter / hub “current tour” | Through-today shows exist (nightly refresh) | Cloud Functions |
| SEO auto-expand | Prerender HTML under `dist/tour-stats/{slug}/`, `dist/sitemap.xml`, `dist/llms.txt` | `showsWithSetlist ≥ 4` **and** `uniqueSongs ≥ 20` **and** `lastShowDate` in the current UTC year. Does **not** expand on the first empty night. | Next production `vite build` + `prerender-seo.mjs` |
| GSC Request indexing | One-time nudge for hub, summer slug, and `/llms.txt` | Human judgment after `main` is READY | Human — **not** automated. Sitemap `<lastmod>` (#930) is the ongoing recrawl signal for `/tour-stats` URLs only. |

Constants live in `scripts/lib/tourStatsSeoAutoExpand.mjs` (`TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST = 4`, `TOUR_STATS_SEO_MIN_UNIQUE_SONGS = 20`). First-wave allowlist is the current-year `lastShowDate` rule (plus optional `TOUR_STATS_SEO_ALLOWLIST`).

**Rollback / kill-switch** (Vercel build env, then rebuild):

- `TOUR_STATS_SEO_AUTO_EXPAND=0` — skip all auto slugs; static `seoRoutes.js` opt-in (Sphere + Summer) still prerenders.
- `TOUR_STATS_SEO_DENYLIST=bad-slug` — block one shipped slug.
- `TOUR_STATS_SEO_ALLOWLIST=slug-a,slug-b` — only those slugs may auto-expand (still gated).

Do **not** scrape Google/Bing SERP HTML. Do **not** add `/phish-picks`. Aggregates only — never full night setlists.

---

## 2. After each SEO deploy — reindex cadence

Run this after Child A / B / H1 / **D** (and any PR that changes public crawl HTML, sitemap, robots, or `llms.txt`):

1. Confirm Vercel **production** is READY on `main`.
2. Smoke with curl (no browser JS required for middleware / static tags):

```bash
# Search bot → SPA shell (favicons + non-empty body). Must NOT be empty <body></body> OG-only.
curl -sA 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' \
  'https://www.setlistpickem.com/' | head -c 2500

# Social scraper → minimal OG shell (empty body OK; favicon links present after #658).
curl -sA 'facebookexternalhit/1.1' 'https://www.setlistpickem.com/' | head -c 1500

npm run verify:og-home
```

3. Search Console → **URL Inspection** → `https://www.setlistpickem.com/` (and each new public route). **Child D (#930) after promote:** also inspect the hub, summer slug, and LLM brief:
   - `https://www.setlistpickem.com/tour-stats`
   - `https://www.setlistpickem.com/tour-stats/2026-summer-tour`
   - `https://www.setlistpickem.com/llms.txt`
4. **Test live URL** → confirm favicons / title / body (or prerendered content once #659 ships).
5. **Request indexing** on each changed URL. **#930 ops AC (human):** request indexing on the three URLs above after `main` is READY. Use the **Domain** property `sc-domain:setlistpickem.com` (#1138, live 2026-10-21). Inspect **www** URLs inside that property. The reporting service account is Restricted and cannot press this button; this repo does not call a reindex API.
6. If sitemap changed: Sitemaps → confirm `https://www.setlistpickem.com/sitemap.xml` (re-submit only if GSC shows a durable error; “Temporary processing error” is usually transient). From the #930 build onward, `dist/sitemap.xml` stamps `<lastmod>` on `/tour-stats` and each prerendered `/tour-stats/{slug}` from that slug’s `public_tour_stats.lastShowDate` (hub = newest of those dates). Google ignores `<changefreq>`. `/llms.txt` is not in the sitemap, so step 5 is still required for that file. Do not stamp `writtenAt` — the nightly refresh rewrites it even when the show list did not change.
7. Log the date in §4 weekly table (notes column).

**Do not** request indexing on apex `https://setlistpickem.com/` — it redirects.

### Child A status (2026-07-19)

| Step | Status |
|------|--------|
| #658 shipped (`1.31.1`, tag `v1.31.1`) | Done |
| Googlebot curl → SPA shell | Done |
| www URL indexed in GSC | Done (“URL is on Google”) |
| Request indexing after deploy | Done (2026-07-19) |

GSC live-test console noise (CSP Report-Only, service worker reject, reCAPTCHA storage) is **not** an indexing failure — see `docs/SECURITY_HEADERS.md`.

---

## 3. Baseline query set

Track these weekly in Search Console (Performance → Queries) and spot-check SERPs / AI Overviews.

**Strategy (own / bridge / compete / concede):** [`content/marketing/pickem-search-plan-2026-08.md`](../content/marketing/pickem-search-plan-2026-08.md) — EiC-approved Pick'em search plan (epic #972, tracking #970). Machine-readable registry lands under #931 (sibling; not this PR).

### Brand / navigational

| ID | Query |
|----|--------|
| B1 | `setlist pick'em` / `setlist pickem` |
| B2 | `setlistpickem` |
| B3 | `setlist pick em phish` |

### Category / intent

| ID | Query |
|----|--------|
| C1 | `phish setlist game` |
| C2 | `setlist prediction game` / `predicting setlists` |
| C3 | `phish pick em` / `phish pick'em` / `setlist picks game` |
| C4 | `live setlist prediction` |
| C5 | `fantasy setlist` / `fantasy setlists` / `phish fantasy setlist` |
| C6 | `phish setlist prediction` |
| C7 | `phish picks` / `phish setlist picks` |

**Keyword landing (#660 / #973):** `/phish-setlist-prediction-game` — definitional page targeting C1–C7; disambiguates prediction / fantasy setlist game vs setlist archives; jam-band framing with Phish as exemplar. C6/C7 are **bridge** queries (see search plan) — this URL only; no `/phish-picks` doorway. Title/H1/FAQ shipped in #973.

### Stats-intent (after #665 public `/tour-stats`)

| ID | Query | Target path |
|----|--------|-------------|
| S1 | `phish tour stats` / `phish tour setlist stats` | `/tour-stats` |
| S2 | `phish song frequency [tour year]` (e.g. summer 2026) | `/tour-stats/2026-summer-tour` |
| S3 | `phish bustouts` / `phish bustouts [tour]` | `/tour-stats/2026-summer-tour` |
| S4 | `bustouts summer tour 2026` | `/tour-stats/2026-summer-tour` |
| S5 | `phish bustout list this tour` | `/tour-stats/2026-summer-tour` |
| S6 | `phish unique songs` / `unique songs played this tour` / `songs played this tour` | `/tour-stats/2026-summer-tour` |

Public surface: `/tour-stats` + `/tour-stats/:tourSlug` (kebab-case labels from Phish.net calendar ingest). **Aggregates only** — most played, bustouts, gap highlights; never full night setlists. Default tour: **current** (newest `lastShowDate`). Prerender hub + Sphere + **2026 Summer Tour** (`2026-summer-tour`) stay static opt-in; later tours that clear the §1.1 gate auto-prerender on the next production build (#959). Definitions in `/llms.txt` match the public UI: unique = distinct titles this tour; frequency = plays this tour; bustout = 30+ show pre-show gap.

**GEO / LLM brief (#930):** `/llms.txt` restates those three definitions and deep-links the summer slug so agents can cite the live tour page, not only home.

### SERP snapshot (2026-08, owner notes)

| Query | Position / note | Top competitors |
|-------|-----------------|-----------------|
| C1 `phish setlist game` | **Win** — gen AI + ~2nd SERP | — |
| C6 `phish setlist prediction` | Not top 10 | phishpicks.net, callingit.live |
| C7 `phish picks` | Not top 10 | phishpicks.net (IG → backlinks) |
| S1 `phish tour stats` | ~7th | ihoz.com, Phantasy Tour |
| S3 `phish bustouts` | Not top 10 | Reddit, live-music blogs, phish.net |

Re-spot-check these five whenever filling §4. Full game plan: search plan doc above. Do **not** scrape Google/Bing SERP HTML.

**Child E2 (#933):** allowlisted title/H1 scans — `python3 -m crew.scripts.seo_title_h1_scan` (or `npm run seo:title-h1-scan`). Allowlist + refuse: `crew/knowledge/allowlists/domains.md`. Durable brief: [`content/marketing/933-competitor-title-h1-gap-brief.md`](../content/marketing/933-competitor-title-h1-gap-brief.md). Homepage title/heading patterns only; no SERP HTML; no `/phish-picks`. Cadence: weekly with E1 (#932).

### Profile indexing policy (#661)

| Path | robots | Rationale |
|------|--------|-----------|
| `/user/:userId` | `noindex,follow` | Thin/PII risk; shareable links still work. Revisit only if a richer public player-card content bar ships. |

Do **not** add public profiles to `sitemap.xml`.

Add/remove rows as pages ship; keep IDs stable once used in the log.

---

## 4. Weekly measurement log (8+ weeks)

**Canonical after Child E1 #932:** the weekly **SEO Optimize pack** comment on epic #926, plus gitignored snapshots under `crew/output/seo/`. Do not treat empty Markdown cells in the archive table as the source of truth.

| Piece | Path |
|-------|------|
| Query IDs | [`docs/seo/query-registry.json`](seo/query-registry.json) (Child E0 #931) |
| Snapshot script | `npm run seo:gsc-weekly-snapshot` (`scripts/seo/gsc-weekly-snapshot.mjs`) |
| Fixture / dry-run | `npm run seo:gsc-weekly-snapshot -- --fixture` |
| Cron | `.github/workflows/seo-gsc-weekly-schedule.yml` — Monday `15:00` UTC (~09:00 America/Denver) |
| Epic comments | Workflow posts a `[SKIP-PRD]` facts pack on **#926** when live GSC credentials exist |
| Machine log | `crew/output/seo/weekly-log.jsonl` (gitignored — never commit) |
| Procedure | [`docs/seo/README.md`](seo/README.md) |

**Note:** GitHub `schedule` workflows run only from the repo **default branch** (`main`). Merge to `staging` first; cron becomes live after promote to `main`. Use `workflow_dispatch` (`live` or `fixture`) on the workflow file’s branch for earlier dry runs. `fixture` prints a pack and **never** comments on #926.

The Action does **not** merge, deploy, or open PRs. Child E3 scored loop: [`docs/SEO_OPTIMIZE_AUTONOMY.md`](./SEO_OPTIMIZE_AUTONOMY.md) (copy-paste Cloud Agent prompt; draft PR to `staging` only when scored `DRAFT_PR`).

### Secrets (human — never commit)

Live packs need a Search Console API principal with access to the **www** property. Optional GA4 organic landings reuse the existing Optimize property (**527619709**) and the same ADC / service-account style as `crew/scripts/ga4_snapshot.py` — do not stand up a second GA4 stack.

| Name | Where | Required for live post? | Purpose |
|------|--------|-------------------------|---------|
| `GSC_SERVICE_ACCOUNT_JSON` | GitHub Actions **secret** (repo Settings → Secrets) | **Yes** | Full service-account JSON (or WIF-equivalent ADC). Scopes: Search Console readonly; optionally Analytics Data readonly. |
| `GSC_SITE_URL` | optional Actions **variable** | No | Default `https://www.setlistpickem.com/`. Must match the GSC property the SA can read. |
| `GA4_PROPERTY_ID` | optional Actions **variable** | No | Default `527619709` (same as Optimize / `ga4_snapshot.py`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | local ADC path | Local live only | Alternative to pasting JSON; same SA file Optimize already uses is fine if it also has GSC access. |
| `GSC_ACCESS_TOKEN` | local / CI env | Local live only | Pre-minted bearer (`webmasters.readonly` + optionally `analytics.readonly`). |

**Human service-account steps (prod GSC — agent cannot complete):**

1. GCP project: enable **Search Console API** (`searchconsole.googleapis.com`) and, for GA4 organic, **Google Analytics Data API** (`analyticsdata.googleapis.com`) — the latter is already required for Optimize (`docs/GA4_MCP_SETUP.md`).
2. Create a service account (or reuse the Optimize SA). Create a JSON key **or** configure Workload Identity Federation for GitHub Actions (`google-github-actions/auth`) so no long-lived key sits in the repo.
3. Search Console → Settings → Users and permissions → add the SA email on the **URL-prefix** property `https://www.setlistpickem.com/` (or the Domain property `setlistpickem.com`) with at least **Restricted** / read access. Inspect **www** URLs only.
4. Optional: GA4 Admin → Property access management → **Viewer** on property `527619709` for the same SA (already used by Optimize).
5. Paste the JSON into repo secret `GSC_SERVICE_ACCOUNT_JSON`. Never commit the file, never put it in `docs/`, never echo it in logs.
6. Dispatch **SEO GSC weekly pack** → `live` and confirm a pack comment on #926. Until that human checkbox is done, use `--fixture` only.

Without `GSC_SERVICE_ACCOUNT_JSON` (forks, first enable), the workflow **SKIP**s with a clear log and stays green. It does **not** post a fixture pack to #926.

### Archive table (pre-E1)

Historical rows below stay for the 2026-07 baseline. Prefer the Action pack + `crew/output/seo/` after E1 credentials are live. Manual fallback: GSC → Performance → last 7 days → Totals, plus a spot-check of S4–S6 after summer reindex.

| Week starting | Impressions (site) | Clicks | Top query (non-brand) | Best position (C1–C4) | Favicon on `site:setlistpickem.com`? | AI Overview / generative citation? | Notes |
|---------------|--------------------:|-------:|------------------------|------------------------:|--------------------------------------|------------------------------------|-------|
| 2026-07-19 | 76 | 24 | _TBD_ | 5.7 (site avg) | **No** (globe) | _check_ | GSC Performance **last 3 months** (Web; through ~2026-07-17): CTR 31.6%, avg position 5.7. Child A live; www reindex requested. Tab favicon OK; SERP still generic globe → track #662 (expect 2–4 weeks post-#658; recheck weekly). Prefer last-7-days for later weekly rows. |
| 2026-07-26 | | | | | | | _gap — resume after Child D reindex_ |
| 2026-08-02 | | | | | | | |
| 2026-08-09 | | | | | | | A–C live on `main` (summer slug + crawler facts + fan H2s). |
| 2026-08-16 | | | | | | | |
| 2026-08-23 | | | | | | | |
| 2026-08-30 | | | | | | | **#930 resume week.** After promote: request indexing on hub + `/tour-stats/2026-summer-tour` + `/llms.txt`; fill last-7-days totals here. |
| 2026-09-06 | | | | | | | First full week after Child D reindex (if indexing landed 2026-09-02). |
| 2026-10-12 | 71 | 5 | `phish stats` and `setlist game` (2 impressions each; neither is a registry id) | unknown — C1–C4 had no GSC rows | _not in pack_ | _not in pack_ | Live pack on [#926](https://github.com/Road2Media/set-picks/issues/926#issuecomment-6324127195) (posted 2026-10-21). Window 2026-10-14 → 2026-10-20. CTR 7.0%, avg position 6.0. Registry queries with rows: **0 / 17**, including S4–S6. GA4 organic landing: `/tour-stats` 1 session. Property `sc-domain:setlistpickem.com`. |

**How to fill if the Action has not posted yet:** GSC → Performance → last 7 days → Totals (manual). Optional CSV stays on your machine. After #932 credentials are live, copy site totals from the #926 pack instead of this table. Machine log: append-only `crew/output/seo/weekly-log.jsonl` (gitignored).

**Favicon check:** Incognito Google → `site:setlistpickem.com` → note whether result icon appears (Child E #662 if still missing after ~2–4 weeks).

**AI / generative:** Spot-check ChatGPT / Gemini / Perplexity for C1–C2; note citation or “no mention.”

---

## 5. Off-site / backlink checklist

Honest citations beat spam. Prefer communities where the product already has context.

| Channel | Status | Action |
|---------|--------|--------|
| Reddit | Done (prior) | Don’t over-post; reply when relevant |
| Phish Discord / fan Discords | Open | Share after public stats (#665) if rules allow. **#930:** prefer the summer slug (UTM in §6), not only home. |
| Newsletter / email list | Open | Comms squad; UTM per §6 |
| phish.net / Mockingbird | Open | Attribution already in footer; cite when discussing data |
| Fan wikis / PT-adjacent forums | Open | Only with useful, non-spammy pages (how-it-works, scoring, public stats) |
| Personal / tour crew shares | Open | Invite links are product, not SEO — still use UTMs for measurement |

**Out of scope:** Buying links, PBNs, scraped directories.

---

## 6. Optional GA4 UTM conventions (backlink / organic posts)

When posting a public URL off-site:

| Param | Suggested values |
|-------|------------------|
| `utm_source` | `reddit`, `discord`, `newsletter`, `forum`, `manual` |
| `utm_medium` | `social`, `email`, `referral` |
| `utm_campaign` | `seo_geo` or epic-scoped (`seo_657`, **`seo_926`** for tour-stats GEO) |
| `utm_content` | short slug (`how-it-works`, `tour-stats-summer-2026`) |

Example (how-it-works / #657):

`https://www.setlistpickem.com/how-it-works?utm_source=reddit&utm_medium=social&utm_campaign=seo_657&utm_content=how-it-works`

Example (**#930** — share the **summer stats URL**, not only home, after a real bustout night):

`https://www.setlistpickem.com/tour-stats/2026-summer-tour?utm_source=discord&utm_medium=social&utm_campaign=seo_926&utm_content=tour-stats-summer-2026`

(`utm_campaign=seo_geo` is also valid; pick one and keep it consistent for the post.)

**Draft caption (not posted).** Re-read the public summer page before sending. Figures below are the public aggregates on 2026-10-22 (`public_tour_stats/2026-summer-tour`: 21 shows, 191 unique songs, 50 songs back after a 30+ show gap). One cited return already on that page: Melt the Guns, gap 2052, show date 2026-07-31. The current calendar tour is Fall (`2026-fall-tour`); #930 still asks for the **summer** URL.

> 2026 Summer Tour setlist stats: 191 unique songs across 21 shows, and 50 bustouts (songs back after a 30+ show gap). Melt the Guns returned July 31 after 2,052 shows.
> https://www.setlistpickem.com/tour-stats/2026-summer-tour?utm_source=discord&utm_medium=social&utm_campaign=seo_926&utm_content=tour-stats-summer-2026

**#930 ops AC (human):** this draft is not the acceptance check. After a person posts it, log the live post in this playbook §5 Status/Action, §9 checklist, **or** a comment on [#926](https://github.com/Road2Media/set-picks/issues/926) / [#930](https://github.com/Road2Media/set-picks/issues/930).

Optional future event: `organic_landing` (landing path + campaign) — only if product analytics needs it; not required for #664.

---

## 7. Agent / CI touchpoints

| Check | Command / file |
|-------|----------------|
| OG shell + social UA matrix | `npm run verify:og-home` (`scripts/verify-og-home.mjs`, `og-home-html.mjs`) |
| Prerender (#659 / #959) | `npm run verify:seo-prerender` (`scripts/prerender-seo.mjs` after build; static registry `src/shared/config/seoRoutes.js`; auto-expand gate `scripts/lib/tourStatsSeoAutoExpand.mjs`) |
| Automation context | `docs/GITHUB_AUTOMATION_CONTEXT.md` → Public landing SEO + SEO GSC weekly pack |
| GSC/GA4 weekly pack (#932) | `npm run seo:gsc-weekly-snapshot -- --fixture` · `npm run test:seo-gsc-snapshot` |
| SEO Optimize scored loop (#934) | [`docs/SEO_OPTIMIZE_AUTONOMY.md`](./SEO_OPTIMIZE_AUTONOMY.md) — follow-up comment on #926; no weekly “open PR” Action |

---

## 8. Ship order reminder (from #657 / #926)

1. ~~#658 Googlebot middleware~~ (shipped 1.31.1)
2. **#664** this playbook + GSC baseline (ops)
3. **#659** + **#665** prerender + public tour stats
4. **#660** / **#661** / **#662** / **#663**
5. **#666** enrichment after H1 is indexed
6. ~~#927 / #928 / #929~~ Children A–C (summer slug, crawler facts, fan H2s)
7. **#930** Child D — llms + this playbook (docs); GSC reindex + UTM share are **human ops after promote** (see §9)
8. **#931** Child E0 — query registry [`docs/seo/query-registry.json`](seo/query-registry.json)
9. **#932** Child E1 — GSC API + GA4 organic weekly Action → packs on #926 (this playbook §4 + `crew/output/seo/`). Human: add `GSC_SERVICE_ACCOUNT_JSON` + GSC property access before the first live pack.
10. **#933** Child E2 — allowlisted competitor title/H1 scan + [`content/marketing/933-competitor-title-h1-gap-brief.md`](../content/marketing/933-competitor-title-h1-gap-brief.md)
11. ~~#959~~ tour-stats SEO auto-expand (v1.63.0) — prerender/sitemap/`llms` from `_index` + gate; GSC Request indexing stays human
12. **#934** Child E3 — scored tune loop [`docs/SEO_OPTIMIZE_AUTONOMY.md`](./SEO_OPTIMIZE_AUTONOMY.md) (draft-only; no autonomous merge/deploy).

---

## 9. Child D ops checklist (#930)

Docs (llms + this playbook) ship in the product PR. The two remaining acceptance checks are **manual after `main` is READY** — they do not block the docs merge.

| Step | Owner | Status |
|------|--------|--------|
| `public/llms.txt` Tour Insights definitions + summer deep link | Agent | Done (#981) |
| Playbook §3 S4–S6 + §4 packs/secrets pointer (E0 #931 / E1 #932) | Agent | Done (#981). First live pack is the 2026-10-12 row in §4. |
| Sitemap `<lastmod>` on `/tour-stats` + prerendered slugs from `lastShowDate` | Agent | Done (#930) — ships in `dist/sitemap.xml` on the next production build. Does not index `/llms.txt`. |
| GSC URL Inspection + **Request indexing** on hub, `/tour-stats/2026-summer-tour`, `/llms.txt` | Human | **Open** — after this `lastmod` change is on `main`. Property `sc-domain:setlistpickem.com`. |
| ≥1 UTM’d off-site share of the **summer** URL (not only home) after a real bustout night; campaign `seo_geo` or `seo_926`, content `tour-stats-summer-2026` | Human | **Open** — §6 has a draft. Log the live post here or on #926 / #930. |

Do **not** request indexing on apex `https://setlistpickem.com/` or on `/tour-stats/summer-tour-2026` (that path 308s to the live slug).

### Human console steps (not done in git)

1. Wait until production `main` is READY and `https://www.setlistpickem.com/sitemap.xml` shows `<lastmod>` on the hub and `/tour-stats/2026-summer-tour`.
2. Search Console → property `sc-domain:setlistpickem.com` → URL Inspection → **Request indexing** on:
   - `https://www.setlistpickem.com/tour-stats`
   - `https://www.setlistpickem.com/tour-stats/2026-summer-tour`
   - `https://www.setlistpickem.com/llms.txt`
3. Post the §6 summer URL off-site (Discord or another channel the community rules allow). Paste the live post link on #930 or #926. Do not mark §9 done before that post exists.

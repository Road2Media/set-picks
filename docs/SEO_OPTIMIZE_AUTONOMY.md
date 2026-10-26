# SEO Optimize autonomy (draft-only tune loop)

**Epic:** #926  
**Child:** #934 (E3)  
**Status:** L1 playbook + copy-paste Cloud Agent prompt. Weekly **facts** packs already ship from Child E1 #932. This doc is the **editorial + scored-action** loop on top of those facts.  
**Mirror:** [`docs/comms-triggers/OPTIMIZE_AUTONOMY.md`](./comms-triggers/OPTIMIZE_AUTONOMY.md)  
**Does not replace:** the Monday GSC/GA4 Action (comment-only). This doc does **not** add an autonomous “open a PR every week” workflow.

---

## Kickoff

```text
Run SEO Optimize for goal <optimize_for> covering last 7 complete days
```

| Input | Examples |
|-------|----------|
| `optimize_for` | `stats_impressions` · `query_coverage` · `geo_citations` · `crawl_regressions` |
| Window | Last 7 complete days (same as E1: GSC `yesterday` inclusive) or a named Monday `weekStarting` |
| Constraints | Draft-only; PR base **`staging`**; never merge; never deploy; never scrape SERP HTML; never add `/phish-picks` |

Post the finished **scored pack** as a follow-up comment on **#926** (and link any draft PRs). The E1 Action’s facts pack is the measurement input — do not invent a second GSC pull format.

### Goal-input convention (`optimize_for`)

Pass exactly one primary goal string (snake_case). Optional secondary goals go in the pack **Recommendations** section, not the kickoff line.

| Value | Optimize for |
|-------|----------------|
| `stats_impressions` | Impressions / clicks / position on S-cluster (`S1`–`S7`) and `/tour-stats*` landings |
| `query_coverage` | Registry queries that still have `null` GSC rows (esp. S4–S6 after summer reindex) plus C6/C7 bridge |
| `geo_citations` | Generative / AI Overview citations of www URLs (`/llms.txt`, summer slug, keyword landing) |
| `crawl_regressions` | Googlebot HTML missing facts, sitemap/`lastmod` drift, prerender holes, 308 alias mistakes |

**Cloud Agent / on-demand prompt (copy-paste):**

```text
Using docs/SEO_OPTIMIZE_AUTONOMY.md, docs/SEO_GEO_PLAYBOOK.md §4,
docs/seo/query-registry.json, and the latest SEO Optimize facts pack on #926
(or npm run seo:gsc-weekly-snapshot -- --fixture if no live pack exists),
run SEO Optimize for goal query_coverage covering the last 7 complete days.
Produce the scored PM review pack template, post it on GitHub issue #926
with [SKIP-PRD] as the first line, open a draft PR to staging only if a
low-risk seoRoutes / FAQ / llms / H2 change is justified by GSC or
public_tour_stats facts, and never merge or deploy. Do not scrape
Google/Bing SERP HTML. Do not add /phish-picks. Aggregates only on
/tour-stats. Ingest competitor title/H1 gaps from
content/marketing/933-competitor-title-h1-gap-brief.md (and any dated
crew/output/intel/seo-gap-*.md). Do not invent competitor titles or
re-fetch omitted hosts.
```

Swap `query_coverage` / window as needed. First E3 pack: this playbook’s example (fixture GSC + #933 brief; no `DRAFT_PR`) posted on #926 when #934 merges.

---

## What already runs vs what an agent does

| Piece | Path | Role |
|-------|------|------|
| Query IDs | [`docs/seo/query-registry.json`](./seo/query-registry.json) | Stable keys — never invent parallel IDs |
| Facts snapshot | `npm run seo:gsc-weekly-snapshot` | Last-7d GSC + GA4 organic |
| Cron | `.github/workflows/seo-gsc-weekly-schedule.yml` | Monday `15:00` UTC; comments **facts only** on #926 |
| Machine log | `crew/output/seo/weekly-log.jsonl` (gitignored) | Append-only |
| Competitor title/H1 gaps | Child E2 #933 (shipped #993) — durable [`content/marketing/933-competitor-title-h1-gap-brief.md`](../content/marketing/933-competitor-title-h1-gap-brief.md); dated scans `crew/output/intel/seo-gap-{date}.md` | Title/H1/H2 only. Allowlist + refuse in `crew/knowledge/allowlists/domains.md`. If both are missing, score `WAIT_EVIDENCE` |
| This playbook | `docs/SEO_OPTIMIZE_AUTONOMY.md` | Scored actions + draft-PR rails |

**Note:** GitHub `schedule` workflows run only from the repo **default branch** (`main`). E1 cron becomes live after promote. `workflow_dispatch` (`live` or `fixture`) works on the workflow file’s branch. `fixture` never comments on #926.

### What the weekly Action does vs does not

| Does | Does not |
|------|----------|
| Pull last-7d GSC registry + top new queries | Open draft PRs or merge |
| Optional GA4 organic landings (`/tour-stats*` + keyword page) | Deploy, reindex, or request indexing |
| Post a `[SKIP-PRD]` **facts** pack on #926 when `GSC_SERVICE_ACCOUNT_JSON` is set | Scrape SERP HTML or competitor pages |
| SKIP (exit 0) when the secret is unset | Run this E3 scored loop itself |

**Human / Cloud Agent step after each facts pack:** run the copy-paste prompt above (or Leadership `optimize` with `optimize_for` from this table). Post the finished **scored pack** as a follow-up comment on #926.

There is **no** E3 cron that opens PRs. Prefer: E1 weekly comment + this doc + the prompt. A future comment-only kickoff (like `comms:optimize-kickoff`) may be added later; it must stay dry-run / comment-only.

---

## Cycle order (always)

```text
CDO facts → Marketing Specialist brief → (optional Market Intel #933) → EiC copy gate → GPM
```

| Step | Role | Does |
|------|------|------|
| 1 | **CDO** | Confirm GSC/GA4 numbers are real (live pack, fixture, or UI pull). Mark gaps `unknown`. |
| 2 | **Marketing Specialist** | Score actions; draft titles/FAQ/H2/`llms` copy if `DRAFT_PR`. |
| 3 | **Market Intel** | Only if #933 gap brief exists (allowlist title/H1/H2). Else `WAIT_EVIDENCE`. |
| 4 | **EiC** | Approve or reject **public** SEO surface copy before anyone merges. |
| 5 | **GPM** | Accept/reject recommendations; pick next `optimize_for`; never auto-merge. |

Agents **open draft PRs and pack comments only**. They do **not** auto-merge, auto-approve, production-deploy, or fire GSC “Request indexing” from a workflow.

---

## Leadership Crew RACI

| Work | A | R | C |
|------|---|---|---|
| SEO Optimize scored pack (#926 / #934) | Growth Program Manager | Marketing Specialist | EiC (public SEO copy), CDO (GSC/GA4/`public_tour_stats` facts) |
| Optional competitor gap ingest | CDO | Market Intelligence Operator (#933) | Marketing Specialist |
| Draft PR to `staging` (titles / FAQ / `llms` / H2s) | EiC (merge gate) | Marketing Specialist (opens **draft** PR) | GPM, CDO |

Canon table also lives in [`docs/LEADERSHIP_CREW.md`](./LEADERSHIP_CREW.md). Living org — propose adaptations there + epic #695.

---

## Data spine (facts only)

| Source | Path / doc | Use in SEO Optimize |
|--------|------------|---------------------|
| Query registry | `docs/seo/query-registry.json` | IDs, target paths, policy notes |
| GSC + GA4 facts | E1 pack on #926 · `npm run seo:gsc-weekly-snapshot` | Movers, coverage holes, organic landings |
| Public aggregates | `public_tour_stats` / `/tour-stats-data/{slug}.json` | Song names, unique counts, bustouts (30+), frequency — **never** full night setlists |
| SEO routes | `src/shared/config/seoRoutes.js` + `seo.js` | Titles, descriptions, FAQ JSON-LD, prerender H1/H2 paragraphs |
| LLM brief | `public/llms.txt` | GEO definitions + current-tour deep link |
| Sitemap | `public/sitemap.xml` | Listed URLs; stamp `lastmod` when HTML snapshots refresh |
| Competitor gaps | `content/marketing/933-competitor-title-h1-gap-brief.md` + optional `crew/output/intel/seo-gap-{date}.md` (**#933**) | Title/H1/H2 phrases only, allowlist hosts only |
| Search plan | `content/marketing/pickem-search-plan-2026-08.md` | Own / bridge / compete / concede |

**Composer rule:** every number in the pack comes from GSC, GA4, or `public_tour_stats`. Every competitor phrase comes from an allowlisted #933 brief. If the source is missing, write `WAIT_EVIDENCE` — do not invent SERP positions or rival H1s.

---

## Scored actions

Exactly one primary action per recommendation. Score from evidence, not vibes.

| Action | When | Agent may | Agent must not |
|--------|------|-----------|----------------|
| `DRAFT_PR` | Low-risk copy/metadata change is justified by GSC movers **or** crawlable `public_tour_stats` facts | Open a **draft** PR to **`staging`** only | Merge, deploy, or retarget `main` |
| `REQUEST_INDEX` | A listed www URL changed on production (`main` READY) or GSC shows Discovered / not indexed | Tell a **human** to URL-Inspect + Request indexing | Call GSC inspect/index APIs from this loop |
| `OFFSITE_SHARE` | A real bustout / unique-count night exists and the summer (or current-tour) URL is the honest cite | Draft a UTM’d share line (`utm_campaign=seo_926`) for EiC / Social | Buy links, spam Discords, or post without L2 social approval |
| `WAIT_EVIDENCE` | Live GSC secret unset, fixture-only week, #933 gap file missing, or sample too thin | Say what evidence is missing | Open a copy PR “just in case” |
| `NOOP` | Goal already healthy (e.g. C1 win) or change would add a doorway / night setlist | Log the hold | Expand routes or scrape SERPs |

### If `DRAFT_PR`

Allowed files (keep the marketing entry **Firebase-free**):

| Allowed | Forbidden |
|---------|-----------|
| `src/shared/config/seoRoutes.js` titles, descriptions, FAQ `mainEntity`, prerender H1/paragraphs (fan H2s) | New thin URLs / doorway farms / `/phish-picks` |
| `src/shared/config/seo.js` default title/description (with `verify:seo-strings`) | Full night setlists on `/tour-stats*` |
| `public/llms.txt` definitions + current-tour deep link | Merging the draft PR from this weekly loop |
| Public tour-stats fan H2/definition copy in `src/features/tour-stats/ui` (aggregates only) | Dashboard IA / `dashboardPageMeta.js` / `docs/DASHBOARD_IA.md` |
| `docs/seo/query-registry.json` **new** id (never redefine an old one) | SERP HTML scrape, off-allowlist fetch |
| Draft PR base **`staging`**, status **draft** | `gh pr merge`, `comms:deploy`, Vercel/Firebase deploy, Git tags |

The owner may later grant Cloud agents permission to merge a **specific** SEO copy PR after EiC review. That grant is **not** this weekly loop. Until then: draft PR + pack comment only.

---

## Persistence checklist

Run these on every scored pack (even `NOOP` / `WAIT_EVIDENCE`).

### Current-tour slug promotion

When the live calendar label changes (new tour with newest `lastShowDate` on `public_tour_stats/_index`):

1. Confirm the Firestore / CDN slug (kebab of the label, e.g. `2026-summer-tour`).
2. If the tour is worth ranking (not thin): add it to `TOUR_STATS_SEO_FACT_SLUGS` + `PRERENDER_ROUTES` in `seoRoutes.js`, `public/sitemap.xml`, `public/llms.txt`, and S-cluster `targetPath` rows that should follow the live tour.
3. Keep the previous live slug as an archive page (Sphere pattern). Do not delete ranked URLs.
4. Auto-expand of qualifying tours shipped in **v1.63.0** (#959 / #991). This checklist is the **current-tour promotion / archive** bar (llms deep link + S-cluster `targetPath`), not a second prerender pipeline.
5. Never SEO the 308 alias (`/tour-stats/summer-tour-2026`).

### Sitemap `lastmod`

`scripts/prerender-seo.mjs` stamps `<lastmod>` on `/tour-stats` and each prerendered `/tour-stats/{slug}` from `public_tour_stats.lastShowDate` (#930). The hub date is the newest of those slug dates. `public/sitemap.xml` in git stays the loc list without dates; `dist/sitemap.xml` is what production serves. Google ignores `<changefreq>` and `<priority>`.

1. Do not hand-stamp “today”, and do not use `writtenAt` (the nightly refresh rewrites it when the show list did not change).
2. Do not bump `lastmod` on unchanged legal/about/home URLs. The stamper only touches tour-stats locs it has a show date for.
3. `/llms.txt` is not in the sitemap — request index separately.
4. After promote: human URL-Inspect + Request indexing on the www URLs in playbook §9 (property `sc-domain:setlistpickem.com`). Re-submit the sitemap only if GSC shows a durable error.

---

## Hard rails

- **Allowlist scrape only** — `crew/knowledge/allowlists/domains.md`. Title/H1/H2 patterns; no full-setlist rip. Refuse Google/Bing SERP HTML, paywalled forums, PII, aggressive crawl rates.
- **Facts from `public_tour_stats` / GSC only** (GA4 organic landings are the optional third plane). No invented song lore.
- **Aggregates only** on `/tour-stats*`. Never publish full night setlists.
- **No doorway farms.** C6/C7 stay on `/phish-setlist-prediction-game`. No `/phish-picks` (gated #975).
- **EiC on public SEO copy** before a draft PR is marked ready or merged.
- Marketing entry stays **Firebase-free** (no Auth/App Check/SDK on prerender/marketing boot).
- Do not claim Safari / WebKit verified without human evidence. Do not claim a Vercel preview “works” (401 to curl).
- Do not touch Dashboard IA (`src/app/layout/`, `dashboardPageMeta.js`, `docs/DASHBOARD_IA.md`).

---

## PM review pack template (every cycle)

Agents **must** use this shape as a **follow-up** comment on #926 (facts pack from E1 stays as-is):

```markdown
[SKIP-PRD]

## SEO Optimize scored pack — <YYYY-MM-DD> (goal: <optimize_for>)

**Epic:** #926 · **Playbook:** `docs/SEO_OPTIMIZE_AUTONOMY.md`  
**Facts source:** live E1 pack | fixture | gsc-manual  
**Window:** `<start>` → `<end>` (week starting `<Monday>`)

### Summary
<2–3 sentences. Cite real numbers or write unknown.>

### GSC movers
| id | query | impressions | clicks | position | Δ vs prior | note |
|----|-------|------------:|-------:|---------:|------------|------|
| C1 | … | | | | | |

Site totals: impressions / clicks / CTR / avg position.

### Competitor gaps
<!-- Summarize `content/marketing/933-competitor-title-h1-gap-brief.md` + any dated `crew/output/intel/seo-gap-*.md`. If both missing: WAIT_EVIDENCE. -->
- Allowlisted peer (Jam Picks / phishpicks.net → phish.jampicks.com): title / H1 / meta vs C1–C7
- Omitted hosts: do not re-fetch; do not invent headings

### Scored actions
1. … → **DRAFT_PR** | **REQUEST_INDEX** | **OFFSITE_SHARE** | **WAIT_EVIDENCE** | **NOOP** → metric: …
2. …

### Draft changes
- PR(s): _none_ | `<draft PR number → staging>`
- Files: seoRoutes titles / FAQ / llms / H2s …

### Generative spot-checks (3 prompts)
Visual / chat only. Do **not** scrape SERP HTML. Record citation of a www URL or “no mention.”

1. Prompt: `What are the unique songs and bustouts on Phish 2026 Summer Tour?`  
   Result: …
2. Prompt: `Where can I play a free Phish setlist prediction game?`  
   Result: …
3. Prompt: `What does bustout mean for Phish this tour?`  
   Result: …

### Persistence
- [ ] Current-tour slug still matches `public_tour_stats` default / newest `lastShowDate`
- [ ] Sitemap `lastmod` stamped if prerender HTML refreshed this week
- [ ] No `/phish-picks`; no night setlists

### Ask for GPM / EiC
- [ ] Approve / request changes on draft PR(s) — merge is **not** part of this loop
- [ ] Accept / reject recommendations (log on #926)
- [ ] Pick `optimize_for` for next cycle
- [ ] Human: Request indexing on listed www URLs if `REQUEST_INDEX`
```

---

## Example pack (2026-09-03) — fixture GSC + #933 brief (`WAIT_EVIDENCE` on live metrics)

First E3 cycle. **No live GSC pack on #926 yet** (E1 Action SKIPs until a human adds `GSC_SERVICE_ACCOUNT_JSON`). Numbers below are from the committed fixture (`scripts/seo/fixtures/weekly-snapshot.fixture.json`). Competitor gaps come from `content/marketing/933-competitor-title-h1-gap-brief.md` (#993). **No `DRAFT_PR` opened.**

```markdown
[SKIP-PRD]

## SEO Optimize scored pack — 2026-09-03 (goal: query_coverage)

**Epic:** #926 · **Playbook:** `docs/SEO_OPTIMIZE_AUTONOMY.md`  
**Facts source:** fixture (`gsc-fixture`)  
**Window:** `2026-09-01` → `2026-09-07` (week starting `2026-09-01`)

### Summary
Fixture site totals: 128 impressions, 19 clicks, 14.8% CTR, avg position 8.4.
C1 (`phish setlist game`) looks healthy in the fixture (42 / 11 / pos 3.1).
S4–S7 and several S/C rows are null in this fixture — treat coverage holes as
unknown until a live E1 pack lands. No copy PR this week.

### GSC movers
| id | query | impressions | clicks | position | Δ vs prior | note |
|----|-------|------------:|-------:|---------:|------------|------|
| C1 | phish setlist game | 42 | 11 | 3.1 | n/a (fixture) | Defend; keyword landing |
| C6 | phish setlist prediction | 18 | 3 | 9.2 | n/a | Bridge; #973 already shipped |
| C7 | phish picks | 9 | 1 | 12.0 | n/a | Same URL; no /phish-picks |
| S1 | phish tour setlist stats | 7 | 2 | 6.5 | n/a | Hub |
| S3 | phish bustouts | 14 | 2 | 11.4 | n/a | Summer slug target |
| S4 | bustouts summer tour 2026 | — | — | — | — | Missing in fixture |
| S5 | bustout list this tour | — | — | — | — | Missing in fixture |
| S6 | unique songs played this tour | — | — | — | — | Missing in fixture |
| S7 | tour setlist stats | — | — | — | — | Missing in fixture |

New (non-registry) fixture query: `phish summer tour stats 2026` (6 impr, pos 18.2).
GA4 organic (fixture, SEO paths only): keyword 8 sessions, summer slug 5, hub 3.
Home / `/phish-picks` rows are dropped by the snapshot filter.

### Competitor gaps
Source: `content/marketing/933-competitor-title-h1-gap-brief.md` (2026-09-03 allowlisted homepage GET).

| Peer | Title | H1 | Vs registry |
|------|-------|----|-------------|
| Jam Picks (`phish.jampicks.com`, 308 from phishpicks.net) | `Phish \| Jam Picks` | The Phish Setlist Prediction Game | Same C1/C6 H1 noun as us; they win on mechanic (10 ranked picks), not title tokens. Title is brand-short — we keep #973 prediction + lock-your-picks. |
| callingit.live / ihoz / Phantasy Tour | — | — | **OMIT** (ToS / unverifiable). Do not re-fetch. Owner-note only. |

Jam Picks homepage HTML has no bustout / unique-songs / tour-stats phrases — S-cluster stays on our `/tour-stats*`. C7 `/phish-picks` doorway stays gated (#975); peer title no longer matches “phish picks.”

### Scored actions
1. Hold #973 C6/C7 strings (brief rec 2) — fixture ≠ live GSC → **WAIT_EVIDENCE** → metric: C6/C7 impressions on first live pack.
2. S4–S6 null + new “summer tour stats 2026” query → **WAIT_EVIDENCE** (need live GSC) then likely **REQUEST_INDEX** on the summer slug after `main` is READY → metric: S4–S6 rows appear.
3. Do not clone Jam Picks H1 or callingit.live tour-year title → **NOOP** (brief recs 1–2).
4. Do not open `/phish-picks` → **NOOP** (#975 gated; brief rec 1).
5. C1 fixture win + tour-stats H2s already match S-cluster → **NOOP**.
6. Off-site summer URL share → **WAIT_EVIDENCE** until a real bustout night + live stats (human leftover on #930).
7. Optional keyword-page sentence linking Summer Tour 2026 → `/tour-stats/2026-summer-tour` (brief rec 4) → **WAIT_EVIDENCE** until live C6 impressions-without-clicks after #973 indexes.

### Draft changes
- PR(s): _none_ (no `DRAFT_PR` this cycle)
- Files: n/a

### Generative spot-checks (3 prompts)
Not run this cycle (docs-only; no human chat evidence). Record on the next live pack:

1. `What are the unique songs and bustouts on Phish 2026 Summer Tour?`
2. `Where can I play a free Phish setlist prediction game?`
3. `What does bustout mean for Phish this tour?`

### Persistence
- [x] Current-tour SEO slug on staging remains `2026-summer-tour` (do not promote a new tour from this fixture week)
- [x] Sitemap `lastmod`: none stamped (no HTML snapshot refresh in this docs PR)
- [x] No `/phish-picks`; aggregates only

### Ask for GPM / EiC
- [ ] Add `GSC_SERVICE_ACCOUNT_JSON` + GSC www access so E1 can post a live facts pack
- [ ] Next `optimize_for`: `stats_impressions` once a live pack exists
- [ ] Human leftover: #930 Request indexing + UTM summer share
- [ ] Weekly: `python3 -m crew.scripts.seo_title_h1_scan` with the E1 pack (Jam Picks homepage only)
```

---

## Maturity ladder

| Level | Meaning | Repo status |
|-------|---------|-------------|
| **L0** | Playbook + RACI + pack template | This doc (#934) |
| **L1** | On-demand scored pack on #926 (fixture or live) | Example pack above; live pack waits on E1 secret |
| **L2** | Two consecutive scored packs from scheduled E1 facts (no chat kickoff) | Open — still agent-driven after the Monday comment |
| **L3** | ≥1 competitor gap (#933) → EiC-approved draft PR → measurable impression lift | Open |

Related children: #931 (registry), #932 (facts Action), #933 (competitor gaps), #930 (reindex + UTM), #959 (auto-expand slugs).

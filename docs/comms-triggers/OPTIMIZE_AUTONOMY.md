# Comms Optimize autonomy (L0–L2 playbook)

**Epic:** [#573](https://github.com/pat792/set-picks/issues/573)  
**Status:** L2 kickoff automation shipped ([#778](https://github.com/pat792/set-picks/issues/778)) — daily GH Action posts a pack kickoff on #573; full Leadership → squad execution still agent-driven from that comment. L1 on-demand packs remain supported.  
**Does not replace:** automated **delivery** (`deliverCommsTrigger` / epic #441). This doc is the **editorial + measurement + recommendation** loop.

---

## Kickoff

```text
Run Optimize for goal <optimize_for> covering <date window / show dates>
```

| Input | Examples |
|-------|----------|
| `optimize_for` | `picks_lock` · `return_14d` · `tour_retention` · `push_opt_in` · `email_open` · `show_recap_uniqueness` |
| Window | Show dates (YYYY-MM-DD…) or “last completed show week” / GA4 `7daysAgo`→`yesterday` |
| Constraints | Draft-only; PR base **`staging`**; never `comms:deploy` / never merge without PM |

Post the finished pack as a comment on **#573** (and link any draft PRs).

### Goal-input convention (`optimize_for`)

Pass exactly one primary goal string (snake_case). Optional secondary goals go in the pack **Recommendations** section, not the kickoff line.

| Value | Optimize for |
|-------|----------------|
| `picks_lock` | Reminder → open/tap → pick submitted before lock |
| `return_14d` | Lapsed users returning / logging in |
| `tour_retention` | Tour engagement + end-of-tour recap (#510) |
| `push_opt_in` | Push permission + reminder push share |
| `email_open` | Email open/click signal plane (#512) |
| `show_recap_uniqueness` | Night narrative quality (#572 → L3) |

**Cloud Agent / on-demand prompt (copy-paste):**

```text
Using docs/comms-triggers/OPTIMIZE_AUTONOMY.md and the comms squad skills,
run Optimize for goal picks_lock covering the last 7 complete days (GA4 property 527619709).
Produce the PM review pack template, post it on GitHub issue #573 with [SKIP-PRD],
open a draft PR to staging only if a low-risk copy/catalog change is justified,
and never merge or deploy.
```

Swap `picks_lock` / window as needed. First L1 pack: [comment on #573](https://github.com/pat792/set-picks/issues/573#issuecomment-5000375612).

---

## Scheduled runner (L2 — #778)

| Piece | Path |
|-------|------|
| Goal rotation | [`optimize_for.md`](./optimize_for.md) |
| Kickoff script | `npm run comms:optimize-kickoff` (`scripts/comms-optimize-kickoff.mjs`) |
| Cron | `.github/workflows/comms-optimize-schedule.yml` — daily `15:00` UTC (~09:00 America/Denver) |
| Epic comments | Workflow posts `[SKIP-PRD]` kickoff on **#573** (does not merge/deploy) |

**Note:** GitHub `schedule` workflows run only from the repo **default branch** (`main`). Merge to `staging` first; cron becomes live after promote to `main`. Use `workflow_dispatch` on the workflow file’s branch for earlier dry runs.

**Cadence**

| When | Mode | `optimize_for` |
|------|------|----------------|
| Morning after a calendar show date | `post_show` | always `show_recap_uniqueness` + narrative QA report ([#779](https://github.com/pat792/set-picks/issues/779)) |
| Monday (Denver), no post-show | `weekly` | ISO-week rotation in `optimize_for.md` (show-week vs off-tour) |
| Manual | `workflow_dispatch` or CLI | `--mode weekly\|post_show` |

### Show-recap uniqueness QA (#779)

Post-show kickoffs attach a **Show-recap uniqueness QA** section from live `comms_show_context/{showDate}`. The scheduled workflow passes `GCP_CLIENT_EMAIL` and `GCP_PRIVATE_KEY`. If that live read fails, the kickoff says QA was **skipped** and includes no sample narrative. `fenway_labeled` is a local/CI smoke fixture and is not posted from the schedule. Standalone:

```bash
# Fixture smoke (CI / no Firestore)
npm run comms:show-recap-qa -- --fixture fenway_labeled
npm run comms:show-recap-qa -- --fixture fenway_unlabeled   # expect FAIL (pre-#780)

# Live context (rebuild highlight from official_setlists + songGaps)
npm run comms:show-recap-qa -- --show-date 2026-07-31 --live
npm run comms:show-recap-qa -- --show-date 2026-07-31 --live --rebuild

# Post report on #573
npm run comms:show-recap-qa -- --show-date 2026-07-31 --live --post
```

Checklist (fail → scored `DRAFT_PR`): `Bustout:` / `Bustouts:` labels, trailing period, `;` separators for multi, gap shape, cold/hot wrappers keep the label, catalog example matches runtime. Renders `cold` / `mixed` / `hot_night` / `bustout_hero` via `tour-rankings-daily` (dry — no Resend).

**What the cron does vs does not**

| Does | Does not |
|------|----------|
| Resolve goal + window from calendar + rotation | Run GA4 MCP / CrewAI / Cursor squad itself |
| Post agent prompt on #573 | Open draft PRs or deploy |
| Prefer post-show over weekly when both apply | Invent metrics |
| Attach live narrative QA on post_show (#779) when Firestore credentials are present | Attach the Fenway fixture, or send Resend canaries |

**Human / Cloud Agent step after each kickoff:** run the embedded prompt (or Leadership `crew` optimize → `SQUAD_KICKOFF` → squad). Post the finished **PM review pack** as a follow-up comment on #573. L2 exit criteria (two consecutive packs without chat kickoff) count when those pack comments land from the scheduled kickoffs.

```bash
# Dry-run (prints markdown)
npm run comms:optimize-kickoff -- --mode auto

# Post to #573 (needs gh auth)
npm run comms:optimize-kickoff -- --mode weekly --post
```

---

## Cycle order (always)

```text
comms-analyst → comms-triggers → comms-drafter → comms-architect → PM
```

| Step | Skill | Does |
|------|-------|------|
| 1 | **analyst** | GA4 + delivery-log funnels, gaps, recommendations slot |
| 2 | **triggers** | Catalog proposals (new / deprecate / experiment) tied to goal |
| 3 | **drafter** | Optional **draft** PR for low-risk copy (`content/comms` + builders) |
| 4 | **architect** | Flag missing ingest / adapter / var wiring; dry-run notes |
| 5 | **PM** | Approve/reject PRs + recommendations; set next `optimize_for` |

Agents **open draft PRs and proposal issues only**. They do **not** auto-merge, auto-approve, or production-deploy.

---

## Night vs tour boundary

| Surface | Issue | Trigger / template | When |
|---------|-------|--------------------|------|
| **Night show recap** | [#572](https://github.com/pat792/set-picks/issues/572) | `show_recap` (+ morning absorb) | After a single show grades |
| **End-of-tour recap** | [#510](https://github.com/pat792/set-picks/issues/510) | `tour_recap` (generalize Sphere edition) | Morning after a tour’s final show (8am PT cron; not same-tick as night `show_recap`) |

Do **not** put tour-length narrative into night `show_recap`, or night setlist flow into `tour_recap`. Sphere ’26 is an **edition archive / QA replay**, not the permanent production trigger. Automated scanners skip that edition via `editionStatus: archive` and `comms_process_state` (#1035), not via a Sphere trigger id. Post-mortem: [INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md](./INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md). Delivery checklist: [FRAMEWORK.md](./FRAMEWORK.md) DELIVER.

---

## Data spine (facts only — no invented setlist lore)

| Source | Path / doc | Use in Optimize |
|--------|------------|-----------------|
| Official setlists | `docs/OFFICIAL_SETLISTS_SCHEMA.md` · `official_setlists/{showDate}` | Slots, `officialSetlist`, `bustouts`, `songGaps` |
| Tour calendar | `show_calendar` / `showDatesByTour` | Tour membership, final-show detection, `editionStatus` (`live` / `archive` / `closed`) |
| Process gate | `comms_process_state/{triggerId}:{scope}` | Once-ever skip for a completed or archive moment (#1035). `tour_recap` also mirrors `comms_tour_recap_state` |
| Show context | `docs/COMMS_SHOW_CONTEXT_SCHEMA.md` · `comms_show_context/{showDate}` | Deterministic night highlights (#572) |
| Measurement | `docs/comms-triggers/MEASUREMENT_PLAN.md` | Deliver → open → CTA |
| Delivery | `functions/commsDelivery.js` + workers | Prefs, dedup, fatigue, canary/`dryRun` |

**Composer rule (v1):** build `setlist_highlight` (and related vars) **deterministically** from the spine. No LLM freeform “what the night felt like” until L3+ and only on approved fact slots.

---

## Draft-only write surface

| Allowed | Forbidden |
|---------|-----------|
| Draft PR to **`staging`** | Merge without PM |
| `[SKIP-PRD]` child issues / catalog `planned` rows | Production `comms:deploy` from an agent |
| War Room / `runCommsTrigger` canaries (`dryRun` default) | Resend MCP / ad-hoc production sends |
| Pack comment on #573 | Changing prefs/caps/dedup without architect + PM |

---

## PM review pack template (every cycle)

Agents **must** use this shape:

```markdown
## Comms Optimize pack — <YYYY-MM-DD> (goal: <goal>)

### Summary
<2–3 sentences>

### Funnels
| trigger_id | channel | delivered | opened / proxy | CTA / land | submit (attrib) | Δ vs prior |

Use channel planes from MEASUREMENT_PLAN: inApp = `comms_opened`/`comms_cta_click`; email = UTM sessions (+ Resend opens when #512 lands); push = `comms_push_tap`. Never collapse email into inApp open/CTA.

### Gaps
- …

### Draft changes
- PR(s): …
- Canaries: …

### Recommendations (new / change)
1. … → goal: … → metric: …
2. …

### Show-recap uniqueness (when #572 ready)
- tags/branches: …
- samples: …
- canaries: …

### Maturity note
- Current ladder level: L0–L4
- Blockers to next level: …

### Ask for PM
- [ ] Approve / request changes on draft PR(s)
- [ ] Accept / reject recommendations (log on epic)
- [ ] Pick goal inputs for next cycle
```

---

## Maturity ladder (pointer)

Full L0→L4 table lives on [#573](https://github.com/pat792/set-picks/issues/573).

| Level | Repo status |
|-------|-------------|
| **L0** | Done — this playbook + skills (#628) |
| **L1** | Done — first on-demand pack (2026-07-17, `optimize_for=picks_lock`) |
| **L2** | Kickoff cron shipped (#778) — exit when **two consecutive** packs land from scheduled kickoffs without chat |
| **L3+** | Open — narrative QA (#779); uniqueness metrics; NBA |

Related Wave 5 siblings: [#510](https://github.com/pat792/set-picks/issues/510) (`tour_recap`), [#512](https://github.com/pat792/set-picks/issues/512) (email open signal), [#513](https://github.com/pat792/set-picks/issues/513) (prefs hub).

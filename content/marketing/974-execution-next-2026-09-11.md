# #974 execution — next steps (accounts exist)

**Status:** draft (CoS / CCO — execute, do not reopen SEO build)  
**Date:** 2026-09-23 (accounts confirmed; X deferred)  
**Issue:** [#974](https://github.com/pat792/set-picks/issues/974) (closed 2026-09-04 on docs merge; **human AC still open**)  
**Epic:** [#972](https://github.com/pat792/set-picks/issues/972) · crew [#695](https://github.com/pat792/set-picks/issues/695)  
**Canon:** [`974-owned-social-cadence-brief.md`](./974-owned-social-cadence-brief.md) · [`974-owned-social-profile-pack.md`](./974-owned-social-profile-pack.md) · [`974-social-account-autonomy.md`](./974-social-account-autonomy.md)

**Done (2026-09-23):** Instagram, Threads, and the Facebook Page exist, created from the profile pack. **X is deferred** — not a blocker for the first post. Fall Tour’s first show is **2026-10-02**, so this is an off-week: the first public post is always-on how-it-works, not Slot A. This note is the remaining loop — not a new program.

---

## Ticket hygiene

[#974](https://github.com/pat792/set-picks/issues/974) closed on the cadence-brief PR. Comments on the issue said **do not close** until accounts, EiC brief approval, one posted L2 cycle, and a monthly UTM note. There is **no open social child in the current sprint**. Standing ops live on Sprint 10: [#695](https://github.com/pat792/set-picks/issues/695) (crew) and [#573](https://github.com/pat792/set-picks/issues/573) (comms Optimize).

**Do this once:** reopen #974 *or* file a thin execution follow-on under #972 / #695, milestone **Sprint 10**, remaining AC only. Do not invent a new SEO epic.

Comment live handles + the exact bio URLs on that ticket.

---

## Remaining acceptance (in order)

| # | AC | Owner | Gate |
|---|----|--------|------|
| 1 | Confirm paste: bios, `utm_campaign=seo_geo` link-in-bio, four empty highlight titles, IG Business linked to the Page. Record live handles on the ticket. | You | Do not rewrite strings in the native app |
| 2 | Brand Systems kit: avatar (vinyl mark), cover, 4 IG highlight covers | Brand Systems → you upload | Highlights stay empty until first posts |
| 3 | EiC approves the **cadence brief** | EiC | **Done 2026-09-23** |
| 4 | ≥1 L2 cycle: `draft` → `approve` → `published/` → **posted on IG** | Demand Gen + you | Always-on how-it-works (no card open; first show 2026-10-02) |
| 5 | Same beat on Threads | You | `utm_source=threads`. **X stays off** until you reopen it |
| 6 | Monthly GSC / GA4 UTM note on #972 | Reporting / GPM | After the first live week |

Facebook Page is **kit + IG Business link only** — not a posting program.

---

## Loop to run (Phase 1 — autonomy you already have)

Skills, in order: `social-media-specialist` (calendar / which slot) → `social-demand-gen-operator` (pack) → `brand-systems-partner` (visual) → `editor-in-chief` (approve). CrewAI equivalent: `campaign` pipeline for a brief, then the CLI below for the pack.

```bash
# dry-run first (no files)
python3 -m crew.scripts.social_demand_gen draft \
  --platform instagram \
  --title "974 always-on how-it-works" \
  --body "Setlist Pick'Em is a scored live game: lock six slots before showtime, then watch points land — including Bustout Boost™ on 30+ show gaps. Not a tip sheet.
https://www.setlistpickem.com/how-it-works?utm_source=instagram&utm_medium=social&utm_campaign=seo_geo&utm_content=how-it-works" \
  --dry-run

# persist → list → approve → local publish queue
python3 -m crew.scripts.social_demand_gen draft --platform instagram --title "…" --body "…"
python3 -m crew.scripts.social_demand_gen list --status draft
python3 -m crew.scripts.social_demand_gen approve <draft_id> --approver eic
CREW_SOCIAL_PUBLISH_ENABLED=true python3 -m crew.scripts.social_demand_gen publish <draft_id> --live
```

`publish` writes `crew/output/demand_gen/social/published/` (gitignored). A human copies that pack into Instagram. Do **not** set the env flag in CI or on a Cloud Agent. Do **not** connect `SOCIAL_PUBLISH_WEBHOOK` until this first post exists and the brief is EiC-approved.

Optional CrewAI campaign brief (draft-only):

```bash
crew/.venv/bin/python -m crew.scripts.run_pipeline campaign
```

---

## Explicitly later

- Phase 2 webhook → scheduler (Postiz / Ayrshare / Buffer / n8n). Integrations Architect. Not an AC.
- First-party Meta Graph / Threads / X APIs.
- `#975` `/phish-picks` doorway (gated on ≥4 weeks of owned social + GSC).
- Auto-post from Cloud Agents.

---

## Do not

- Treat #974’s GitHub “closed” as program-done.
- Post tip sheets, predicted setlists, or last-night full sets.
- Use a campaign other than `seo_geo`.
- Start a Facebook posting cadence.

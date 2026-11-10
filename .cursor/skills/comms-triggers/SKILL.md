---
name: comms-triggers
description: >-
  Comms squad trigger documenter for set-picks. Use when defining new comms
  triggers, updating TRIGGER_CATALOG.md or catalog.json, mapping game events
  to channels, grooming the comms backlog, or linking triggers to GitHub epic
  #272. Ensures every message has a Trigger Spec before copy ships.
---

# Comms Triggers (set-picks)

You own the **trigger catalog** — what fires, for whom, when, through which channels.

## Read first

1. `docs/comms-triggers/FRAMEWORK.md`
2. `docs/comms-triggers/OPTIMIZE_AUTONOMY.md` — Optimize loop + night vs tour (#573)
3. `docs/comms-triggers/TRIGGER_CATALOG.md`
4. `docs/comms-triggers/catalog.json`
5. `src/features/comms/registry.js` — templateId linkage
6. Game logic: `src/shared/utils/timeLogic.js`, `show_calendar`, picks lock (#303: 19:55 local)
7. Spine: `docs/OFFICIAL_SETLISTS_SCHEMA.md`, `docs/COMMS_SHOW_CONTEXT_SCHEMA.md`

## Trigger Spec checklist

Every new trigger needs **both** catalog files updated in the same PR:

| Field | Required |
|-------|----------|
| `triggerId` | snake_case, stable |
| `family` | lifecycle, show_calendar, live_game, results_recap, social_pools, commercial, system |
| `priority` | P0–P3 |
| `status` | planned, in_progress, shipped, deprecated, phase3 |
| `eventSource` | scheduler, firestore, auth, batch, realtime, manual |
| `eventCondition` | Plain English + technical anchor |
| `audience` | Who receives it |
| `channels` | Subset of inApp, push, emailAbbreviated, emailFull |
| `templateId` | Registry id or `inline-*` for legacy |
| `dedupKey` | Pattern with `{uid}`, `{showYmd}`, etc. |
| `prefKeys` | notificationPrefs keys |
| `implementationModule` | Path when shipped |

## Taxonomy rules

- **P0** lifecycle + picks lock ship before P2 live realtime
- **Commercial** rows require `COMMERCIAL_PHASE3.md` gates
- One trigger per user intent — split “reminder” vs “recap” vs “welcome”
- Supersede, don't duplicate: if `picks_lock_reminder` exists, `picks_lock_t24h` is complementary not replacement

## Game-event mapping (reference)

| Game event | Candidate trigger |
|------------|-------------------|
| First login | `first_login_welcome` |
| Profile missing handle | `profile_incomplete_nudge` |
| Show day, no picks, T-3h before lock | `picks_lock_reminder` (shipped) |
| 24h before lock | `picks_lock_t24h` |
| Show graded, user won | `post_show_win` (shipped) |
| Tour segment complete | `tour_recap` (#510 — end of tour; not night `show_recap` #572) |
| 14d no login, show upcoming | `return_after_14d` |

## Optimize cycle (#573)

Order: **analyst → triggers (you) → drafter → architect → PM**.

- Propose catalog rows / experiments that serve the stated `optimize_for`
- Keep **#572 night** vs **#510 tour** triggers separate
- File child issues; PR base **`staging`**; draft-only (no auto-merge)

## Workflow: add a trigger

1. Draft row in TRIGGER_CATALOG.md (markdown table)
2. Add JSON object to `catalog.json` `triggers` array
3. If template needed, file handoff to **comms-drafter** with `templateId`
4. File an issue: `feat(comms): trigger <triggerId>` — link #272
5. Handoff to **comms-architect** for implementation estimate

## Workflow: deprecate

1. Set `status: deprecated` in both catalog files
2. Note replacement `triggerId` if any
3. Architect removes or gates orchestration in follow-up PR

## Output: trigger proposal

```markdown
## Trigger proposal: <triggerId>

**Priority:** P0 | **Family:** show_calendar
**Event:** ...
**Audience:** ...
**Channels:** push, inApp
**Dedup:** ...
**Prefs:** reminders
**Template:** <templateId> (new | existing)
**Implementation:** scheduled | batch | ...
**Measurement:** primary metric = ...
```

## Constraints

- Never add copy to catalog — templateId only
- Keep `catalog.json` valid JSON (no trailing commas)
- Align show dates with `src/shared/data/showDates.js` for tour-specific triggers
- PR base: **staging**; draft proposals only — PM merges
- Do not invent setlist/tour facts; point at spine docs when proposing uniqueness triggers

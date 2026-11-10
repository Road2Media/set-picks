---
name: comms-drafter
description: >-
  Comms squad copy drafter for set-picks. Use when writing or revising
  communication templates in content/comms/, syncing copy to implementation
  modules, updating registry.js, or preparing channel-specific variants for
  in-app, push, and email. Also use when a player-facing UI copy sweep
  changes an inbox, push, or email sentence. Follows content/comms/README.md
  workflow.
---

# Comms Drafter (set-picks)

You draft and ship editorial copy for triggered communications.

## Read first

1. `content/comms/README.md` — authoritative edit/ship workflow
2. `content/marketing/voice-guide.md` — shared prose rules (em dashes, banned product verbs, fan-press calibration); applies to inApp and email body copy
3. `docs/comms-triggers/OPTIMIZE_AUTONOMY.md` — draft-only Optimize + PM pack (#573)
4. `docs/comms-triggers/TRIGGER_CATALOG.md` — which templateId you are writing for
5. `src/features/comms/registry.js` — channels and paths
6. Existing reference: `content/comms/tours/sphere-2026-inaugural.md` (tour edition archive; production path is #510 `tour_recap`)
7. Night narrative facts: `docs/COMMS_SHOW_CONTEXT_SCHEMA.md` + `docs/OFFICIAL_SETLISTS_SCHEMA.md` (#572) — deterministic `setlist_highlight`; no LLM v1
8. `.cursor/skills/brand-systems-partner/SKILL.md` — social-caption pith. Emails and push stay in fan speech. They are not cut down to a social caption.

## Channel copy rules

| Channel | Style |
|---------|--------|
| **inApp** | Full personalized body; paragraphs; optional CTA links |
| **push** | ≤ 90 chars title, ≤ 180 body; tease → deep link to inbox or screen |
| **emailAbbreviated** | Subject + preheader + single CTA |
| **emailFull** | Full recap; mirrors inApp structure |

**Service comms HTML shell** (`functions/commsEmailWorker.js` + `functions/commsTemplates.js`):

- **Brand once** — gradient wordmark in the header; do not repeat "Setlist Pick'em" in body or sign-off (legal footer is enough).
- **Body** — personalized message only; no "manage preferences" (footer links handle that).
- **Sign-off** — warm human close via `assembleServiceEmail({ signOff })` (default: `See you on tour!`).
- **CTA** — action-specific label when possible (`Make Your Picks` → `/dashboard/picks`); **teal** fill (`#2dd4bf`) + dark text per `design.md`; plain-text part keeps `Open the app: <url>`.
- **Shell** — gradient wordmark via **hosted PNG** (`/branding/email-gradient-wordmark.png`, same pattern as marketing favicon URL). Deploy `public/branding/` before sends. No CID attachments (Gmail exposes those as downloadable files).
- **Email QA (required before batch send)** — `node scripts/send-local-email-preview.mjs --tour-countdown --send <your-email>` after the PNG is on production; confirm wordmark in a real inbox (not browser HTML alone).
- **Voice** — direct, fan-to-fan, show-night energy; avoid corporate boilerplate and triple-stacked branding. Full rules in `content/marketing/voice-guide.md` (em dashes are not the default joint; no "unlock" / "elevate" / "seamless").

**Pattern:** push teases, inbox delivers depth (Sphere model).

## Placeholders

Use `{{variable}}` in Markdown drafts. Document variables in file metadata table:

- `{{rank}}`, `{{points}}`, `{{showDate}}`, `{{venue}}`, `{{poolName}}`
- Never put real user PII or secrets in `content/comms/`

## Ship workflow (existing template)

| Step | Action |
|------|--------|
| 1 | Edit `content/comms/...` |
| 2 | Sync strings to `implementationModule` from registry |
| 3 | Update builders for each channel (inApp, push, email) |
| 4 | Run `npm run lint` and `npm test` (feature tests) |
| 5 | Open **draft** PR to **staging** with catalog sync if new templateId — never auto-merge |

## Optimize cycle (#573)

Order: analyst → triggers → **drafter (you)** → architect → PM.

- Only open draft PRs when the pack justifies a copy change
- Night (#572 `show_recap`) vs tour (#510 `tour_recap`) stay separate files / templateIds
- Canary IDs belong in the PM pack; you do not production-deploy

## Ship workflow (new template)

| Step | Action |
|------|--------|
| 1 | Add draft under `content/comms/tours/`, `shows/`, or `lifecycle/` |
| 2 | Create `src/features/<domain>/model/<name>.js` + tests |
| 3 | Register in `src/features/comms/registry.js` |
| 4 | Wire UI in `src/features/notifications/ui/` if inApp |
| 5 | Optional War Room admin preview |

## Directory layout

```text
content/comms/
  tours/          # Multi-show recaps
  shows/          # Single-show
  lifecycle/      # Welcome, nudge, return (create as needed)
  commercial/     # Phase 3 only
```

## Variant / experiment copy

When **comms-analyst** requests A/B copy:

- Draft `variant_b` in same file under `## Variant B` or separate file
- Label semver in metadata: `version: 1.1.0-variant-b`
- Do not change dedup keys — architect handles assignment

## Output: copy PR checklist

```markdown
## Copy change: <templateId>

- [ ] content/comms/ draft updated
- [ ] implementationModule synced
- [ ] registry.js (if new template or channels)
- [ ] tests updated
- [ ] push + inApp reviewed for length
- [ ] TRIGGER_CATALOG templateId linked
```

## Constraints

- Follow FSD: copy modules stay in feature `model/`, not `shared/`
- One recap edition per file; clear filenames
- Commercial copy requires disclosure per `COMMERCIAL_PHASE3.md`
- Same PR for Markdown + JS sync (one-PR rule from content/comms README)
- **Draft-only** write surface for Optimize: PR base **staging**; PM merges; no `comms:deploy` from this skill
- Never invent bustouts / gaps / setlist order — sync from spine or leave placeholder vars

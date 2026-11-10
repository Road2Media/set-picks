# Multi-band migration runbook

Operational notes for namespacing Setlist Pick'em by band. The architecture and phase order live in [`MULTI_BAND_COLLECTIONS_STRATEGY.md`](./MULTI_BAND_COLLECTIONS_STRATEGY.md). This file is the place those phases record backfill, cutover, and rollback steps.

Phase 0 (#301) is contracts only: `BandConfig`, the provider spec in `functions/providers/_contract.md`, and `BandProvider`. It does not write Firestore, change rules, or move documents. The sections below are placeholders until that phase is scheduled.

## Overview

Recommended tenancy is composite-friendly fields first, then composite document ids (strategy Fork A1, rollout F2):

- Phase 1 adds `bandId: "phish"` on new writes and backfills existing docs. Document ids stay as they are.
- Phase 3 renames ids to `{bandId}_{showDate}` (and `{bandId}_{showDate}_{uid}` for picks). That is the step that lets two bands share a calendar date.

Until Phase 3, do not ingest a second band into `official_setlists`, `picks`, or `live_setlist_automation`. Those ids are the show date.

## Phase 1 — `bandId` field backfill

Placeholder. Fill this in when Phase 1 is scheduled. Expected shape, not a procedure to run now:

- Collections: `picks`, `official_setlists`, `live_setlist_automation`, `rollup_audit`, `pools`.
- New writes include `bandId: "phish"`. Rules start requiring the field only in that phase.
- A one-time script (`scripts/migrate-phish-to-bandid.mjs`, not in this phase) backfills the field. It does not rename document ids.
- Readers gain `where('bandId', '==', activeBand)` after the backfill is verified.

### Rollback

Placeholder. Revert the write path and rules together. Documents that already have `bandId: "phish"` can keep the field; readers that do not filter on it still match. Do not delete the field as part of rollback unless a rule rejects unknown fields.

### Verification

Placeholder. Confirm a sample of each collection has `bandId == "phish"`, new picks still grade, and a rules test covers a write missing `bandId`.

## Phase 3 — composite document ids

Placeholder. Fill this in before the maintenance window. Expected order, not a procedure to run now:

1. Writers emit `{bandId}_{showDate}` (picks: `{bandId}_{showDate}_{uid}`).
2. Readers accept both the legacy id and the composite id.
3. Backfill copies or renames legacy docs.
4. Readers switch to composite ids only.
5. Legacy docs are deleted only after the verification window.

Cloud Function triggers that key off `official_setlists/{docId}` have to parse `{bandId}_{showDate}` in the same release as the rename. Schedule that with the cutover, not before.

### Rollback

Placeholder. Keep the legacy documents until step 5. Rolling back means pointing readers and writers at the legacy ids again. Do not start step 5 until that rollback path has been rehearsed on a copy.

### Verification

Placeholder. Same-night fixture: two bands on one date must not overwrite each other's `official_setlists` document. Phish grading for an existing show date must match pre-cutover scores.

## What this runbook does not cover yet

- Phase 2 provider wrap (no data move).
- Phase 4 Goose provisioning (`show_calendar/goose_snapshot`, `song-catalog/goose.json`).
- Renaming the `phish_pool_pending_invite` localStorage key.

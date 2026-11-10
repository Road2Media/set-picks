# Picks rollup report (internal)

Internal analytics for **nightly picker volume** and **crowd pick composition**. Productized stats-page charts and comms recommendations come **after** report review — see [#687](https://github.com/pat792/set-picks/issues/687).

## Phases

| Phase | What | Status |
|-------|------|--------|
| **A** | Admin report script + methodology | Done (PR #688) |
| **B** | Human review of Summer Tour reports | Done — see [02-phase-b-review.md](./02-phase-b-review.md) |
| **C** | Stats candidates + C1–C3 + Standings UI | Spec [#689](https://github.com/pat792/set-picks/issues/689); pre-lock [04-prelock-disclosure.md](./04-prelock-disclosure.md); **Standings ship** [#694](https://github.com/pat792/set-picks/issues/694) P0 |
| **Later** | Stats page deep dive (shipped v1.107.0), picks helper (shipped v1.108.0) | [#694](https://github.com/pat792/set-picks/issues/694) P3 prefs/telemetry still open |

## Data spine

| Concept | Source |
|---------|--------|
| Night key | `picks.showDate` (`YYYY-MM-DD`) |
| Pick doc | `picks/{showDate}_{userId}` |
| Submitted | ≥1 non-empty slot in `picks.{s1o,s1c,s2o,s2c,enc,wild}` |
| Songs | Title strings (case-insensitive keys); no catalog IDs |
| Calendar | `show_calendar/snapshot` |
| Optional answers | `official_setlists/{showDate}` for consensus-vs-actual |

Score finalize rollup (`rollupScoresForShow`) is **orthogonal** — this report does not write scores.

## Metrics (v1)

### Nightly series

- Submitted pickers, total pick docs, graded count, empty/draft docs
- Pool-affiliated %
- Unique songs; rare songs (exactly one card)
- Diversity proxy: unique titles / slot fills
- Slot fill rates

### Song insights

- Top songs overall and by slot (count + % of submitted pickers)
- Consensus (≥ configurable %, default 25%)
- Tour-window frequency (card appearances vs slot fills)
- When setlist present: did each slot’s crowd favorite match the official slot?

### Explicit non-goals (Phase A)

- No new Firestore rollup collection
- No stats-page UI
- No per-user handles/UIDs in report artifacts

## How to run (local review — C1–C3)

```bash
# From repo root (vite-node resolves ESM without .js extensions)
npm run crowd:night-stats -- --date=2026-07-19 --tour="Summer Tour"
npm run crowd:night-stats -- --date=2026-07-19 --out=docs/picks-rollup/reports/crowd-night.json
```

Prints card v1 summary, multi-picker table, gap top 10, vintage, leaders tonight.

Optional flags: `--dates=...`, `--consensus=25`, `--top=15`, `--no-setlists`.

Unit tests (pure core, no Firebase):

```bash
cd functions && node --test picksRollupReportCore.test.js
```

## Output

- **stdout:** markdown summary (always)
- **`--out=DIR`:** `picks-rollup-{from}_{to}_{date}.md` + `.json`

Generated report files under `reports/` may be kept local (gitignored) or committed as sanitized snapshots — prefer aggregates-only; never commit UID dumps.

Offline mode (no ADC):

```bash
cd functions
node scripts/picksRollupReport.js --dump=./picks-dump.json --out=../docs/picks-rollup/reports
```

Dump shape: JSON array of pick docs (at least `showDate`, `picks`, optional `isGraded` / `pools`), or `{ "picks": [ ... ] }`.

## Related

- Prior offline scoring research: [`docs/scoring-analysis/`](../scoring-analysis/)
- Profile frequency (live, per-user): `src/features/profile/model/aggregatePickSongStats.js`
- Prediction epic (downstream): #646

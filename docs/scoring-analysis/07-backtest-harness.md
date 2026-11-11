# Prediction backtest harness (#648)

Offline, leakage-safe historical evaluation for the predictive picker epic ([#646](https://github.com/pat792/set-picks/issues/646)). Combined model calibration is [#649](https://github.com/pat792/set-picks/issues/649).

## What it does

1. **Import** a bounded Phish.net setlist history into a local cache.
2. **Rolling-origin backtest:** for each target show, train features only on `showDate < targetDate`, then score baselines.
3. **Report** recall@K, exact-slot hit@K, Brier, zero-score proxy, concentration.

## Leakage rules (non-negotiable)

| Allowed as features | Forbidden as features for target `T` |
|---------------------|--------------------------------------|
| Setlists with `showDate < T` | `official_setlists/T` (`setlist`, `officialSetlist`, `encoreSongs`, `bustouts`, `songGaps`) |
| Gaps **reconstructed** from prior shows | Live `song-catalog.json` gaps (post-play reset) |
| Calendar dates / tour clustering for listing imports | Same-night user picks / consensus |

Target-night setlist fields are **labels only** (what actually played / slot truth).

## Commands

From repo root. Phish.net import needs `PHISHNET_API_KEY` in `.env`. `--source=phishin` does not.

```bash
# 1) Cache the #1002 window (3 years, cap 180). Phish.net needs PHISHNET_API_KEY.
#    Phish.in is the public fallback and writes the same show records.
npm run backtest:import-setlists -- --years=3 --source=phishin

# Or an explicit window on Phish.net:
npm run backtest:import-setlists -- --from=2024-01-01 --to=2025-12-31

# 2) Baseline comparison on whatever is cached
npm run backtest:recommendations

# 3) Wide window vs the live 120-show cap, plus pick cards if exported
npm run backtest:export-picks
npm run backtest:window

# Optional knobs:
npm run backtest:recommendations -- --min-train=40 --recent-window=25

# 4) Unit tests (no network)
npm run test:prediction-backtest
```

## Outputs

| Path | Notes |
|------|-------|
| `data/prediction-backtest/setlists/YYYY-MM-DD.json` | Cached `ShowRecord` (gitignored) |
| `data/prediction-backtest/import-manifest.json` | Last import summary |
| `data/prediction-backtest/reports/baseline-backtest-*.{json,md}` | Metrics report |
| `data/prediction-backtest/reports/window-study.{json,md}` | #1002 window comparison |
| `data/prediction-backtest/picks/cards.json` | Historical cards for the player comparison (no user ids) |

## Baselines

| Name | Score |
|------|--------|
| `global_popularity` | Lifetime play count before `T` |
| `gap_ascending` | Reconstructed shows-since-last-play (low gap first), then plays — mirrors autocomplete heuristic |
| `recent_frequency` | Plays in trailing N shows (default 25) before `T` |

These are **slot-agnostic**. #649 adds `combined_explainable` (play × slot affinity) on the same harness — see [08-recommendation-model.md](./08-recommendation-model.md).

## Interpreting the report

- **recall@5 / @10** — fraction of that night’s played songs in the top-K list.
- **slotHit@K** — mean exact hit for s1o/s1c/s2o/s2c/enc in top-K.
- **Brier** — rank→pseudo-probability calibration (lower better).
- **zeroScoreRate** — nights where locking the single top-1 song into every slot would still score 0 (harsh proxy; useful for ranking baselines).
- **top3Conc** — mass of inverse-rank scores in the top 3. This number barely moves between models, because it is built from ranks rather than `playProb`. Use `playProb` top-share and the player comparison in [09-wider-backtest-and-playprob.md](./09-wider-backtest-and-playprob.md) for herding.

## Layout

```text
scripts/prediction-backtest/
  import-setlists.mjs
  run-backtest.mjs
  lib/           # features, baselines, metrics, dataset, tests
  __fixtures__/
docs/scoring-analysis/07-backtest-harness.md
```

Reuses `functions/phishnetLiveSetlistAutomation.js` + `functions/phishnetShowCalendar.js` via `createRequire` (same pattern as `scripts/print-phishnet-tour-clusters.mjs`).

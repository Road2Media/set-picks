# Combined recommendation model (#649)

Frozen explainable play × slot model used by the offline harness and (later) `#650` artifact.

| Field | Value |
|-------|--------|
| `modelVersion` | `v0.1.1-explainable` |
| Training | Rolling-origin on cached Phish.net setlists (`showDate < target`) |
| Formula | `slotScore = playProb × smoothedSlotAffinity` · `wildcardScore = playProb` |
| Risk bands | `safe` (high show-wide playProb) · `slot_fit` (strong for this slot over window *t*: `slotHits ≥ 2` and `slotHits/showCount ≥ 6%`) · `long_shot` (bustout gap ≥ 30 + low playProb) · `unbanded` (residual; Lab hides) |

## Features (leakage-safe)

- Recent play rates over trailing 10 / 25 / 50 shows
- Lifetime frequency with shrinkage
- Nonlinear gap vs expected return interval (gap 0 after prior night is penalized)
- Prior-night repeat penalty
- Days-since-prior-show rest bonus
- Empirical smoothed slot affinity for s1o/s1c/s2o/s2c/enc

**Never** uses target-night `songGaps` / official setlist as candidate features.

## Go / no-go

```bash
npm run backtest:import-setlists -- --years=3 --source=phishin
npm run backtest:window
```

PASS when `combined_explainable` meets or beats each baseline on **slotHit@5** or **recall@10**. Exit code `2` on FAIL for `npm run backtest:recommendations`.

Weights live in `scripts/prediction-backtest/lib/model.mjs` (`MODEL_WEIGHTS`) **and** the production CJS port `functions/pickRecommendationsModel.js` (keep in sync). Bump `MODEL_VERSION` when weights change and re-run the harness. The #1002 window did not change weights. See [09-wider-backtest-and-playprob.md](./09-wider-backtest-and-playprob.md).

## Empirical freeze note (2026-07-22)

On a 41-show 2024 cache (`minTrain=15`, 26 eval nights), `v0.1.0-explainable` **PASS**ed go/no-go:

| Model | recall@10 | slotHit@5 | zeroScoreRate |
|-------|----------:|----------:|--------------:|
| global_popularity | 0.078 | 0.008 | 1.00 |
| gap_ascending | 0.013 | 0.000 | 1.00 |
| recent_frequency | 0.070 | 0.031 | 0.96 |
| **combined_explainable** | **0.186** | **0.185** | **0.31** |

Re-run on a wider window before Wave 3; bump `MODEL_VERSION` if weights change.

## Wider window (2026-11-10, #1002)

On 134 shows and 94 scored nights, `v0.1.1-explainable` still passes the gate above. Recall@10 is 0.150 and slot hit@5 is 0.199. The published `playProb` is not a frequency: Brier 0.185 versus 0.061 for a flat 6.5% guess. Weights stay at `v0.1.1-explainable`. Full tables and the #652 call are in [09-wider-backtest-and-playprob.md](./09-wider-backtest-and-playprob.md).

## Explanations

Each ranked song carries up to two short reasons, e.g.:

- set 1 opener in 12 of 40 shows
- frequent this tour window
- due vs cadence (gap 8)
- unlikely repeat after prior night
- bustout / long-shot upside (gap 42)

**Slot fit analytical frame:** for each positional slot, count how often each song occupied that slot across the prior window *t* (all prior shows in the artifact / backtest cache). Songs meeting the frequency thresholds are `slot_fit`; the same rule applies to s1o, s1c, s2o, s2c, and enc. Wildcard has no positional history — only `safe` / `long_shot` / `unbanded`.

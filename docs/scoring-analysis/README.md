# Scoring & prediction analysis (2026-07)

Preserved design research from Cursor canvases and live Firestore / Phish.net analysis. Canvases live only under Cursor’s local project folder (`~/.cursor/projects/.../canvases/`) and are **not** in git; **Canvas Publish** requires a Teams or Enterprise plan and stores a share snapshot on Cursor’s dashboard—not this repository.

This folder is the durable, repo-backed record of that work.

## GitHub tracking

| Issue | Topic |
|-------|--------|
| [#645](https://github.com/pat792/set-picks/issues/645) | Scoring considerations (encore fairness, EV, bustouts, combos) |
| [#646](https://github.com/pat792/set-picks/issues/646) | Epic: predictive song picker |
| [#647](https://github.com/pat792/set-picks/issues/647)–[#653](https://github.com/pat792/set-picks/issues/653) | Child slices for the prediction epic |

## Documents

| Doc | Source canvas / topic |
|-----|------------------------|
| [01-slot-odds-and-ev.md](./01-slot-odds-and-ev.md) | Slot hit rates, EV, points fairness |
| [02-significance-and-variability.md](./02-significance-and-variability.md) | Statistical significance; 2-year setlist variability |
| [03-scoring-calibration.md](./03-scoring-calibration.md) | Encore 15/10/5, bustout tiers, multipliers |
| [04-card-combos-and-engagement.md](./04-card-combos-and-engagement.md) | Breadth bonuses, zeros, predictive coupling |
| [05-scoring-from-scratch.md](./05-scoring-from-scratch.md) | Greenfield scoring proposal |
| [06-predictive-picker-framework.md](./06-predictive-picker-framework.md) | Recommendation engine + two UX surfaces |
| [07-backtest-harness.md](./07-backtest-harness.md) | Leakage-safe rolling backtest |
| [08-recommendation-model.md](./08-recommendation-model.md) | Frozen explainable model |
| [09-wider-backtest-and-playprob.md](./09-wider-backtest-and-playprob.md) | 3-year window, playProb vs picks, #652 gate (#1002) |

## Snapshot metadata

- **Analysis date:** ~2026-07-18
- **Graded picks:** 204 pick docs across 17 shows
- **Official setlists:** 21 docs (4 without picks in that window)
- **Supply window:** Phish.net Phish-only setlists, last 24 months (~105 shows) and 2022–2026 (~211 shows)
- **Scoring constants at analysis time:** exact opener/closer 10 · encore any 15 · in-setlist 5 · wildcard 10 · bustout +20 (gap ≥ 30)

## Caveats

- Slot-to-slot exact-rate differences were **not statistically significant** at this sample size.
- User hit rates partly reflect crowd skill/consensus, not only slot difficulty.
- Coupling recommendations with card bonuses will change bonus incidence; recalibrate after Prediction Lab ships.

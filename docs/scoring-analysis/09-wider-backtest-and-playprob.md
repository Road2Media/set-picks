# Wider backtest window and playProb vs picks (#1002)

Measured 2026-11-10. Parent epic [#646](https://github.com/Road2Media/set-picks/issues/646). This does not change scoring, weights, or the live recommendation file. Predictive Mode ([#652](https://github.com/Road2Media/set-picks/issues/652)) stays off.

## The window

**N = the last 3 years of completed shows, and never more than 180 shows.**

On this run that is **134 shows**, 2023-12-28 through 2026-10-12. The importer listed 136 dates from 2023-11-10. Two dates had no set (soundcheck only) and were left out. A night is scored only after **40 earlier shows**, so **94 nights** are in the rolling test.

Why 3 years, not the live file's 1 year: the live refresh has been as thin as 43 shows. That is one tour. It is too small to tell whether a percent is a real frequency. Three years covers several tours (summer, fall, New Year's) and leaves 94 nights to test.

Why not the whole catalog: the percent is a recent-rotation guess. Shows from the 1990s would not make that guess better, and they would mix in a different band era. The 180-show cap is there so a later run cannot quietly become the whole catalog. This run did not hit the cap.

Why not stop at 2 years: two years is what the old harness example used, and the only published freeze before this was 41 shows. Three years is the smallest step that gives a full reliability table.

The setlists came from the public Phish.in v2 API because this run had no `PHISHNET_API_KEY`. The cache is the same show record the Phish.net importer writes, and the same set parser labels the opener, closer, and encore. Pass `--source=phishnet` when the key is in `.env`.

## How to run it again

```bash
npm run backtest:import-setlists -- --years=3 --source=phishin
npm run backtest:export-picks
npm run backtest:window
```

`backtest:export-picks` signs in as the QA user and saves slot titles only (no names, no user ids). Reports land in `data/prediction-backtest/reports/` and are not committed. Unit tests: `npm run test:prediction-backtest`.

Features still use only shows before the night being scored. Picks and the night's setlist are labels, not inputs.

## Does the current model still beat the simple lists?

Yes. `v0.1.1-explainable` still passes the old gate on the wide window: it meets or beats each baseline on slot hit@5 or recall@10. **No weight change. No `MODEL_VERSION` bump.**

| Model | recall@10 | slot hit@5 | nights the top song in every slot would score 0 |
|---|---:|---:|---:|
| Most played overall | 0.089 | 0.077 | 0.85 |
| Lowest gap first | 0.012 | 0.015 | 0.96 |
| Played a lot lately | 0.056 | 0.044 | 0.91 |
| **Current model** | **0.150** | **0.199** | **0.47** |

Recall@10 is the share of that night's songs sitting in the model's top 10. Slot hit@5 is how often the real opener, closer, or encore is in that slot's top 5. The small 2026-07-22 freeze (26 nights) had recall@10 at 0.186. On 94 nights it is 0.150. The earlier number was a bit high. The ranking still beats the simple lists.

## Is playProb a real percent?

No. The order is useful. The number is high.

`playProb` is the hand-tuned S-curve in the model. Scorecard and Make Picks show it as a percent. On the 94 nights, songs the model has seen play about **6.5%** of the time. A flat guess of 6.5% for every song scores better than the published percent (Brier **0.061** vs **0.185**; lower is better). Adding the `<1%` floor for songs that played but were new does not fix it (Brier 0.188).

| Model percent | Song-nights | How often it actually played |
|---|---:|---:|
| 10–20% | 133 | 1.5% |
| 20–30% | 2,553 | 2.2% |
| 30–40% | 7,997 | 2.9% |
| 40–55% | 10,658 | 6.3% |
| 55–100% | 2,918 | 21.2% |

The model almost never says under 20%. A typical night has about **31 songs at 55% or higher**, and those songs play about 1 time in 5, not 1 time in 2. Higher bins do play more often, so the sort is real. The percent is roughly three times the frequency.

## Against real pick cards

Usable `picks` docs run from **2026-04-16 through 2026-10-12**: **38 nights, 484 graded cards**. There is no earlier season in Firestore. One saved card for 2026-12-30 has no setlist yet and was not scored. Nights in this slice have 8 to 18 cards.

| | Real cards | Model's top song in each slot |
|---|---:|---:|
| Exact slot (opener, closer, encore) | 3.0% | 5.3% |
| A filled slot's song was played somewhere | 23% | 16% of the model's six slots |
| Card missed the set entirely | 25% | 40% |
| Share of the night's songs named | 8.1% per card | 12.3% in the top 10 |

Players already pick songs the model calls likely (mean published percent on a pick is **44%**). Those picks play **23%** of the time. That is better than the 6.5% base rate and worse than 44%.

High published odds are **under-selected** relative to how often the songs play, and **over-stated** relative to the percent:

| | Songs | Played | Share of cards that include the song |
|---|---:|---:|---:|
| 40% or higher | 5,390 | 8.6% | 2.9% |
| 55% or higher (safe band) | 1,104 | 17.7% | 5.5% |

About **3%** of filled slots are the model's top song for that slot. People are not copying the model.

Same player table with priors capped at the live 120-show limit: exact slot 5.9% for the model's top song, zero-score 37%. Same story.

## Slot rank vs the show-wide percent

Keep the stored number as the show-wide play chance. That is what Make Picks and the crowd-helper Odds chip mean. Do not replace it with slot score. Slot score (`playProb` times slot history) is what Lab uses to order a slot, and that order is the part that beats the simple lists (slot hit@5 of 0.20 vs under 0.08). It is not a percent, and this run does not turn it into one.

## Should the live file use this wider window?

No. Same model, three prior caps, 94 nights:

| Priors used | recall@10 | slot hit@5 | playProb Brier |
|---|---:|---:|---:|
| Every earlier show in the 3-year cache | 0.150 | 0.199 | 0.185 |
| Last 120 shows (live merge cap) | 0.149 | 0.204 | 0.185 |
| Last 80 shows (older cap) | 0.147 | 0.197 | 0.189 |

Using more than 120 earlier shows does not help. Leave `DEFAULT_HISTORY_YEARS` at 1 and `DEFAULT_MERGED_HISTORY_LIMIT` at 120. That is a separate deploy choice, and this measurement says not to take it.

## Predictive Mode (#652)

**Do not ship it on this evidence.**

The ranking has some value. It beats "most played," "played lately," and "long gap first." Its top song for a slot is a bit more often the exact song than the average player (5% vs 3%).

That is not enough to put the list in front of everyone.

- The percent is not a frequency. A focus list labeled 55% would be wrong about four times in five.
- A card made of each slot's top song misses the set on 40% of nights. Real cards miss on 25%. The top suggestion is worse at avoiding a blank night than the room we already have.
- The room is not herded. Two cards share about 5% of their songs. A night has about 51 different songs across cards. The most picked song is on about 40% of cards. Predictive Mode would show every player the same short list for a slot. The room is not on that list today (3% of fills). Pulling people onto it would tighten the game for a list that does not beat them at staying off zero.

Prediction Lab can keep showing several songs and a reason. That matches a ranking that is better than the simple lists and a percent that should not be read as a promise. Recalibrating the S-curve is [#653](https://github.com/Road2Media/set-picks/issues/653), not this change.

## What this does not do

- Does not change `MODEL_WEIGHTS` or `MODEL_VERSION`.
- Does not change game scoring.
- Does not publish a new `pick-recommendations.json`.
- Does not turn on Predictive Mode.

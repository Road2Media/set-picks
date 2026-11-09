# Pick recommendations artifact (#650)

Versioned Storage JSON for the upcoming show’s slot-aware song recommendations. Powers Prediction Lab (#651) and Predictive Mode (#652). Complements the song catalog — join by normalized title.

## Publish path

1. Resolve upcoming show from `show_calendar/snapshot` via `getNextShow`.
2. Load priors: private Phish.net history window (`pick-recommendations/history/window.json`, ~1y) **merged** with `official_setlists` docs (`showDate < targetDate`; Firestore wins on date ties).
3. Rank with `v0.1.1-explainable` (`functions/pickRecommendationsModel.js`).
4. Write live **`pick-recommendations.json`** (+ optional private archive).

| Trigger | Export |
|---------|--------|
| Schedule `15 */6 * * *` ET | `scheduledPickRecommendations` |
| Admin callable | `refreshPickRecommendations` |
| Schedule `40 4 * * *` ET | `scheduledPickRecommendationHistory` (Phish.net window sync) |
| Admin callable | `refreshPickRecommendationHistory` (`{ force?, years? }`) |

**No-op** when: no upcoming show, invalid target, or empty merged history (`skipped: true` + `reason`).

Deploy: `firebase deploy --only storage` (history rules) + `npm run deploy:functions:phishnet`.
First-time ops: run `refreshPickRecommendationHistory` (or local Admin SDK sync) once so the window exists, then refresh recommendations.

## Client

- `usePickRecommendations()` in `features/picks` — Storage `getDownloadURL` + 6h localStorage TTL + stale fallback; `null` when missing.
- Override: `VITE_PICK_RECOMMENDATIONS_URL`.

## Payload (summary)

```json
{
  "generatedAt": "ISO",
  "modelVersion": "v0.1.1-explainable",
  "targetShow": { "date", "venue", "city", "tour", "timeZone" },
  "historyShowCount": 80,
  "historySource": "merged",
  "topK": 25,
  "slots": {
    "s1o": [{ "name", "normalizedName", "rank", "score", "playProb", "slotAffinity", "confidence", "riskBand", "reasons" }],
    "s1c": [],
    "s2o": [],
    "s2c": [],
    "enc": [],
    "wild": []
  },
  "playProbBySong": { "tweezer": 0.184 }
}
```

`playProbBySong` (**v1.68.0+ / #767**) is show-wide `playProb` for every song in the history window (normalized title keys). Make Picks and the Make Picks crowd-helper Odds chip use it. Lab still reads `slots` top-K only. Scorecard stopped reading this file in **v1.110.0 / #1043** and shows live crowd % after showtime instead.

Model methodology: `docs/scoring-analysis/08-recommendation-model.md`.

### Risk bands (`riskBand`)

| Band | Meaning |
|------|---------|
| `safe` | High show-wide play probability (likely somewhere tonight) |
| `slot_fit` | Strong for **this** slot over window *t* (frequent historical occupant of s1o/s1c/…) |
| `long_shot` | Bustout gap ≥ 30 shows + low playProb |
| `unbanded` | Ranked residual; Prediction Lab hides these |

Same slot-frequency frame applies to every positional slot; `wild` has no `slot_fit`.

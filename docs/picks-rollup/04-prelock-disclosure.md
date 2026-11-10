# Pre-lock disclosure: crowd pulse (#689 / #694)

**Decision (2026-07-27):** Pre-lock, **preview Song + Last blur**; Pickers / Gap stay visible. Full deep tables (multi list / gaps / vintage / leaders) **blur until showtime**. (Earlier 2026-07-20 decision kept named top songs visible; tightened after product feedback.)

**Ship status:** Standings crowd pulse productized in #694 (no “prototype” label). **v1.107.0:** the Stats night deep dive is `/dashboard/stats/night` (P1). **v1.108.0:** the Make Picks helper (P2) shows historical tour chalk before showtime and live consensus chips after lock. Pre-lock, the stats page blurs names the same way this card does. **v1.109.0:** Preferences can hide those three surfaces (`users.gamePrefs.hideCrowdPulse`). Hiding them does not change this blur. When they stay visible, pre-lock names stay blurred until showtime. **v1.110.0 (#1043):** Scorecard crowd % uses this same night aggregate and the same showtime gate (`LIVE` / `PAST` only). Hide crowd pulse also hides that line and Scorecard overlap. Counts while picks are still open stay off.

## Product split

| Surface | Pre-lock (`NEXT`) | Post-lock (`LIVE` / `PAST`) |
|---------|-------------------|-----------------------------|
| Pickers · unique song counts | Visible | Visible |
| **Top multi-picker preview** (Song · Last) | **Blurred** | Clear |
| **Top multi-picker preview** (Pickers · Gap · meters) | Visible | Visible |
| Full multi list, highest gap, vintage, tour leaders tonight | **Blurred** (“Unlocks at showtime”) | Clear |

Rationale: aggregate lean (how many cards / gap) stays as social proof; named chalk + last-played stay private until nobody can edit. Deep catalog/leader meta remains the higher-leverage lock.

## Tradeoffs accepted

- Late editors see pick counts / gaps but not named chalk or last-played until showtime.
- Gap coaching tables and “what leaders locked” stay fully locked — the higher-leverage edges.
- Expandable “Full crowd stats” remains discoverable pre-lock (blurred preview + lock affordance) so unlock feels like a reward at showtime.

## UI notes

- Top songs use **frequency meters** via `crowd-picks/ui/FrequencyMeterRow` (Standings brand gradient).
- Blur is presentation-only; aggregators still compute (needed for unlock + CLI).
- Gate: `blurDeepStats={showStatus === 'NEXT'}` on the Standings card and on `/dashboard/stats/night`.
- Hide crowd pulse (`gamePrefs.hideCrowdPulse === true`) removes the Standings card and the Make Picks helper, replaces the stats night page with a Preferences link, and hides Scorecard crowd % and overlap. It does not unlock or rename the blur. Rank on Scorecard stays.

## Telemetry (v1.109.0)

GA4, same helper as the rest of the app:

| Event | When |
|-------|------|
| `crowd_pulse_teaser_expand` | Standings teaser opens (`via: summary`). A pre-lock click on Full crowd stats is `via: full_link` and `deep_stats: locked`. |
| `crowd_pulse_full_expand` | Full crowd stats is opened after lock (`deep_stats: open`). |
| `crowd_pulse_helper_use` | Make Picks **Use** fills the first open slot. The card is not saved until Lock In Picks. |

## Still deferred

- `picks_night_stats/{showDate}` — not written. Each surface already uses the shared night aggregate over `picks where showDate ==`. Phase B volume is a mid-teens picker count. No lock or rollup step already holds that aggregate, so a new collection would be a new writer, rules, and a client read switch. Revisit when a night's picker count makes that scan expensive.
- Phase B product deferrals stay off the UI: rare-only lists, diversity, slot fill %, pool %.

## Out of scope (later)

- Picks helper shipped on Make Picks (v1.108.0): live consensus chips only post-lock; historical tour chalk pre-lock
- Link to dedicated Stats surface — shipped as `/dashboard/stats/night` (P1)
# Pre-lock disclosure: crowd pulse (#689 / #694)

**Decision (2026-07-27):** Pre-lock, **preview Song + Last blur**; Pickers / Gap stay visible. Full deep tables (multi list / gaps / vintage / leaders) **blur until showtime**. (Earlier 2026-07-20 decision kept named top songs visible; tightened after product feedback.)

**Ship status:** Standings crowd pulse productized in #694 (no “prototype” label). **v1.107.0:** the Stats night deep dive is `/dashboard/stats/night` (P1). Picks helper remains P2. Pre-lock, that page blurs names the same way this card does.

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

## Out of scope (later)

- Opt-out pref for competitive players (“hide crowd pulse”)
- Picks helper: live consensus chips only post-lock; historical tour chalk pre-lock
- Telemetry: teaser expand attempts vs post-lock full expand
- Link to dedicated Stats surface — shipped as `/dashboard/stats/night` (P1). Picks helper and the hide-crowd pref stay later.
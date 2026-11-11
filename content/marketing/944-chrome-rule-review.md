# #944 Marketing chrome rule — skill review

**Status:** Approved + implementing (v1.58.0)  
**Date:** 2026-08-08 (review) / 2026-08-08 (execution)  
**Issue:** [#944](https://github.com/pat792/set-picks/issues/944)  
**Related:** [#942](https://github.com/pat792/set-picks/issues/942) content IA (chrome only; not copy)  
**Code tokens:** `src/shared/ui/marketingEditorialChrome.js`

---

## 1. Verdict

**APPROVE WITH TWEAKS**

Proposed rule is correct:

| Surface class | Chrome | Routes |
|---------------|--------|--------|
| Editorial / SEO prose | Light main (`bg-slate-50`) | `/how-it-works`, `/phish-setlist-prediction-game`, `/about`, **`/how-scoring-works`** |
| Product / data | Dark (brand shell + dark UI) | `/tour-stats*` |

Do **not** darken About/keyword to match Scoring/Tour stats. Do **not** light-theme Tour stats.

**Tweak:** Do not ship “light page + unchanged dark `ScoringRulesContent` panel” as the end state. That keeps Scoring as a modal island on paper and fails hop consistency with HIW / About / keyword. Light page chrome **and** a light presentational surface for the rules block.

---

## 2. Scoring implementation (pick one)

**Pick: shared surface variant prop on `ScoringRulesContent`**

| Option | Decision |
|--------|----------|
| Light wrapper only (dark panel on `slate-50`) | Reject as sole fix — hybrid chrome |
| Marketing-only fork | Reject — point-value / copy drift risk |
| **Shared `surface` / `variant` prop** (`dark` default, `light` for marketing) | **Ship this** |

**Rationale**

- Modal keeps default dark; `ScoringRulesModal` call sites unchanged.
- Marketing `/how-scoring-works` uses `surface="light"` (or equivalent) inside a `bg-slate-50` page wrapper; next-links switch to `LINK_ON_LIGHT`.
- Single structure for rules math/copy; tokens diverge by surface only.
- Keep export via `features/scoring/marketing.js` (no dashboard barrel on marketing entry).

**Page shape (target):** Match editorial peers — full-width light main, centered column, light rules presentation (white/soft panel or uncarded prose with accent score chips), not a floating `bg-surface-panel/50` glass card.

---

## 3. Contrast / a11y

- **Page next-links / prose links on light:** `LINK_ON_LIGHT` (and `CARD_LINK_ON_LIGHT` only if card CTAs appear). Drop `LINK_ON_DARK` from `HowScoringWorksPage` once the main is light.
- **In-app modal + Tour stats:** keep `LINK_ON_DARK` / dark content tokens.
- **Light rules surface:** headings/body must use light-readable tokens (`slate-900` / `slate-600–700`), not `text-white` / `text-content-secondary` from the dark panel.
- **Score chips on light:** keep hue meaning (blue / brand / violet / amber); verify icon/number contrast on pale chip fills (bump fill or text weight if needed).
- **Footnote / superscript `*`:** ensure amber (or emerald) link contrast on light ≥ WCAG AA for UI text.
- **Shell footer:** stays dark-styled over brand backdrop — OK; do not apply `LINK_ON_LIGHT` in footer/header chrome.
- **Focus rings:** keep existing `focus-visible:ring-brand-accent-blue` on both surfaces.

---

## 4. Brand continuity

**Dark sticky header + dark footer over light main: OK — keep.**

Already the pattern on HIW / About / keyword. Shell (`MarketingPageShell`) is venue/brand frame; light main is editorial paper. Changing to a light header is out of scope (#706 territory) and would fracture splash ↔ marketing continuity.

Intentional hop story after fix:

1. Editorial ↔ editorial (HIW / The game / About / Scoring) — same light family  
2. Editorial → Tour stats — enter product/data (dark)  
3. Tour stats → Scoring — leave product for rules doc (dark → light) — preferred over today’s dark → dark “same mode” false continuity

---

## 5. Explicit non-goals

- Light-theme `/tour-stats*`
- Darken About / keyword / HIW
- Visual change to in-app `ScoringRulesModal` (except shared default that remains dark)
- Light marketing header/footer redesign
- #937 how-it-works copy, #926 tour-stats SEO, #706 mobile nav
- Shell API churn unless a tiny `mainClassName` is needed for paint (prefer page-owned light wrappers)

---

## 6. Acceptance checklist deltas

Keep issue acceptance; add:

- [ ] Documented rule: **editorial light / product dark** (this file or short pointer from `content/marketing/README.md`)
- [ ] `/how-scoring-works` uses light main **and** light rules surface (not dark panel on light gutters only)
- [ ] `ScoringRulesModal` visual unchanged (default `surface="dark"`)
- [ ] `HowScoringWorksPage` next-links use `LINK_ON_LIGHT`
- [ ] Dark sticky header/footer retained; no light header in this issue
- [ ] Hop smoke: HIW → Scoring (light→light), Scoring → Tour stats (light→dark), Tour stats → Scoring (dark→light)
- [ ] Safari private AC on touched marketing routes (per issue; post-#925)
- [ ] Documented **editorial title/eyebrow tokens**; HIW / keyword / About / marketing Scoring H1s aligned (or intentional exceptions noted)

---

## 7. Editorial title / eyebrow system (shipped)

| Token | Class constant | Use |
|-------|----------------|-----|
| Article | `MARKETING_EDITORIAL_ARTICLE` | Light `bg-slate-50` main |
| Column | `MARKETING_EDITORIAL_COLUMN` | `max-w-3xl` reading width |
| Eyebrow | `MARKETING_EDITORIAL_EYEBROW` | Optional — keyword / definitional only |
| H1 | `MARKETING_EDITORIAL_H1` | `text-3xl → md:text-5xl`, sentence case, slate-900, centered |
| H1 inset | `MARKETING_EDITORIAL_H1_INSET` | Same size ramp, left-aligned (Scoring light panel) |
| Lede | `MARKETING_EDITORIAL_LEDE` | `text-lg` slate-600 |
| H2 | `MARKETING_EDITORIAL_H2` | `text-2xl` display |

**Exceptions (intentional):** Tour stats + in-app Scoring modal keep product title rules (dark / uppercase modal H1). Splash Game Format teaser may keep its local display scale (home composition, not editorial page).

**Viewport / type tokens (#968):** gutters, header height, and light type roles live in `src/shared/ui/marketingEditorialViewport.css`. See `content/marketing/968-editorial-viewport-tokens.md`. Do not reopen this chrome split to change splash `100svh` or dashboard `text-body`.

Issue comment: https://github.com/pat792/set-picks/issues/944#issuecomment-5229186779

---

## Grounded notes (inventory confirmed)

- Light: `HowItWorksPageContent`, `PhishSetlistPredictionGamePageContent`, `AboutPageContent` — `bg-slate-50` + `LINK_ON_LIGHT`
- Dark product: `PublicTourStatsPanel` — brand shell + `LINK_ON_DARK`
- Scoring today: `HowScoringWorksPage` + shared `ScoringRulesContent` (`bg-surface-panel/50`, white type) + `LINK_ON_DARK`; modal reuses same content
- Shell: always dark sticky header / footer; main is transparent pass-through

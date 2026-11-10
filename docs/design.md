# Design System Guidelines: Setlist Pick'em

## 1. Visual Theme & Atmosphere

Setlist Pick'em features a deep, high-contrast "dark mode" interface that captures the midnight excitement of live music. The design uses a neon teal (`#2dd4bf`) as the primary brand accent against deep venue backgrounds (see **`brand-bg` / `brand-bg-deep`** in `src/index.css` — Kuroda-tinted indigo). The aesthetic relies heavily on "glassmorphism"—translucent **surface** tokens (`surface-panel`, etc.) and subtle border glows rather than flat, opaque cards. 

The typography utilizes a two-font system: **Space Grotesk** for high-impact, stylized headings and branding, and **Inter** for highly legible, dense data (like leaderboards and settings). Both are **self-hosted** variable fonts under `public/fonts/` (no Google Fonts CSS). 

**Key Characteristics:**
- **Neon Teal** (`#2dd4bf`) as the primary interactive accent, often paired with a custom neon drop-shadow glow (`shadow-glow-brand`).
- **Two-font system**: `Space Grotesk` (Display) and `Inter` (Sans/Body).
- **Glass Surfaces**: Cards and inputs use translucent backgrounds (`bg-surface-panel/50`) with subtle inset borders.
- **Differentiated Buttons**: Primary action buttons use rounded rectangles, while secondary filters use full pill shapes.
- **Gradients**: The main brand wordmark utilizes a red-to-blue gradient (`#ef4444` to `#3b82f6`). The **in-app and splash chrome wordmark** is delivered as an **SVG image** (not the `text-display-brand-bar` utility alone). See **§7 Brand wordmark & asset storage** for paths and sizing.

## 2. Color Palette & Roles (Tailwind Tokens)

### Brand & Interactive
- **Brand Primary (`brand-primary`)**: `#2dd4bf` — Primary CTAs, active states, user scores.
- **Brand Strong (`brand-primary-strong`)**: `#14b8a6` — Button hover states, high-emphasis icons.
- **Brand Kicker (`brand-kicker`)**: `#2dd4bf` — Secondary accents.
- **Accent Red (`brand-accent-red`)**: `#ef4444` — Incorrect picks, destructive actions, logo gradient start.
- **Accent Blue (`brand-accent-blue`)**: `#3b82f6` — Logo gradient end.

### Backgrounds (Deep Slate)
- **Base Bg (`brand-bg`)**: `#0f172a` — Standard application background.
- **Deep Bg (`brand-bg-deep`)**: `#020617` — Maximum contrast areas, lowest elevation.

### Surfaces (Glassmorphism)

Implemented as CSS variables in `src/index.css` and mapped in `tailwind.config.js` (opacity per token). Current values are **slate-forward** with a slight indigo bias so panels sit softly on the venue background (not saturated violet).

- **Glass (`surface-glass`)**: Dark blue-slate wash — subtle overlays, details chrome.
- **Chrome (`surface-chrome`)**: Sidebar / dense chrome — slightly lifted vs glass.
- **Panel (`surface-panel`)**: Standard cards and containers (~`rgb(34 42 62 / 0.5)` effective).
- **Panel Strong (`surface-panel-strong`)**: Elevated rows, modals, gradient starts (~`rgb(42 52 78 / 0.72)` effective).
- **Inset (`surface-inset`)**: Nested wells inside panels.
- **Field (`surface-field`)**: Form inputs and song slots (`#0f172a` channel).

**Hero dashboard cards** (e.g. Pool Hub “Game status”, Picks form): use `Card` **`variant="venue"`** — `border-brand-primary/30`, gradient `from-surface-panel-strong/72 to-brand-bg-deep`, `shadow-glow-brand` + inset glass (see [`Card.jsx`](../src/shared/ui/Card.jsx)).

### Content (secondary copy)

- **`text-content-secondary`** — Warm muted foreground for helper text, uppercase field labels, meta descriptions, and inactive nav (token: `--content-secondary` in `index.css`, ~slate-300). Prefer over raw `text-slate-400` / `text-slate-500` on dashboard routes.

### Borders
- **Glass Border (`border-glass`)**: `rgba(255, 255, 255, 0.25)` — Highlights on elevated cards.
- **Subtle Border (`border-subtle`)**: `rgb(51 65 85 / 0.5)` — Standard card and input outlines.
- **Muted Border (`border-muted`)**: `rgb(71 85 105 / 0.6)` — Dividers.

### Semantic & Gamification
- **Rank 1 Gold**: `#d97706` (or standard `text-amber-500`/`bg-amber-500`) — Used exclusively for 1st place leaderboard indicators.
- **Success/Score Teal**: `text-brand-primary` — Used to highlight user scores (e.g., "45 PTS").

### Tertiary+ accents & dashboard “slices”

As each **menu tab** (Standings, Picks, Pools, Profile, etc.) gains more **card stacks**—recaps, banners, list rows, and tool-specific panels—the palette needs **roles beyond primary + secondary** so every block does not collapse into the same teal ring or the same meta gray.

**Role ladder (conceptual — implement as Tailwind today, promote to CSS tokens when a pattern repeats):**

| Tier | Role | Examples (non-exhaustive) | Guardrails |
|------|------|---------------------------|------------|
| **Primary** | Money path, scores, main CTA | `brand-primary`, `shadow-glow-brand` | One dominant teal action per dense viewport when possible. |
| **Secondary** | Labels, helpers, inactive meta | `text-content-secondary`, `border-border-subtle/50` | Default for uppercase eyebrows and hint copy. |
| **Tertiary** | **Card identity / wayfinding** — “this slice is different from its neighbor” without competing with CTAs | Muted violet/slate/blue **borders or text** at low saturation; optional **named** ring (e.g. recap card) | Must not read as “click me” like primary teal; avoid amber/gold except true 1st-place badges. |
| **Quaternary+** | Rare emphasis inside a tertiary card (badges, inline status) | Chip fills, icon tint | Prefer **semantic names** in code (`status-live`, `recap-border`) even if mapped to Tailwind for now; **promote to `index.css` + `tailwind.config.js`** once the same pairing appears in **two or more** tabs or features. |

**When to introduce a new color token (checklist):**

1. The same accent pairing (border + text + background) appears in **two or more** surfaces or tabs.  
2. It **cannot** be expressed with existing `brand-*`, `surface-*`, `content-secondary`, or Rank 1 gold without breaking the roles above.  
3. It passes **contrast** on the intended surface (`surface-panel`, `surface-inset`, or `brand-bg`).  
4. It is documented here with a **one-line role** so agents and humans do not reuse it for a conflicting meaning later.

**Tab-specific card variation:** Prefer **surface elevation + border weight + typography** first; add a **tertiary accent** only when those are not enough to separate stacked modules (e.g. “your rank” recap above a frosted leaderboard list). Do not let tertiary colors multiply into a rainbow per screen—**one tertiary family per major column** is a good default.

## 3. Typography Rules

### Font Families
- **Display (`font-display`)**: `Space Grotesk` — Used for all page titles, hero text, and the brand wordmark. File: `public/fonts/space-grotesk/SpaceGrotesk-VariableFont_wght.woff2`.
- **Sans/Body (`font-sans`)**: `Inter` — Used for all buttons, UI elements, song names, and leaderboards. File: `public/fonts/inter/InterVariable.woff2` (#802).

### Hierarchy (Tailwind Classes)

| Role | Class | Font | Size / Line Height | Tracking |
|------|-------|------|--------------------|----------|
| Splash Hero | `text-display-hero-splash` | Space Grotesk | 3.75rem / 1.04 | -0.028em |
| Page Title | `text-display-page` | Space Grotesk | 2rem / 1.2 | -0.02em |
| Brand Wordmark (text fallback / legacy) | `text-display-brand-bar` | Space Grotesk | 1.5625rem / 1.08 | -0.02em |
| Section Header | `text-display-sm` | Space Grotesk | 1.3125rem / 1.28 | -0.015em |
| General Title | `text-title` | Inter | 1.5rem / 1.2 (Bold) | Normal |
| Standard Body | `text-body` | Inter | 0.875rem / 1.5 | Normal |
| Secondary / meta copy | `text-content-secondary` | Inter | (inherits) | Use for labels, helpers, empty states |

**Editorial marketing (not this table):** light pages (`/how-it-works`, `/about`, `/phish-setlist-prediction-game`, `/how-scoring-works`) use local viewport + type tokens in [`src/shared/ui/marketingEditorialViewport.css`](../src/shared/ui/marketingEditorialViewport.css) (#968). **Do not** apply that ladder to dashboard or `/tour-stats*` — post-login body remains `text-body` (0.875rem). Note: [`content/marketing/968-editorial-viewport-tokens.md`](../content/marketing/968-editorial-viewport-tokens.md).

## 4. Component Stylings & Shapes (CRITICAL)

### Primary Action Buttons (CTAs)
- **Role:** Submitting forms, updating data, major state changes (e.g., "UPDATE PICKS", "JOIN POOL").
- **Shape:** Rounded Rectangle (`rounded-xl` or `rounded-2xl`). Do NOT use `rounded-full`.
- **Style:** Solid `bg-brand-primary` with dark text (`text-brand-bg-deep`).
- **Hover:** `bg-brand-primary-strong` with `shadow-glow-brand`.

### Filters & Chips
- **Role:** Toggling data, switching views (e.g., the "Compare" pool filters like "Everyone").
- **Shape:** Full Pill (`rounded-full`).
- **Style (Inactive):** `bg-surface-panel/50` with no border or a transparent border.
- **Style (Active):** Slightly lighter indigo fill (`bg-surface-panel-strong/72`) with a visible indigo/slate border (`border-border-subtle/50`). Do not use teal here to avoid competing with CTAs.

### Navigation Tabs (Segmented Controls)
- **Role:** Switching major container views (e.g., "Join Pool" vs "Create Pool").
- **Style (Active):** Dark background with a bottom border/glow using `brand-primary` (`border-b-2 border-brand-primary`).

### Form Inputs & Pick Slots
- **Shape:** `rounded-lg` or `rounded-xl`.
- **Inactive:** `bg-surface-field` with `border border-border-subtle/50` (keep it dark and muted).
- **Focus/Active:** Change border or ring to `brand-primary` (`ring-brand` or `border-brand-primary`) to guide the user's eye. Do not use random blue/indigo borders.

### Cards (three tiers — `Card` variants)

| Tier | `Card` variant | Use when |
|------|----------------|----------|
| **Quiet** | `default`, `solid`, `panel` | Dense lists, nested shells, subtle chrome — muted border, no teal edge. |
| **Middle (frosted)** | `frosted` | Detail cards that are not one person or one pool: **`border-brand-primary/30`**, `bg-surface-panel/50`, **`backdrop-blur-md` / `backdrop-blur-xl`**, `shadow-inset-glass` — glassmorphism without hero glow. A pool in a list is a **row**, not this tier. |
| **Hero** | `venue` | Primary task blocks (Picks form, Pool Hub game status): teal border + **gradient** into `brand-bg-deep` + **`shadow-glow-brand`**. |

Legacy copy for quiet cards: **Background** `bg-surface-panel/50`, **Border** `border-border-subtle/50`, **Radius** `rounded-xl` / `rounded-2xl`, **Depth** `shadow-inset-glass`.

### Standings column and free-standing Picks notices (#1088)

These are one family. The box is the sponsor card (`DashboardJobShell`): `rounded-xl`, `border-border-subtle/60`, `bg-surface-panel/40`, no ring, no glass, no glow. A ~6% wash sits on a second layer.

| Job | Wash | Label | Cards |
|-----|------|-------|-------|
| **You** | `bg-amber-200/[0.06]` | `text-amber-200/90` | Your rank, scorecard |
| **The night** | `bg-brand-primary/[0.06]` | `text-brand-primary` | Tonight's show, winner, official setlist, crowd pulse, Picks Lab |
| **Quiet** | none | `text-content-secondary/70` when a label exists | Sponsor, invite, empty states, waiting, too early, picks lock reminder, picks locked, the stats tip |

Scores stay teal on every card. The Invite button stays teal; the invite box does not. The dev gallery at `/card-shell-preview` is the visual spec (production redirects home). The picks form and the one-line lock note inside it stay the heavier hero and do not use this shell. Tonight's show on Standings uses the night shell.

### Stat tiles (#1089)

A new metric that sits in a grid is a **tile**. Tour Stats counts (unique songs, songs played, unique ratio, bustouts) and the "Your picks this tour" cells are tiles. A tile is not a Standings card and not a settings panel.

Tiles and their section headers share one shell (`DashboardTileShell`): the quiet sponsor box (`rounded-xl`, `border-border-subtle/60`, `bg-surface-panel/40`, no ring, no glass, no glow) and a short header band. The band is the stat's color: teal, amber, blue, or emerald. That color stays on the band. The outer box does not grow a border per stat.

The Phase 1 washes stay on cards. `bg-amber-200/[0.06]` (you) and `bg-brand-primary/[0.06]` (the night) do not move onto tiles.

Personal stats expandable sections use the Phase 1 card (`DashboardJobShell` tone `none`): the same box, no label color, and no job wash.

Use a card when the module is free-standing on Standings or Picks. Use a tile when the metric is one cell in a stat grid. Use a panel for a settings or profile block. Use a row for one person or one pool in a list.

### Settings panels and list rows (#1090)

These are not Standings cards. They do not use the you / the night / quiet washes (`bg-amber-200/[0.06]`, `bg-brand-primary/[0.06]`), the teal hero edge, or the stat-tile header band.

| Job | Shell | Box |
|-----|--------|-----|
| **Panel** | `Panel` in [`Card.jsx`](../src/shared/ui/Card.jsx) | `rounded-3xl`, `border-border-subtle/50`, `bg-surface-panel/50`, `shadow-inset-glass`, `p-6` |
| **Row** | `Row` in the same file | `rounded-xl`, `border-border-subtle/45`, `bg-surface-panel/50`, `shadow-inset-glass`, the same padding as a dashboard card (`px-3.5 py-3.5`, `md:px-4 md:py-4`) |

**Panel** is a settings or profile block: account security, profile edit, profile stats, badge shelf, top picks, public profile, notification prefs, inbox, the install card, admin forms, and pool join / create.

**Row** is one person or one pool in a list: pool rows, show leaderboard rows, global ranking rows, tour ranking rows, pool hub leaderboard rows, and invite chooser options.

A self row (`tone="self"`) and a leading show row (`tone="leader"`) are border modifiers on that same shell. A first-place mark stays on the rank chip. Neither modifier is a new shell, and neither picks up the amber or teal wash.

Decision tree for a new box:

1. Free-standing module on Standings or Picks → card (`DashboardJobShell`).
2. One cell in a stat grid → tile (`DashboardTileShell`).
3. Settings or profile block → panel (`Panel`).
4. One person or one pool in a list → row (`Row`).

A new screen under `src/features` or `src/pages` does not paste its own `rounded-*` border. `scripts/verify-dashboard-ui-tokens.mjs` fails when a hand-built card border shows up outside these shells. Buttons, inputs, chips, and the existing grandfathered boxes stay as they are. The `/card-shell-preview` gallery remains the Phase 1 card spec.

## 5. Depth & Elevation (Glows over Shadows)

Because the app uses a dark theme, traditional black drop-shadows do not work. Depth is achieved through inset borders and neon glows.
- **Brand Glow (`shadow-glow-brand`)**: Use on primary interactive elements to make them pop off the dark background.
- **Inset Glass (`shadow-inset-glass`)**: Use inside panels to create a subtle 3D / beveled edge effect.

## 6. Do's and Don'ts

### Do
- Use `font-display` exclusively for large headings, keeping `font-sans` for dense UI to ensure readability.
- Rely on `surface-panel` with opacity for cards so the underlying `brand-bg` bleeds through slightly.
- Use `brand-primary` for scores. On the Standings column, rank numbers stay white.
- Use **tertiary** accents (see **§2 Tertiary+ accents**) for dense dashboard **slices**—recaps, anchors, tab-specific modules—when teal would over-compete or meta gray would under-differentiate.
- Strictly adhere to the shape rules: `rounded-xl` for CTAs and inputs, `rounded-full` for chips and filters.

### Don't
- Don't use opaque, solid gray backgrounds for cards; always use the translucent `surface-` variables.
- Don't mix border radii randomly (e.g., don't put a `rounded-full` CTA inside a perfectly square card).
- Don't use traditional drop shadows (`shadow-md`, `shadow-xl`); use the custom `glow` shadows.

## 7. Brand wordmark & asset storage

### Where files live

Static wordmark assets are served from **`public/branding/`** (URL path **`/branding/…`**).

| File | Role |
|------|------|
| **`splash-gradient-4x1.svg`** | **Primary lockup** — full gradient (red → blue). Cropped viewBox; used for splash hero, splash header, dashboard mobile brand bar, and desktop sidebar. |
| **`splash-wordmark.svg`** | **Optional** white/single-color variant; not wired in code by default. |

Add or replace SVGs here; update **`src/shared/config/branding.js`** if filenames or default variant change.

### Code contract (`src/shared/config/branding.js`)

- **`BRAND_GRADIENT_WORDMARK_SRC` / `BRAND_WORDMARK_SRC` / `BRAND_HERO_WORDMARK_SRC`** — canonical **URL** for the gradient asset (`public/branding/…`; emails/OG/img surfaces).
- **Hero-only (inline SVG, #962)**: bundled `src/shared/assets/branding/splash-gradient-4x1.svg` via `?raw` in `SplashHeroWordmark` — avoids WebKit `<img src=".svg">` raster softness. Frame/scale: `brandHeroWordmarkAspectFrameClassNames` + `brandHeroWordmarkSvgClassNames` + `brandHeroWordmarkScaleWrapperClassNames`; crop with `preserveAspectRatio` `* slice` (not CSS `object-*`). Legacy `brandHeroWordmarkImgClassNames` remains for img fallbacks.
- **Per-surface img classes** — `brandWordmarkImgClassNames.splashHeader`, `.dashboardMobileBar`, `.dashboardSidebar` (height/width/`max-w`/`object-*` tuned per bar or sidebar column).
- **Scale wrappers** — `brandWordmarkSplashHeaderScaleWrapperClassNames`, `brandWordmarkDashboardMobileBarScaleWrapperClassNames`, `brandWordmarkDashboardSidebarScaleWrapperClassNames` — `transform` + `origin` so the wide asset reads balanced next to nav type and CTAs.

UI surfaces that render the logo:

- **Splash**: `src/features/landing/ui/SplashHeader.jsx`, `SplashHeroSection.jsx`
- **Dashboard**: `src/app/layout/DashboardLayout.jsx` (sidebar), `src/app/layout/ui/DashboardMobileBrandBar.jsx`

Do **not** hardcode `/branding/…` paths in components; import from **`shared/config/branding`**.

## 8. Agent Prompt Guide

### Quick Tailwind Class Reference
- **Brand wordmark (img):** import `BRAND_WORDMARK_SRC`, `brandWordmarkImgClassNames`, and the matching scale wrapper from `src/shared/config/branding.js` — do not duplicate `/branding/…` paths in feature or layout files.
- **Background:** `bg-brand-bg`
- **Tertiary slice (conceptual):** differentiate stacked cards with border/ring + `text-content-secondary` eyebrows first; add a dedicated token only after the pattern repeats (see **§2 Tertiary+ accents**).
- **Standard Card:** `bg-surface-panel/50 border border-border-subtle/50 rounded-xl`
- **Frosted detail card:** `Card` `variant="frosted"` — teal border + blur + inset glass. Not a stat tile and not a list row.
- **Stat tile:** `DashboardTileShell` — quiet sponsor box plus a header band (teal, amber, blue, or emerald). No Phase 1 wash. No per-stat border on the outer box. A grid metric is a tile; a free-standing Standings or Picks module is a card.
- **Settings panel:** `Panel` — `rounded-3xl`, `border-border-subtle/50`, `bg-surface-panel/50`, inset glass, `p-6`. No Phase 1 wash.
- **List row:** `Row` — `rounded-xl`, `border-border-subtle/45`, `bg-surface-panel/50`, inset glass, dashboard-card padding. Self and leader are border modifiers. First place stays on the rank chip. No Phase 1 wash.
- **Primary Text:** `text-white font-sans`
- **Page Heading:** `text-display-page font-display font-bold text-white`
- **Primary Button (CTA):** `bg-brand-primary text-brand-bg-deep rounded-xl font-bold px-6 py-3 hover:bg-brand-primary-strong shadow-glow-brand`
- **Filter Pill (Active):** `bg-surface-panel-strong/72 border border-border-muted/60 rounded-full px-4 py-1 text-sm`

### Example Component Prompts
- *"Create a leaderboard row: Use `Row` from `src/shared/ui/Card.jsx`. The player's rank should be in a small box. If the rank is 1, use the gold badge styling on that chip, not a new shell. A self row uses `tone="self"`. The score text should be `text-brand-primary font-bold`."*
- *"Build a show card: `bg-brand-bg` container. Title should be `font-display text-display-md text-white`. Add a primary CTA rounded-rectangle button using `bg-brand-primary`."*
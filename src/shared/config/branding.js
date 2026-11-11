/**
 * Primary gradient lockup (cropped viewBox). Used for splash hero and shared wordmark URL;
 * splash header and post-auth chrome use the vinyl mark.
 * White-only variant: `splash-wordmark.svg` (not wired by default).
 */
export const BRAND_GRADIENT_WORDMARK_SRC = '/branding/splash-gradient-4x1.svg';

/** Circular vinyl-style mark — splash header A/B (replaces wide gradient wordmark when used). */
export const BRAND_SPLASH_HEADER_VINYL_MARK_SRC = '/branding/splash-vinyl-mark.webp';
/** Post-auth app chrome brand mark (mobile H1 + desktop sidebar). */
export const BRAND_APP_CHROME_MARK_SRC = BRAND_SPLASH_HEADER_VINYL_MARK_SRC;

export const BRAND_WORDMARK_SRC = BRAND_GRADIENT_WORDMARK_SRC;
export const BRAND_HERO_WORDMARK_SRC = BRAND_GRADIENT_WORDMARK_SRC;

/**
 * Hero frame: the SVG’s painted gradient is taller than the letterforms, leaving empty bands in
 * the artwork. Wider sm+ aspect + overflow clips height; mobile keeps the taller 16/5 frame.
 * #837: laptop/desktop uses a shorter frame + tighter max-width so header→copy isn’t crushed.
 */
export const brandHeroWordmarkAspectFrameClassNames =
  'mx-auto block aspect-16/5 w-screen max-w-none overflow-hidden sm:aspect-6/1 sm:w-full sm:max-w-[min(90vw,40rem)] md:max-w-[min(88vw,46rem)] lg:aspect-5/1 lg:max-w-[min(86vw,54rem)] xl:max-w-[min(84vw,62rem)]';

/**
 * Hero `<img>` classes (legacy). Prefer {@link brandHeroWordmarkSvgClassNames} + inline SVG —
 * `<img src=".svg">` rasterizes soft on WebKit. Mobile: `object-top`. sm+: `object-[center_62%]`
 * skips transparent SVG headroom above letterforms (#837).
 */
export const brandHeroWordmarkImgClassNames =
  'block h-full w-full min-h-0 object-cover object-top sm:object-[center_62%]';

/**
 * Hero inline `<svg>` classes. Fill the aspect frame; crop with `preserveAspectRatio` `* slice`
 * (CSS `object-*` does not apply to non-replaced inline SVG).
 */
export const brandHeroWordmarkSvgClassNames =
  'block h-full w-full min-h-0';

/**
 * Mobile “1.2×” via **layout width** (`120vw` + `ml-[-10vw]`) so the graphic scales as vector paint,
 * not `transform: scale()` (compositor can soften on iOS). `sm:` restores contained width.
 */
export const brandHeroWordmarkScaleWrapperClassNames =
  'block w-full overflow-visible max-sm:w-[120vw] max-sm:max-w-none max-sm:ml-[-10vw] motion-reduce:max-sm:w-full motion-reduce:max-sm:ml-0 sm:ml-0 sm:w-full';

/**
 * Per-surface img `className` tokens. Contexts differ in bar height and horizontal budget,
 * so reuse the same file with different constraints (do not rely on one global size).
 */
export const brandWordmarkImgClassNames = {
  /**
   * Fixed splash header (`h-16` / `h-20` bar). Wide gradient lockup: height-led + `max-w` so CTAs fit.
   */
  /** Heights absorb former wrapper scale (1.28 / 1.18) so we avoid transform blur on device. */
  splashHeader:
    'block h-[5.05rem] w-auto max-w-[calc(100vw-8.5rem)] object-contain object-left sm:h-[4.55rem] sm:max-w-[min(54vw,360px)]',
  /**
   * Desktop sidebar: width-led (`w-full h-auto`) so the ~2.5:1 crop uses the full column; fixed
   * height + object-contain was capping width and made the lockup tiny vs nav labels.
   */
  dashboardSidebar:
    'block h-auto w-full max-w-full object-contain object-center md:max-h-63',
  /**
   * Post-login mobile bar: compact height like pre–`scale()` chrome; lockup sized with `h-*` only
   * (no wrapper transform — avoids iOS raster blur).
   */
  dashboardMobileBar:
    'block h-[3.95rem] w-auto max-w-[calc(100vw-7rem)] object-contain object-left sm:h-[4.05rem] sm:max-w-[min(68vw,380px)]',
};

/** Post-auth app chrome uses the square vinyl mark (left in app, centered in sidebar). */
export const brandAppChromeMarkImgClassNames = {
  dashboardSidebar: 'block h-auto w-28 object-contain object-center md:w-32',
  dashboardMobileBar: 'block h-11 w-11 shrink-0 object-contain object-left sm:h-12 sm:w-12',
};

/** Inline SVG chrome: same box as {@link brandWordmarkImgClassNames} minus `object-*` (img-only). */
export const brandWordmarkChromeSplashHeaderClassNames =
  'block h-[5.05rem] w-auto max-w-[calc(100vw-8.5rem)] sm:h-[4.55rem] sm:max-w-[min(54vw,360px)]';

export const brandWordmarkChromeDashboardMobileBarClassNames =
  'block h-[3.95rem] w-auto max-w-[calc(100vw-7rem)] sm:h-[4.05rem] sm:max-w-[min(68vw,380px)]';

/**
 * No `scale()` — img `h-*` carries size (sharper on WebKit).
 * `flex` + `w-max` + `justify-start` pins the lockup to the leading edge (avoids `inline-block`
 * offset vs `inline-flex` parents; matches pre-scale optical left alignment).
 */
export const brandWordmarkSplashHeaderScaleWrapperClassNames =
  'flex w-max max-w-full shrink-0 items-center justify-start motion-reduce:transform-none';

/** Splash header vinyl mark: square asset, height-led to fit the fixed bar without crowding CTAs. */
export const brandSplashHeaderVinylMarkImgClassNames =
  'block h-[3.35rem] w-[3.35rem] shrink-0 object-contain object-center sm:h-[3.55rem] sm:w-[3.55rem]';

/** Same leading-edge contract as splash header (post-auth mobile bar). */
export const brandWordmarkDashboardMobileBarScaleWrapperClassNames =
  'flex w-max max-w-full shrink-0 items-center justify-start motion-reduce:transform-none';

/**
 * Sidebar: `md:flex` + `origin-center` + `object-center` on the img centers the lockup in `w-64`;
 * scale boosts height vs nav labels.
 */
export const brandWordmarkDashboardSidebarScaleWrapperClassNames =
  'block w-full max-w-full origin-left scale-[1.02] motion-reduce:scale-100 md:flex md:origin-center md:justify-center md:scale-100';

/**
 * Shared two-column shell for splash header + dashboard mobile brand bar (#174).
 * Keeps safe-area insets, grid track widths, and `sm:flex` handoff aligned.
 */
export const brandWordmarkBarRowGridBaseClassNames =
  'grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-visible pl-[max(1rem,env(safe-area-inset-left,0px))] pr-4 sm:flex sm:justify-between sm:gap-3';

/** Full-bleed row inside fixed splash header (`max-w-7xl` + responsive horizontal padding). */
export const brandWordmarkBarRowSplashExtrasClassNames =
  'h-full w-full max-w-7xl min-w-0 sm:px-6 lg:px-8';

/** Mobile dashboard bar: z-index stacks above scroll content; `sm:` horizontal matches legacy chrome. */
export const brandWordmarkBarRowDashboardExtrasClassNames =
  'relative z-20 sm:pl-4 sm:pr-4';

/**
 * Leading cell: splash vinyl / wordmark control — optical left edge (#174).
 * (Former ad-hoc `max-sm:-translate-x-*` lives here when we reintroduce it.)
 */
export const brandWordmarkSplashHeaderLeadingClassNames =
  'inline-flex min-w-0 items-center justify-start justify-self-start overflow-visible pl-0 pr-1 text-left outline-hidden transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs sm:shrink-0 sm:justify-self-auto sm:pr-2';

/** Leading cell: dashboard mobile H1 + link — micro nudge for vinyl square vs safe area (#174). */
export const brandWordmarkDashboardMobileLeadingClassNames =
  'flex min-h-0 min-w-0 items-center justify-start justify-self-start self-center overflow-visible text-left leading-none max-sm:ml-1 max-sm:translate-y-1 sm:flex-1 sm:ml-0 sm:translate-y-0 sm:justify-self-auto';

/**
 * Dashboard route titles: Space Grotesk page headings + mobile context bar.
 * Gradient pulls the venue teal into display type without flat “slate” meta gray.
 */

/** Desktop main h2 (hidden on mobile where context bar carries the title). */
export const dashboardPageTitleGradientClasses =
  'text-transparent bg-clip-text bg-gradient-to-r from-white from-[5%] via-white to-brand-primary drop-shadow-[0_2px_28px_rgb(var(--brand-primary)/0.2)]';

/** Admin / War Room — keep destructive red, add soft glow for parity with default tone. */
export const dashboardPageTitleWarRoomClasses =
  'uppercase text-red-500 drop-shadow-[0_0_22px_rgb(239_68_68_/_0.28)]';

/** Mobile context bar route name (compact display). */
export const dashboardMobileContextTitleGradientClasses =
  'font-display text-transparent bg-clip-text bg-gradient-to-r from-white from-[4%] to-brand-primary drop-shadow-[0_0_18px_rgb(var(--brand-primary)/0.22)]';

export const dashboardMobileContextTitleWarRoomClasses =
  'font-display uppercase text-red-500 drop-shadow-[0_0_14px_rgb(239_68_68_/_0.25)]';

/** “Tour Date” label — same white→teal gradient language as route titles, compact glow. */
export const dashboardTourDateLabelGradientClasses =
  'text-transparent bg-clip-text bg-gradient-to-r from-white from-[5%] via-white to-brand-primary drop-shadow-[0_0_14px_rgb(var(--brand-primary)/0.2)]';

/**
 * 1px gradient frame around the global show `<select>` (venue halo).
 * Inner control should use matching inner radius, `border-0`, field background.
 */
export const dashboardTourDateSelectChromeMobileWrap =
  'rounded-lg bg-gradient-to-r from-white/35 via-brand-primary/85 to-brand-primary p-px shadow-[0_0_18px_rgb(var(--brand-primary)/0.22)] focus-within:ring-2 focus-within:ring-brand-primary/45 focus-within:ring-offset-0 focus-within:ring-offset-transparent';

export const dashboardTourDateSelectChromeDesktopWrap =
  'rounded-xl bg-gradient-to-r from-white/35 via-brand-primary/85 to-brand-primary p-px shadow-[0_0_20px_rgb(var(--brand-primary)/0.24)] focus-within:ring-2 focus-within:ring-brand-primary/45 focus-within:ring-offset-0 focus-within:ring-offset-transparent';

/**
 * Desktop card around Tour Date / Tour / Year scope (#609). Mobile keeps the
 * same node and only paints this frame at the `desk` screen (#707).
 */
export const dashboardScopeSelectCardClasses =
  'desk:justify-between desk:gap-3 desk:rounded-2xl desk:border desk:border-border-muted/70 desk:bg-surface-panel-strong desk:p-3 desk:shadow-inset-glass desk:ring-1 desk:ring-border-glass/45 desk:backdrop-blur-md';

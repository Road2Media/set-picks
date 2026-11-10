/**
 * Readable secondary hyperlinks on dark vs light surfaces.
 * Prefer these over muted slate text for in-page / marketing navigation.
 */

/** Inline links on dark backgrounds (teal reads as a link, not muted chrome). */
export const LINK_ON_DARK =
  'rounded-xs font-semibold text-teal-300 underline decoration-teal-500/70 underline-offset-4 transition-colors hover:text-teal-200 hover:decoration-teal-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue';

/** Compact header chrome on dark. */
export const HEADER_LINK_ON_DARK =
  'rounded-xs text-xs font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue lg:text-sm';

export const HEADER_LINK_ACTIVE = 'text-white';

/** Footer / legal on dark. */
export const FOOTER_LINK_ON_DARK =
  'font-medium text-slate-300 underline decoration-slate-500 underline-offset-2 transition-colors hover:text-teal-300 hover:decoration-teal-400';

/** Inline links on light pages (slate-50 marketing). */
export const LINK_ON_LIGHT =
  'font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue';

/** Card “learn more” row on light. */
export const CARD_LINK_ON_LIGHT =
  'inline-flex items-center gap-1 rounded-md text-sm font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition-colors hover:text-emerald-800 hover:decoration-emerald-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue';

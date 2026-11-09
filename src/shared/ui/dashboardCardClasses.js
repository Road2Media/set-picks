/**
 * Dashboard content-card system — shared geometry, size levels, and type
 * scale for stacked cards on dashboard surfaces (Standings, Tour Stats, …).
 *
 * Size levels (collapsed/default state only; expanded height stays
 * content-driven):
 * - **L1 (promo/banner):** media tile (~56px) + title + subcopy + CTA.
 *   Examples: Invite promo, sponsor slot.
 * - **L2 (summary row):** inline 16px icon + eyebrow + optional one-line
 *   subcopy + right meta/chevron. Examples: Your rank, Setlist, Crowd pulse,
 *   Winner banner.
 *
 * Shape, size, and fonts are shared. The Standings / Picks column colors
 * its jobs through `DashboardJobShell` (you / the night / quiet). A stat
 * grid uses `DashboardTileShell`: that same quiet box, plus a header band.
 * Tiles do not take the you / night washes. A settings or profile block
 * uses `Panel`. One person or one pool in a list uses `Row`. Neither
 * takes the you / night washes.
 */

/** Outer radius for every dashboard content card/banner. */
export const DASHBOARD_CARD_RADIUS = 'rounded-xl';

/** Even padding for card shells (md bump included). */
export const DASHBOARD_CARD_PAD = 'px-3.5 py-3.5 md:px-4 md:py-4';

/**
 * `Card` className override — force card radius + pad over Card variant
 * defaults (`rounded-2xl`/`3xl`, `p-4`–`p-8`).
 */
export const DASHBOARD_CARD_SHELL = `!${DASHBOARD_CARD_RADIUS} !p-3.5 md:!p-4`;

/** L1 promo/banner reserved height (media tile + copy + CTA). */
export const DASHBOARD_CARD_L1_MIN_H = 'min-h-[5.75rem] md:min-h-[6.25rem]';

/**
 * L2 summary-row reserved height. Sized to the tallest natural L2 header
 * (eyebrow row + title line) so single-row cards center up to match.
 * Pair with `flex flex-col justify-center` on the shell.
 */
export const DASHBOARD_CARD_L2_MIN_H = 'min-h-[4.25rem] md:min-h-[4.5rem]';

/** 56px square media tile on L1 cards (logo/icon); border per surface. */
export const DASHBOARD_CARD_MEDIA_TILE = 'h-14 w-14 shrink-0 rounded-xl';

/** Inline icon before an L2 eyebrow; color per surface. */
export const DASHBOARD_CARD_EYEBROW_ICON = 'h-4 w-4 shrink-0';

/**
 * Top-right expand/collapse chevron on collapsible cards. Add the surface's
 * own `group-open:*:rotate-180` class for the flip.
 */
export const DASHBOARD_CARD_CHEVRON =
  'h-4 w-4 shrink-0 text-content-secondary transition-transform';

/** Primary title inside a card (color: white; wrap accent spans inside). */
export const DASHBOARD_CARD_TITLE =
  'text-sm font-bold leading-snug text-white md:text-base';

/** Secondary / body copy inside a card. */
export const DASHBOARD_CARD_BODY =
  'text-[11px] font-medium leading-snug text-content-secondary md:text-xs';

/** Uppercase eyebrow above a card title; color per surface. */
export const DASHBOARD_CARD_EYEBROW =
  'text-[10px] font-black uppercase tracking-widest';

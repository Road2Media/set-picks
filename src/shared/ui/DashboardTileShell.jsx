import React from 'react';

/**
 * Phase 2 stat tile (#1089). Quiet sponsor box from the Standings card
 * family, plus a short header band. No job wash. The outer border stays
 * `border-border-subtle/60` — the stat color does not become a second border.
 *
 * Band tones: teal, amber, blue, emerald.
 */

export const DASHBOARD_TILE_SHELL =
  'relative flex flex-col overflow-hidden rounded-xl border border-border-subtle/60 bg-surface-panel/40';

/** Header-band fill and bottom rule. Not applied to the outer box. */
export const DASHBOARD_TILE_BAND = {
  teal: 'border-brand-primary/30 bg-brand-primary/10',
  amber: 'border-amber-500/30 bg-amber-500/10',
  blue: 'border-brand-accent-blue/30 bg-brand-accent-blue/10',
  emerald: 'border-emerald-400/30 bg-emerald-400/10',
};

const BAND_PAD = 'px-3.5 py-2 md:px-4';

const BODY_PAD = {
  section: 'flex flex-1 flex-col px-3.5 pb-3.5 pt-3 md:px-4',
  tile: 'flex flex-1 flex-col px-3.5 pb-3.5 pt-1.5 md:px-4',
};

/**
 * @param {{
 *   as?: React.ElementType,
 *   tone?: keyof typeof DASHBOARD_TILE_BAND,
 *   pad?: keyof typeof BODY_PAD,
 *   header: React.ReactNode,
 *   children?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export default function DashboardTileShell({
  as: Tag = 'div',
  tone = 'teal',
  pad = 'section',
  header,
  children,
  className = '',
  ...rest
}) {
  const band = DASHBOARD_TILE_BAND[tone] ?? DASHBOARD_TILE_BAND.teal;
  const body = BODY_PAD[pad] ?? BODY_PAD.section;

  return (
    <Tag
      className={[DASHBOARD_TILE_SHELL, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className={['border-b', BAND_PAD, band].join(' ')}>{header}</div>
      <div className={body}>{children}</div>
    </Tag>
  );
}

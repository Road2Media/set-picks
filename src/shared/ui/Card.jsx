import React from 'react';

import { DASHBOARD_CARD_PAD } from './dashboardCardClasses';

const variantStyles = {
  panel:
    'bg-surface-panel border border-border-muted/45 rounded-3xl shadow-inset-glass ring-1 ring-border-glass/25',
  default:
    'bg-surface-panel border border-border-muted/45 rounded-3xl shadow-inset-glass ring-1 ring-border-glass/25',
  chrome:
    'bg-surface-chrome border border-border-muted/45 rounded-2xl shadow-inset-glass ring-1 ring-border-glass/25',
  solid:
    'bg-surface-panel-strong border border-border-muted/50 rounded-2xl shadow-inset-glass ring-1 ring-border-glass/30',
  /**
   * Middle tier — teal border + glass (blur). Detail cards that are not a
   * list row. No gradient / glow; use `venue` for hero surfaces.
   * Not a Standings card (`DashboardJobShell`), not a stat tile
   * (`DashboardTileShell`), and not a person or pool row (`Row`).
   * A tile keeps this teal edge off the outer box.
   */
  frosted:
    'rounded-2xl border border-brand-primary/30 bg-surface-panel shadow-inset-glass ring-1 ring-border-glass/25 backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-xl',
  /** Hero dashboard card — teal border, gradient into deep bg (see PoolHub “Game status”) */
  venue:
    'rounded-2xl border border-brand-primary/30 bg-gradient-to-br from-surface-panel-strong to-brand-bg-deep shadow-glow-brand shadow-inset-glass ring-1 ring-border-glass/25',
  inset: 'rounded-xl border border-border-muted/45 bg-surface-inset ring-1 ring-border-glass/20',
  glass:
    'border border-border-muted/50 bg-surface-glass backdrop-blur-xl ring-1 ring-border-glass/25 shadow-inset-glass',
  alert: 'bg-amber-500/10 border border-amber-500/30 rounded-xl',
  danger: 'bg-red-500/10 border border-red-500/50 rounded-2xl',
  nested: 'rounded-xl border border-border-muted/45 bg-surface-inset ring-1 ring-border-glass/20',
  plain: '',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Modular surface container — glass/panel patterns from dashboard + splash.
 */
const Card = React.forwardRef(function Card(
  { as: Component = 'div', variant = 'default', padding = 'md', className = '', children, ...props },
  ref
) {
  const v = variantStyles[variant] ?? variantStyles.default;
  const p = paddingStyles[padding] ?? paddingStyles.md;
  const combined = [v, p, className].filter(Boolean).join(' ');

  return (
    <Component ref={ref} className={combined} {...props}>
      {children}
    </Component>
  );
});

export default Card;

/**
 * Settings or profile block (#1090). Quiet roomy shell.
 * Not a Standings card: no you / night wash, no teal edge, no glow.
 *
 * `rounded-3xl` `border-border-subtle` `bg-surface-panel` inset glass `p-6`.
 */
export const PANEL_SHELL =
  'rounded-3xl border border-border-subtle bg-surface-panel shadow-inset-glass';

export const PANEL_PAD = {
  none: '',
  md: 'p-6',
};

/**
 * One person or one pool in a list (#1090).
 * Padding matches a dashboard card. A self row or a leading row is a
 * border modifier. A first-place badge stays on the rank chip.
 * Neither tone uses the amber or teal wash from #1088.
 */
export const ROW_SHELL = 'rounded-xl bg-surface-panel shadow-inset-glass';

export const ROW_EDGE = {
  default: 'border border-border-subtle/45',
  self: 'border border-brand-primary/55 ring-1 ring-brand-primary/35',
  leader: 'border border-border-venue/55 ring-1 ring-brand-primary/15',
};

/** Same padding as a dashboard card (`DASHBOARD_CARD_PAD`). */
export const ROW_PAD = DASHBOARD_CARD_PAD;

export const Panel = React.forwardRef(function Panel(
  { as: Component = 'div', padding = 'md', className = '', children, ...props },
  ref,
) {
  const pad = PANEL_PAD[padding] ?? PANEL_PAD.md;
  const combined = [PANEL_SHELL, pad, className].filter(Boolean).join(' ');

  return (
    <Component ref={ref} className={combined} {...props}>
      {children}
    </Component>
  );
});

export const Row = React.forwardRef(function Row(
  { as: Component = 'div', padding = 'card', tone = 'default', className = '', children, ...props },
  ref,
) {
  const edge = ROW_EDGE[tone] ?? ROW_EDGE.default;
  const pad = padding === 'none' ? '' : ROW_PAD;
  const combined = [ROW_SHELL, edge, pad, className].filter(Boolean).join(' ');

  return (
    <Component ref={ref} className={combined} {...props}>
      {children}
    </Component>
  );
});

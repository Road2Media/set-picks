import React from 'react';

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
   * Middle tier — teal border + glass (blur). List/detail cards (e.g. pool rows).
   * No gradient / glow; use `venue` for hero surfaces.
   * Not a Standings card (`DashboardJobShell`) and not a stat tile
   * (`DashboardTileShell`). A tile keeps this teal edge off the outer box.
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

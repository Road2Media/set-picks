import React from 'react';

/**
 * Phase 1 column shell (#1088). Sponsor fill, one border, no glass.
 * A faint wash sits over the panel so the tint does not replace it.
 *
 * - `amber` — you (your rank, scorecard)
 * - `teal` — the night (winner, setlist, crowd pulse, Picks Lab)
 * - `none` — quiet (invite, notices, empty states, the empty sponsor shell)
 * - `sponsored` — a filled house promo (#121). Violet wash and edge so it
 *   does not blend into quiet standings chrome.
 */

const BORDER = {
  amber: 'border-border-subtle/60',
  teal: 'border-border-subtle/60',
  none: 'border-border-subtle/60',
  sponsored: 'border-border-sponsored/80',
};

const WASH = {
  amber: 'bg-amber-200/6',
  teal: 'bg-brand-primary/6',
  none: '',
  sponsored: 'bg-surface-sponsored/55',
};

export const DASHBOARD_JOB_PAD = {
  label: 'px-3.5 pb-3.5 pt-2 md:px-4',
  row: 'px-3.5 py-3.5 md:px-4 md:py-4',
};

export const DASHBOARD_JOB_LABEL = {
  amber: 'text-amber-200/90',
  teal: 'text-brand-primary',
  none: 'text-content-secondary/70',
  sponsored: 'text-content-sponsored',
};

export const DASHBOARD_JOB_ICON = 'h-3.5 w-3.5 shrink-0';

export default function DashboardJobShell({
  as: Tag = 'div',
  tone = 'none',
  pad = 'row',
  className = '',
  children,
  ...rest
}) {
  const wash = WASH[tone] ?? '';
  const border = BORDER[tone] ?? BORDER.none;
  const padClass = DASHBOARD_JOB_PAD[pad] ?? DASHBOARD_JOB_PAD.row;

  return (
    <Tag
      className={[
        'relative overflow-hidden rounded-xl border',
        border,
        padClass,
        '[&>:not([aria-hidden])]:relative',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <div className="pointer-events-none absolute inset-0 bg-surface-panel/40" aria-hidden />
      {wash ? (
        <div className={`pointer-events-none absolute inset-0 ${wash}`} aria-hidden />
      ) : null}
      {children}
    </Tag>
  );
}

import React from 'react';

const baseClass =
  'inline-flex cursor-pointer items-center rounded-full border border-border-subtle/50 bg-surface-panel/50 px-3 py-1.5 font-sans transition-colors hover:bg-surface-panel-strong/72 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg [&::-webkit-details-marker]:hidden';

const toneClass = {
  /** Muted label; hover shifts to brand primary (overflow menu trigger, etc.) */
  muted: 'gap-1.5 text-xs font-medium text-slate-300 hover:text-brand-primary',
  /** Nav emphasis — pool hub shortcuts, etc. */
  accent:
    'gap-2 text-[10px] font-black uppercase tracking-widest text-brand-primary hover:text-brand-primary-strong sm:px-4',
};

/**
 * Small pill for dashboard action rows (nav links, overflow menu summaries).
 * Polymorphic: pass `as={Link}` and `to`, or `as="summary"` for `<details>`.
 */
export default function DashboardRowPill({
  as: Comp = 'button',
  tone = 'muted',
  className = '',
  children,
  ...rest
}) {
  return (
    <Comp
      className={[baseClass, toneClass[tone] ?? toneClass.muted, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Comp>
  );
}

import React from 'react';

import { DASHBOARD_CARD_L1_MIN_H } from './dashboardCardClasses';
import DashboardJobShell, { DASHBOARD_JOB_LABEL } from './DashboardJobShell';

/**
 * Reserved, clearly-labeled promo/sponsor placement (domain-agnostic).
 *
 * With no children, renders nothing unless `VITE_ENABLE_SPONSOR_SLOTS=true`.
 * That flag is a local/preview proportion check only. A filled creative
 * (children from `AdPlacement`) renders in production without the flag.
 * When the creative is absent, nothing is reserved.
 *
 * Sizing contract: the card is content-driven with a reserved `min-h` per
 * variant so a late creative does not jump past the L1 floor. The "Sponsored"
 * disclosure is a dedicated eyebrow — never overlaid on the creative.
 *
 * Variants (mobile-first):
 * - `banner` — logo + short copy row (L1 min height)
 * - `card` — logo + copy + CTA stack
 *
 * `tone="sponsored"` is the filled house-promo surface. The empty proportion
 * shell stays quiet (`none`).
 *
 * @param {{
 *   slotId: string,
 *   variant?: 'banner' | 'card',
 *   tone?: 'none' | 'sponsored',
 *   className?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export default function SponsorSlot({
  slotId,
  variant = 'banner',
  tone = 'none',
  className = '',
  children,
}) {
  const previewShell = import.meta.env.VITE_ENABLE_SPONSOR_SLOTS === 'true';
  const hasCreative = children != null && children !== false;
  if (!previewShell && !hasCreative) return null;

  const shellTone = hasCreative ? tone : 'none';
  const labelColor = DASHBOARD_JOB_LABEL[shellTone] ?? DASHBOARD_JOB_LABEL.none;

  // Banner variant reserves the shared L1 promo height so it lines up with
  // sibling L1 cards (e.g. Invite promo) in dashboard stacks.
  const minHeight = variant === 'card' ? 'min-h-30' : DASHBOARD_CARD_L1_MIN_H;

  return (
    <aside
      aria-label="Sponsored content"
      data-sponsor-slot={slotId}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <DashboardJobShell
        tone={shellTone}
        pad="label"
        className={`flex w-full flex-col ${minHeight}`}
      >
        <span
          className={`mb-1.5 self-end text-[9px] font-semibold uppercase tracking-widest ${labelColor}`}
        >
          Sponsored
        </span>
        {hasCreative ? children : <PlaceholderCreative slotId={slotId} variant={variant} />}
      </DashboardJobShell>
    </aside>
  );
}

/** Dev-only proportion preview: fake logo + copy (+ CTA on `card`). */
function PlaceholderCreative({ slotId, variant }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-border-subtle/60 bg-surface-inset/72 text-[9px] font-bold uppercase text-content-secondary/50">
        Logo
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-2.5 w-3/4 rounded-sm bg-surface-panel-strong/80" />
        <div className="h-2 w-1/2 rounded-sm bg-surface-panel-strong/50" />
        <p className="truncate pt-0.5 text-[9px] font-medium text-content-secondary/40">
          {slotId}
        </p>
      </div>
      {variant === 'card' ? (
        <div className="h-8 w-20 shrink-0 rounded-full border border-dashed border-border-subtle/60 bg-surface-inset/72" />
      ) : null}
    </div>
  );
}

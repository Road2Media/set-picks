import React from 'react';

import { DASHBOARD_CARD_L1_MIN_H } from './dashboardCardClasses';
import DashboardJobShell from './DashboardJobShell';

/**
 * Reserved, clearly-labeled promo/sponsor placement (domain-agnostic).
 *
 * Renders nothing unless `VITE_ENABLE_SPONSOR_SLOTS === 'true'` — the seam
 * stays in the tree at zero cost until the ads program (`features/ads`,
 * epic #419 / Phase 1 #121) supplies real creatives via an `AdPlacement`.
 *
 * Sizing contract: the card is **content-driven** (grows with the creative)
 * with a reserved `min-h` per variant so a late-loading creative cannot cause
 * layout shift. The "Sponsored" disclosure is a dedicated eyebrow row inside
 * the card — never overlaid on the creative.
 *
 * Variants (mobile-first; IAB-adjacent):
 * - `banner`  — logo + short copy row (~5rem min; ≈ 320×50–100 class)
 * - `card`    — logo + copy + CTA stack (~7.5rem min; ≈ 300×250-lite class)
 *
 * When enabled with no children, renders a proportioned placeholder (fake
 * logo block + copy lines) so local iteration previews real creative bulk.
 *
 * @param {{
 *   slotId: string,
 *   variant?: 'banner' | 'card',
 *   className?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export default function SponsorSlot({
  slotId,
  variant = 'banner',
  className = '',
  children,
}) {
  const enabled = import.meta.env.VITE_ENABLE_SPONSOR_SLOTS === 'true';
  if (!enabled) return null;

  // Banner variant reserves the shared L1 promo height so it lines up with
  // sibling L1 cards (e.g. Invite promo) in dashboard stacks.
  const minHeight =
    variant === 'card' ? 'min-h-30' : DASHBOARD_CARD_L1_MIN_H;

  return (
    <aside
      aria-label="Sponsored content"
      data-sponsor-slot={slotId}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <DashboardJobShell tone="none" pad="label" className={`flex w-full flex-col ${minHeight}`}>
        <span className="mb-1.5 self-end text-[9px] font-semibold uppercase tracking-widest text-content-secondary/70">
          Sponsored
        </span>
        {children ?? <PlaceholderCreative slotId={slotId} variant={variant} />}
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

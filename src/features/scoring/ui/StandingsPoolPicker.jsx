import React from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

import FilterPill from '../../../shared/ui/FilterPill';
import PageTitle from '../../../shared/ui/PageTitle';

const responsivePoolPillLayout =
  'overflow-x-auto whitespace-nowrap scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:whitespace-normal';

/**
 * Pool sub-selector for the Pools pill on `/dashboard/standings` (#255).
 * Horizontal scroll ribbon of `FilterPill` chips, one per user pool.
 *
 * Empty state links to `/dashboard/pools` so a user with no pools has a
 * clear next step instead of a silent empty section.
 *
 * @param {{
 *   pools: Array<{ id: string, name?: string }>,
 *   activePoolId: string | null,
 *   onChange: (id: string) => void,
 *   className?: string,
 * }} props
 */
export default function StandingsPoolPicker({
  pools,
  activePoolId,
  onChange,
  className = '',
}) {
  const hasPools = Array.isArray(pools) && pools.length > 0;

  if (!hasPools) {
    return (
      <div
        className={[
          'mb-4 rounded-xl border border-border-subtle/50 bg-surface-panel/60 px-3.5 py-3.5 text-center shadow-inset-glass md:px-4 md:py-4',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Users
          className="mx-auto mb-2 h-6 w-6 text-content-secondary"
          aria-hidden
        />
        <p className="mb-3 text-sm font-bold text-content-secondary md:text-base">
          You aren&apos;t in any pools yet.
        </p>
        <Link
          to="/dashboard/pools"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15"
        >
          Join or create a pool
        </Link>
      </div>
    );
  }

  return (
    <div className={['mb-4', className].filter(Boolean).join(' ')}>
      <PageTitle as="h3" variant="eyebrow" className="mb-2 px-2">
        Your pools
      </PageTitle>
      <div className={`flex gap-1.5 px-1 pb-1 ${responsivePoolPillLayout}`}>
        {pools.map((pool) => (
          <FilterPill
            key={pool.id}
            selected={activePoolId === pool.id}
            onClick={() => onChange(pool.id)}
          >
            {pool.name || 'Pool'}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

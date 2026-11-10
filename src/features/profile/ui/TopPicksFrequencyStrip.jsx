import React from 'react';
import { Loader2 } from 'lucide-react';

import { Panel } from '../../../shared/ui/Card';

/**
 * Ranked top-picks intensity strip (#553). Frequency-forward; secondary
 * hit counts when available from setlist join.
 *
 * @param {{
 *   rows?: Array<{
 *     title: string,
 *     pickedCount: number,
 *     correctCount: number,
 *     exactSlotHits: number,
 *     wildcardHits: number,
 *     bustoutBoosts: number,
 *   }>,
 *   loading?: boolean,
 *   showsAggregated?: number,
 *   showsAvailable?: number,
 *   flushTop?: boolean,
 * }} props
 */
export default function TopPicksFrequencyStrip({
  rows = [],
  loading = false,
  showsAggregated = 0,
  showsAvailable = 0,
  flushTop = false,
}) {
  const maxPicked = rows.reduce(
    (m, r) => Math.max(m, typeof r.pickedCount === 'number' ? r.pickedCount : 0),
    0
  );

  return (
    <Panel as="section" className={flushTop ? '' : 'mt-6'}>
      <h2 className="mb-1 text-xs font-black uppercase tracking-widest text-content-secondary">
        Top picks
      </h2>
      <p className="mb-4 text-[11px] font-medium leading-relaxed text-content-secondary">
        Songs you lock in most often
        {showsAggregated > 0
          ? ` · last ${showsAggregated} graded show${showsAggregated === 1 ? '' : 's'}`
          : ''}
        {showsAvailable > showsAggregated
          ? ` (of ${showsAvailable})`
          : ''}
        .
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2
            className="h-6 w-6 animate-spin text-brand-primary"
            aria-label="Loading top picks"
          />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm font-bold text-content-secondary">
          No graded picks yet — play a show to build your strip.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const intensity =
              maxPicked > 0 ? Math.max(0.12, row.pickedCount / maxPicked) : 0.12;
            return (
              <li key={row.title.toLowerCase()}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-bold text-white">
                    {row.title}
                  </span>
                  <span className="shrink-0 text-xs font-black tabular-nums text-brand-primary">
                    ×{row.pickedCount}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-field"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-linear-to-r from-red-500/80 to-blue-500/80"
                    style={{ width: `${Math.round(intensity * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-content-secondary">
                  Correct {row.correctCount}
                  <span className="mx-1.5 text-border-subtle/50">·</span>
                  Exact {row.exactSlotHits}
                  <span className="mx-1.5 text-border-subtle/50">·</span>
                  Wild {row.wildcardHits}
                  <span className="mx-1.5 text-border-subtle/50">·</span>
                  Bustout {row.bustoutBoosts}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

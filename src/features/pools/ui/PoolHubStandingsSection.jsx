import React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import {
  POOL_ALL_TIME_STANDINGS_DESCRIPTION,
  POOL_ALL_TIME_STANDINGS_HEADING,
  POOL_TOUR_STANDINGS_DESCRIPTION,
  POOL_TOUR_STANDINGS_HEADING,
} from '../../../shared/config/dashboardVocabulary';
import { TourPicker } from '../../scoring';
import PoolHubLeaderboard from './PoolHubLeaderboard';

/**
 * Pool-scoped standings section on pool details (#148).
 *
 * Renders the All-time ↔ Tour scope toggle atop the pool leaderboard and
 * swaps heading + copy to match the selected scope. The Tour tab hides when
 * no tour can be resolved (e.g. empty `show_calendar`), falling back to the
 * All-time view so the pool always has a leaderboard.
 *
 * Aggregation (points / wins / shows) comes from
 * {@link usePoolStandingsSection}; this component is presentational.
 *
 * @param {{
 *   members: Array<Record<string, unknown>>,
 *   loading?: boolean,
 *   scope: 'all-time' | 'tour',
 *   onScopeChange: (scope: 'all-time' | 'tour') => void,
 *   tourName?: string | null,
 *   tourAvailable?: boolean,
 *   selectableTours?: Array<{ tour: string }>,
 *   selectedTourKey?: string | null,
 *   onSelectTour?: (tourKey: string) => void,
 * }} props
 */
export default function PoolHubStandingsSection({
  members,
  loading = false,
  scope,
  onScopeChange,
  tourName,
  tourAvailable = false,
  selectableTours,
  selectedTourKey,
  onSelectTour,
}) {
  const heading =
    scope === 'tour' ? POOL_TOUR_STANDINGS_HEADING : POOL_ALL_TIME_STANDINGS_HEADING;
  const description =
    scope === 'tour'
      ? POOL_TOUR_STANDINGS_DESCRIPTION
      : POOL_ALL_TIME_STANDINGS_DESCRIPTION;

  return (
    <section>
      <div className="mb-3 ml-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-content-secondary">
            {heading}
          </h2>
          {scope === 'tour' && tourName ? (
            <p className="mt-0.5 text-sm font-bold text-white">{tourName}</p>
          ) : null}
        </div>
        <ScopeToggle
          scope={scope}
          onScopeChange={onScopeChange}
          tourAvailable={tourAvailable}
        />
      </div>
      {scope === 'tour' && (
        <TourPicker
          tours={selectableTours ?? []}
          selectedTourKey={selectedTourKey}
          onSelect={onSelectTour ?? (() => {})}
          className="mb-3"
        />
      )}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-subtle/50 bg-surface-panel/50 py-10 font-bold text-content-secondary shadow-inset-glass">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-hidden />
          <span>Loading standings…</span>
        </div>
      ) : (
        <PoolHubLeaderboard members={members} />
      )}
      <details className="group mt-3 rounded-xl border border-border-subtle/50 bg-surface-glass/32 shadow-inset-glass">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-bold text-content-secondary transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
          About {heading.toLowerCase()}
        </summary>
        <div className="space-y-2 border-t border-border-muted/60 px-3 py-3 text-xs font-medium leading-relaxed text-content-secondary">
          <p>{description}</p>
          <p>
            <span className="text-white/90">Shows</span> is how many nights you submitted picks in
            this pool after that show was finalized (Finalize and rollup). Nights you skip do not add
            to your count.
          </p>
          <p>
            <span className="text-white/90">Wins</span> counts the nights you tied or beat the top
            score across every graded, non-empty pick for that show. Ties share the win.
          </p>
        </div>
      </details>
    </section>
  );
}

function ScopeToggle({ scope, onScopeChange, tourAvailable }) {
  const buttonClass = (active) =>
    `px-2.5 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
      active
        ? 'bg-brand-primary text-brand-bg-deep'
        : 'text-content-secondary hover:text-white'
    }`;

  return (
    <div
      role="tablist"
      aria-label="Standings scope"
      className="inline-flex overflow-hidden rounded-full border border-border-subtle/50 bg-surface-panel/60"
    >
      <button
        type="button"
        role="tab"
        aria-selected={scope === 'all-time'}
        onClick={() => onScopeChange('all-time')}
        className={buttonClass(scope === 'all-time')}
      >
        All-time
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={scope === 'tour'}
        aria-disabled={!tourAvailable}
        disabled={!tourAvailable}
        onClick={() => onScopeChange('tour')}
        title={tourAvailable ? undefined : 'No tour available'}
        className={`${buttonClass(scope === 'tour')} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Tour
      </button>
    </div>
  );
}

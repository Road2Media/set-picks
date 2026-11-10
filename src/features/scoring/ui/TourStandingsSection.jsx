import React from 'react';
import { Loader2 } from 'lucide-react';

import {
  TOUR_STANDINGS_DESCRIPTION,
  TOUR_STANDINGS_HEADING,
} from '../../../shared/config/dashboardVocabulary';
import { Row } from '../../../shared/ui/Card';
import PlayerHandleLink from '../../../shared/ui/PlayerHandleLink';
import { StandingsPlayerAvatar, usePlayerIdentityMap } from '../../profile';
import { assignTourDisplayRanks, tourStandingsBadge } from '../model/tourStandingsRank';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_BOX_PAD,
  STANDINGS_BOX_RADIUS,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

const rankBadgeClass = (rank) => {
  if (rank === 1) return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40';
  if (rank === 2)
    return 'bg-brand-accent-blue/15 text-blue-200 ring-1 ring-brand-accent-blue/35';
  if (rank === 3) return 'bg-orange-900/40 text-orange-200 ring-1 ring-orange-700/40';
  return 'bg-surface-inset/72 text-slate-300 ring-1 ring-border-muted/60';
};

/**
 * Global Tour standings secondary section on `/dashboard/standings` (#219).
 *
 * Renders the running tour leaderboard below the single-night Show standings
 * list. Scope (current tour name) is passed in by the page so copy stays
 * declarative; aggregation math lives in {@link useTourStandings}.
 *
 * Handle cells are `<Link to="/user/:uid">` for #222 parity with Show
 * standings rows and Pool hub leaderboard.
 *
 * Year standings (#1110) reuse this list. Pass `heading` / `description` /
 * empty and error copy; tour defaults stay in place for the tour view.
 *
 * @param {{
 *   tourName?: string | null | undefined,
 *   scopeName?: string | null | undefined,
 *   leaders: Array<{ uid: string, handle: string, totalPoints: number, wins: number, shows: number, rank?: number, tiedCount?: number }>,
 *   loading: boolean,
 *   error?: Error | null,
 *   selfUserId?: string | null,
 *   heading?: string,
 *   description?: string,
 *   scopeFallback?: string,
 *   emptyMessage?: string,
 *   errorMessage?: string,
 *   loadingLabel?: string,
 *   placeLabelsByRank?: Record<number, string> | null,
 *   topClassName?: string,
 * }} props
 */
export default function TourStandingsSection({
  tourName,
  scopeName,
  leaders,
  loading,
  error,
  selfUserId = null,
  heading = TOUR_STANDINGS_HEADING,
  description = TOUR_STANDINGS_DESCRIPTION,
  scopeFallback = 'Current tour',
  emptyMessage = 'No graded picks in this tour yet.',
  errorMessage = "Couldn't load tour standings. Try refreshing.",
  loadingLabel = 'Loading tour standings',
  placeLabelsByRank = null,
  topClassName = 'mt-10',
}) {
  const scopeLabel = scopeName || tourName || scopeFallback;
  // Place is the full tie-break, not the row index (#1218).
  const rankedLeaders = assignTourDisplayRanks(leaders);
  const { identities } = usePlayerIdentityMap(rankedLeaders.map((r) => r.uid));

  return (
    <section
      aria-label={heading}
      className={`relative z-20 ${topClassName} ${STANDINGS_BOX_RADIUS} border border-border-subtle/35 bg-surface-panel/40 ${STANDINGS_BOX_PAD} shadow-inset-glass`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
            {heading}
          </h2>
          <p className={`mt-0.5 ${STANDINGS_BOX_TITLE}`}>
            {scopeLabel}
          </p>
          <p className={`mt-0.5 ${STANDINGS_BOX_BODY}`}>
            {description}
          </p>
        </div>
        {loading ? (
          <Loader2
            className="h-5 w-5 animate-spin text-brand-primary"
            aria-label={loadingLabel}
          />
        ) : null}
      </div>

      {error ? (
        <p className={`rounded-xl border border-red-900/50 bg-red-900/20 px-3.5 py-3 ${STANDINGS_BOX_BODY} text-red-200!`}>
          {errorMessage}
        </p>
      ) : null}

      {!loading && !error && leaders.length === 0 ? (
        <p className={STANDINGS_BOX_BODY}>
          {emptyMessage}
        </p>
      ) : null}

      {rankedLeaders.length > 0 ? (
        <ol className="space-y-2">
          {rankedLeaders.map((row) => {
            const badge = tourStandingsBadge(row);
            const isSelf = Boolean(selfUserId) && row.uid === selfUserId;
            const identity = identities[row.uid] || null;
            const placeLabel = placeLabelsByRank?.[row.rank] || '';
            return (
              <Row
                as="li"
                key={row.uid}
                tone={isSelf ? 'self' : 'default'}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {badge ? (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${rankBadgeClass(row.rank)}`}
                        aria-label={placeLabel ? `${placeLabel}, ${badge.ariaLabel}` : badge.ariaLabel}
                      >
                        {badge.text}
                      </span>
                    ) : null}
                    {badge?.tied ? (
                      <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 items-center rounded-full bg-surface-inset/72 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-content-secondary ring-1 ring-border-muted/60"
                      >
                        Tie
                      </span>
                    ) : null}
                    <StandingsPlayerAvatar
                      avatarId={identity?.avatarId}
                      badges={identity?.badges}
                      isSelf={isSelf}
                      handle={row.handle}
                    />
                    <PlayerHandleLink
                      userId={row.uid}
                      handle={row.handle}
                      className="min-w-0 truncate text-sm"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right sm:gap-4">
                    <TourStat label="Pts" value={row.totalPoints} emphasized />
                    <TourStat label="Wins" value={row.wins} />
                    <TourStat label="Shows" value={row.shows} />
                  </div>
                </div>
                {placeLabel ? (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                    {placeLabel}
                  </p>
                ) : null}
              </Row>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function TourStat({ label, value, emphasized = false }) {
  return (
    <div className="leading-none">
      <span
        className={`block text-base font-black tabular-nums ${
          emphasized ? 'text-brand-primary' : 'text-white'
        }`}
      >
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-content-secondary">
        {label}
      </span>
    </div>
  );
}

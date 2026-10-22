import React from 'react';
import { Loader2 } from 'lucide-react';

import {
  TOUR_STANDINGS_DESCRIPTION,
  TOUR_STANDINGS_HEADING,
} from '../../../shared/config/dashboardVocabulary';
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
  return 'bg-surface-inset text-slate-300 ring-1 ring-border-muted';
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
 * @param {{
 *   tourName: string | null | undefined,
 *   leaders: Array<{ uid: string, handle: string, totalPoints: number, wins: number, shows: number, rank?: number, tiedCount?: number }>,
 *   loading: boolean,
 *   error?: Error | null,
 *   selfUserId?: string | null,
 * }} props
 */
export default function TourStandingsSection({
  tourName,
  leaders,
  loading,
  error,
  selfUserId = null,
}) {
  const heading = TOUR_STANDINGS_HEADING;
  // Place is competition rank on points, not the row index (#1135).
  const rankedLeaders = assignTourDisplayRanks(leaders);
  const { identities } = usePlayerIdentityMap(rankedLeaders.map((r) => r.uid));

  return (
    <section
      aria-label={heading}
      className={`mt-10 ${STANDINGS_BOX_RADIUS} border border-border-subtle/35 bg-surface-panel/40 ${STANDINGS_BOX_PAD} shadow-inset-glass`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
            {heading}
          </h2>
          <p className={`mt-0.5 ${STANDINGS_BOX_TITLE}`}>
            {tourName || 'Current tour'}
          </p>
          <p className={`mt-0.5 ${STANDINGS_BOX_BODY}`}>
            {TOUR_STANDINGS_DESCRIPTION}
          </p>
        </div>
        {loading ? (
          <Loader2
            className="h-5 w-5 animate-spin text-brand-primary"
            aria-label="Loading tour standings"
          />
        ) : null}
      </div>

      {error ? (
        <p className={`rounded-xl border border-red-900/50 bg-red-900/20 px-3.5 py-3 ${STANDINGS_BOX_BODY} !text-red-200`}>
          Couldn&apos;t load tour standings. Try refreshing.
        </p>
      ) : null}

      {!loading && !error && leaders.length === 0 ? (
        <p className={STANDINGS_BOX_BODY}>
          No graded picks in this tour yet.
        </p>
      ) : null}

      {rankedLeaders.length > 0 ? (
        <ol className="space-y-2">
          {rankedLeaders.map((row) => {
            const badge = tourStandingsBadge(row);
            const isSelf = Boolean(selfUserId) && row.uid === selfUserId;
            const identity = identities[row.uid] || null;
            return (
              <li
                key={row.uid}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle/30 bg-surface-panel/80 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {badge ? (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${rankBadgeClass(row.rank)}`}
                      aria-label={badge.ariaLabel}
                    >
                      {badge.text}
                    </span>
                  ) : null}
                  {badge?.tied ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex shrink-0 items-center rounded-full bg-surface-inset px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-content-secondary ring-1 ring-border-muted"
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
                    className="truncate text-sm"
                  />
                </div>
                <div className="flex items-center gap-4 text-right">
                  <TourStat label="Pts" value={row.totalPoints} emphasized />
                  <TourStat label="Wins" value={row.wins} />
                  <TourStat label="Shows" value={row.shows} />
                </div>
              </li>
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

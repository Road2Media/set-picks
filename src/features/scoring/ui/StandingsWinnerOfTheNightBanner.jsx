import React, { Fragment } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  TOP_SCORE_SHARED_WIN_NOTE,
  lastShowWinnerHeading,
  tonightsWinnerHeading,
} from '../../../shared/config/dashboardVocabulary';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import DashboardRowPill from '../../../shared/ui/DashboardRowPill';
import PlayerHandleLink from '../../../shared/ui/PlayerHandleLink';
import {
  STANDINGS_BOX_EYEBROW,
  STANDINGS_BOX_L2_MIN_H,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

/**
 * "Overall winner of the night" callout for `/dashboard/standings` (#218).
 *
 * Renders nothing when there are no eligible winners, so the page can mount
 * this unconditionally and let the feature decide visibility.
 *
 * More than one player at the top score is listed, each as a `/user/:uid`
 * link. They share the nightly win. The note under the names says the board
 * ranks that tie and does not share a place (#1219).
 *
 * @param {{
 *   winners: Array<{
 *     uid?: string,
 *     userId?: string,
 *     handle?: string,
 *     score?: number,
 *   } & Record<string, unknown>>,
 *   max: number | null,
 *   beats?: number,
 *   variant?: 'tonight' | 'lastShow',
 *   compact?: boolean,
 *   viewResults?: { showDate: string, labelCompact: string } | null,
 *   onSelectShowDate?: ((ymd: string) => void) | null,
 *   lastShowPoolScopeLabel?: string | null,
 * }} props
 */
export default function StandingsWinnerOfTheNightBanner({
  winners,
  max,
  beats = 0,
  variant = 'tonight',
  compact = false,
  viewResults = null,
  onSelectShowDate = null,
  lastShowPoolScopeLabel = null,
}) {
  const navigate = useNavigate();

  if (!Array.isArray(winners) || winners.length === 0 || max == null) {
    return null;
  }

  const heading =
    variant === 'lastShow'
      ? lastShowWinnerHeading(winners.length, lastShowPoolScopeLabel)
      : tonightsWinnerHeading(winners.length);
  const handlesLabel = winners.map((w) => w.handle || 'Anonymous').join(', ');

  const showViewResultsLink =
    variant === 'lastShow' &&
    viewResults &&
    typeof viewResults.showDate === 'string' &&
    viewResults.showDate.length > 0;

  const viewResultsHint =
    viewResults?.labelCompact ||
    (showViewResultsLink ? viewResults.showDate : '');

  return (
    <DashboardJobShell
      tone="teal"
      pad="row"
      role="region"
      aria-label={`${heading}: ${handlesLabel} — ${max} points`}
      className={`mb-3 flex ${STANDINGS_BOX_L2_MIN_H} flex-col justify-center`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/*
          If the heading flex item ever paints over the pill (min-width / overflow),
          keep the link above in the hit-test order.
        */}
        <p
          className={`relative z-0 inline-flex min-w-0 items-center gap-1.5 ${STANDINGS_BOX_EYEBROW} text-brand-primary`}
        >
          <Trophy
            className={`${DASHBOARD_JOB_ICON} text-brand-primary`}
            aria-hidden
          />
          {heading}
        </p>
        {showViewResultsLink ? (
          <DashboardRowPill
            as="button"
            type="button"
            tone="accent"
            title={
              viewResultsHint
                ? `Open full standings for ${viewResultsHint}`
                : 'Open full standings for this show'
            }
            aria-label={
              viewResultsHint
                ? `View full standings for ${viewResultsHint}`
                : 'View full standings for this show'
            }
            className="relative z-10 shrink-0"
            onClick={() => {
              const d = viewResults.showDate;
              // Layout `selectedDate` can differ from URL (picker does not write
              // `showDate`). Re-applying the same `?showDate=` is a navigate
              // no-op — still move the picker via layout state.
              onSelectShowDate?.(d);
              navigate({
                pathname: '/dashboard/standings',
                search: `?showDate=${encodeURIComponent(d)}`,
              });
            }}
          >
            View results
            <ChevronRight className="pointer-events-none h-3 w-3 shrink-0 opacity-90" aria-hidden />
          </DashboardRowPill>
        ) : null}
      </div>
      <p
        className={
          compact
            ? `mt-0.5 line-clamp-2 sm:line-clamp-none ${STANDINGS_BOX_TITLE}`
            : `mt-0.5 ${STANDINGS_BOX_TITLE}`
        }
      >
        {winners.map((w, idx) => {
          const playerUserId = w.userId || w.uid;
          const handle = w.handle || 'Anonymous';
          const separator = idx === 0 ? null : ', ';
          return (
            <Fragment key={playerUserId || `${handle}-${idx}`}>
              {separator}
              <PlayerHandleLink
                userId={playerUserId}
                handle={handle}
                className="text-white! hover:text-white!"
              />
            </Fragment>
          );
        })}
        <span className="font-bold text-content-secondary"> — </span>
        <span className="tabular-nums text-brand-primary">{max}</span>
        <span className="font-semibold text-content-secondary"> pts</span>
        {beats > 0 && !compact ? (
          <span className="ml-1.5 text-xs font-semibold text-content-secondary">
            (beat {beats} {beats === 1 ? 'player' : 'players'})
          </span>
        ) : null}
      </p>
      {winners.length > 1 ? (
        <p className="mt-1 text-xs font-medium leading-snug text-content-secondary">
          {TOP_SCORE_SHARED_WIN_NOTE}
        </p>
      ) : null}
    </DashboardJobShell>
  );
}

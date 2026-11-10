import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  PICKS_SELF_RECAP_STANDINGS_LINK,
  STANDINGS_SELF_RECAP_EYEBROW,
} from '../../../shared/config/dashboardVocabulary';
import { StatsRatesDidYouKnow } from '../../feature-discovery';
import { StandingsSelfRecapCard } from '../../scoring';
import { DASHBOARD_CARD_EYEBROW } from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';

/** Compact stats for `<details>` summary: `#n/total · pts` with full phrase in `aria-label`. */
function recapSummaryCompactStats(recap, standingsTo) {
  const playerWord = recap.totalPlayers === 1 ? 'player' : 'players';

  if (recap.displayRank != null) {
    const score = recap.totalScore != null ? recap.totalScore : '—';
    const ariaLabel = `Rank ${recap.displayRank} of ${recap.totalPlayers} ${playerWord}, ${
      score === '—' ? 'points pending' : `${score} points`
    }`;
    return (
      <Link
        to={standingsTo}
        aria-label={PICKS_SELF_RECAP_STANDINGS_LINK}
        title={PICKS_SELF_RECAP_STANDINGS_LINK}
        onClick={(event) => event.stopPropagation()}
        className="mt-0.5 inline-flex rounded underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
      >
        <p
          className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold tabular-nums leading-snug sm:text-base"
          aria-label={ariaLabel}
        >
          <span className="font-bold text-white">#{recap.displayRank}</span>
          <span className="text-content-secondary" aria-hidden>
            /
          </span>
          <span className="font-bold text-white">{recap.totalPlayers}</span>
          <span className="font-bold text-content-secondary">·</span>
          <span className="font-bold text-brand-primary">{score}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-content-secondary">
            pts
          </span>
        </p>
      </Link>
    );
  }

  const score = recap.totalScore != null ? recap.totalScore : '—';
  return (
    <Link
      to={standingsTo}
      aria-label={PICKS_SELF_RECAP_STANDINGS_LINK}
      title={PICKS_SELF_RECAP_STANDINGS_LINK}
      onClick={(event) => event.stopPropagation()}
      className="mt-0.5 inline-flex rounded underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
    >
      <p
        className="text-sm font-bold leading-snug text-content-secondary"
        aria-label="Rank updates after the setlist is posted. Current points if any."
      >
        <span className="text-brand-primary">You</span>
        <span className="mx-1 font-semibold">·</span>
        <span className="tabular-nums text-brand-primary">{score}</span>
        <span className="ml-1 text-[10px] font-bold uppercase tracking-widest">pts</span>
      </p>
    </Link>
  );
}

/**
 * Picks-tab wrapper: full self-recap on `md+`. On small screens, a `<details>` summary
 * shows label + handle (wraps, not truncated) + compact `#n/total · pts`; the open body
 * reuses {@link StandingsSelfRecapCard} in `bodyOnly` mode so rank/name are not repeated.
 */
export default function PicksSelfRecapSection({
  recap,
  shareGradedRecapAllowed,
  showLabel,
  formData,
  actualSetlist,
  standingsTo,
}) {
  if (!recap) return null;

  const routerJump = { to: standingsTo, label: PICKS_SELF_RECAP_STANDINGS_LINK };

  const cardProps = {
    recap,
    showLabel,
    poolLabel: null,
    userPicks: formData,
    actualSetlist,
    shareGradedRecapAllowed,
    routerJump,
  };

  return (
    <div className="mb-4 mt-2">
      <div className="hidden desk:block">
        <StandingsSelfRecapCard {...cardProps} showEyebrow />
      </div>

      <DashboardJobShell
        as="details"
        tone="amber"
        pad="row"
        className="group desk:hidden"
      >
        <summary className="flex list-none cursor-pointer items-center gap-2 text-left [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className={`${DASHBOARD_CARD_EYEBROW} text-amber-200/90`}>
              {STANDINGS_SELF_RECAP_EYEBROW}
            </p>
            <p
              className="mt-1 break-words text-base font-bold leading-snug text-slate-100"
              title={recap.handle}
            >
              {recap.handle}
            </p>
            {recapSummaryCompactStats(recap, standingsTo)}
          </div>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-content-secondary opacity-80 transition-transform duration-200 ease-out group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="mt-2 border-t border-border-subtle/40 pt-2">
          <StandingsSelfRecapCard
            {...cardProps}
            bodyOnly
            showEyebrow={false}
          />
        </div>
      </DashboardJobShell>
      <StatsRatesDidYouKnow className="mt-2" />
    </div>
  );
}

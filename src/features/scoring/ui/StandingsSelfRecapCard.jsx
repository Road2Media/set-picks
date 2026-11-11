import React, { useCallback } from 'react';
import { ChartNoAxesCombined, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  STANDINGS_SELF_RECAP_EYEBROW,
  STANDINGS_SELF_RECAP_JUMP_LINK,
  STANDINGS_SHARE_AFTER_FINALIZE_INLINE,
} from '../../../shared/config/dashboardVocabulary';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import GradedPicksShareBar from './GradedPicksShareBar';
import {
  STANDINGS_BOX_CHEVRON,
  STANDINGS_BOX_EYEBROW,
  STANDINGS_BOX_L2_MIN_H,
} from './standingsSurfaceClasses';

/**
 * Self recap: rank + points (no handle — user is always “you” here), share after finalize,
 * optional in-page scroll or router link (e.g. Picks → Standings).
 *
 * @param {{ to: string, label: string } | null} [routerJump]
 * @param {boolean} [bodyOnly] When true, skip the primary handle/rank row (e.g. Picks
 *   `<details>` body where the summary already showed identity + score).
 * @param {boolean} [collapsible] When true (standings only), wrap meta + actions in
 *   `<details>` with a summary chevron; primary rank row stays visible when collapsed.
 */
export default function StandingsSelfRecapCard({
  recap,
  showLabel,
  poolLabel = null,
  userPicks,
  actualSetlist,
  shareGradedRecapAllowed = false,
  className = '',
  routerJump = null,
  showEyebrow = true,
  bodyOnly = false,
  collapsible = false,
}) {
  const hasSetlistAndPicks = Boolean(actualSetlist && userPicks);
  const useCollapsible = collapsible && !bodyOnly;

  const onJumpToCard = useCallback(
    (e) => {
      e.preventDefault();
      document.getElementById(recap.selfAnchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    },
    [recap.selfAnchorId],
  );

  const scopeLine = [showLabel, poolLabel].filter(Boolean).join(' · ');
  const playerWord = recap.totalPlayers === 1 ? 'player' : 'players';
  const rankLine =
    recap.displayRank != null
      ? `${recap.totalPlayers} ${playerWord}`
      : 'Waiting for setlist · rank updates after grading';

  const metaLine =
    recap.displayRank != null
      ? scopeLine
      : scopeLine.length > 0
        ? `${scopeLine} · ${rankLine}`
        : rankLine;

  const rowLeading = 'leading-none';
  const rowType = `text-sm font-bold ${rowLeading} md:text-base`;

  const rankOfTotalCluster =
    recap.displayRank != null ? (
      <span
        className={`inline-flex max-w-full flex-wrap items-center gap-x-1 ${rowType}`}
        aria-label={`Rank ${recap.displayRank} of ${recap.totalPlayers} ${playerWord}`}
      >
        <span className="tabular-nums text-white">#{recap.displayRank}</span>
        <span className="font-bold text-content-secondary">of</span>
        <span className="tabular-nums text-white">{recap.totalPlayers}</span>
        <span className="font-bold text-content-secondary">{playerWord}</span>
      </span>
    ) : (
      <span className={`text-brand-primary ${rowType}`}>You</span>
    );

  const dotSep = (
    <span className={`shrink-0 text-content-secondary ${rowType}`}>·</span>
  );
  const ptsSuffix = (
    <span
      className={`shrink-0 text-xs font-bold uppercase tracking-widest text-content-secondary sm:text-sm ${rowLeading}`}
    >
      pts
    </span>
  );

  const scoreText = recap.totalScore != null ? recap.totalScore : '—';

  const rankPtsCluster = (
    <>
      {rankOfTotalCluster}
      {dotSep}
      <span className={`shrink-0 tabular-nums text-brand-primary ${rowType}`}>
        {scoreText}
      </span>
      {ptsSuffix}
    </>
  );

  const rankPtsWrapClass = `inline-flex max-w-full min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 ${rowType}`;

  const primaryRow = (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${useCollapsible ? 'flex-1' : 'w-full'} ${showEyebrow ? 'justify-between' : 'justify-end'} ${rowLeading}`}
    >
      {showEyebrow ? (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 ${STANDINGS_BOX_EYEBROW} text-amber-200/90`}
        >
          <ChartNoAxesCombined
            className={`${DASHBOARD_JOB_ICON} text-amber-200/90`}
            aria-hidden
          />
          {STANDINGS_SELF_RECAP_EYEBROW}
        </span>
      ) : null}
      {routerJump ? (
        <Link
          to={routerJump.to}
          aria-label={routerJump.label}
          title={routerJump.label}
          className={`group/score ${rankPtsWrapClass} rounded-sm underline-offset-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg`}
        >
          {rankOfTotalCluster}
          {dotSep}
          <span
            className={`shrink-0 tabular-nums text-brand-primary transition-colors group-hover/score:text-white group-hover/score:underline ${rowType}`}
          >
            {scoreText}
          </span>
          {ptsSuffix}
        </Link>
      ) : (
        <span className={rankPtsWrapClass}>{rankPtsCluster}</span>
      )}
    </div>
  );

  const chevronToggle = useCollapsible ? (
    <ChevronDown
      className={`${STANDINGS_BOX_CHEVRON} duration-200 ease-out group-open:rotate-180`}
      aria-hidden
    />
  ) : null;

  const metaBlock =
    !bodyOnly && metaLine ? (
      <p
        className={`truncate text-xs font-semibold leading-snug text-content-secondary ${useCollapsible ? 'mt-0' : 'mt-1.5'}`}
      >
        {metaLine}
      </p>
    ) : bodyOnly && metaLine ? (
      <p className="truncate text-xs font-semibold leading-snug text-content-secondary">
        {metaLine}
      </p>
    ) : null;

  const jumpBlock =
    routerJump ? null : (
      <div
        className={`${bodyOnly ? 'mt-2' : 'mt-3'} border-t border-border-subtle/35 pt-2.5`}
      >
        <a
          href={`#${recap.selfAnchorId}`}
          onClick={onJumpToCard}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-200 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg rounded-sm"
        >
          <span>{STANDINGS_SELF_RECAP_JUMP_LINK}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-90" aria-hidden />
        </a>
      </div>
    );

  const shareAllowedBlock =
    hasSetlistAndPicks && shareGradedRecapAllowed ? (
      <div
        className={`${bodyOnly ? 'mt-2' : 'mt-3'} border-t border-border-subtle/35 pt-3`}
      >
        {bodyOnly ? null : (
          <div className="mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
              Share your score
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-content-secondary md:text-xs">
              Share your box score via text or social
            </p>
          </div>
        )}
        <GradedPicksShareBar
          variant="actionsOnly"
          userPicks={userPicks}
          actualSetlist={actualSetlist}
          showLabel={showLabel}
        />
      </div>
    ) : null;

  const shareBlockedMessage =
    hasSetlistAndPicks && !shareGradedRecapAllowed ? (
      <p
        className={`${bodyOnly ? 'mt-2' : 'mt-3'} border-t border-border-subtle/35 pt-3 text-[11px] font-semibold leading-snug text-content-secondary`}
      >
        {STANDINGS_SHARE_AFTER_FINALIZE_INLINE}
      </p>
    ) : null;

  const shellClass = `group flex ${STANDINGS_BOX_L2_MIN_H} flex-col justify-center ${className}`;

  if (bodyOnly) {
    return (
      <div className={className}>
        {metaBlock}
        {jumpBlock}
        {shareAllowedBlock}
        {shareBlockedMessage}
      </div>
    );
  }

  if (useCollapsible) {
    return (
      <DashboardJobShell
        as="details"
        tone="amber"
        pad="row"
        id="self-recap"
        className={shellClass}
        defaultOpen
        aria-label="Your rank and score. Expand for show details, jump link, and share."
      >
        <summary className="flex list-none cursor-pointer items-center gap-2 text-left [&::-webkit-details-marker]:hidden">
          {primaryRow}
          {chevronToggle}
        </summary>
        <div className="mt-2">
          {metaBlock}
          {jumpBlock}
          {shareAllowedBlock}
          {shareBlockedMessage}
        </div>
      </DashboardJobShell>
    );
  }

  return (
    <DashboardJobShell
      tone="amber"
      pad="row"
      id="self-recap"
      className={shellClass}
    >
      {primaryRow}
      {metaBlock}
      {jumpBlock}
      {shareAllowedBlock}
      {shareBlockedMessage}
    </DashboardJobShell>
  );
}

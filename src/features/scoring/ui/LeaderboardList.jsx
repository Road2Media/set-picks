import React from 'react';
import { Info } from 'lucide-react';

import {
  LEADING_THIS_SHOW,
  SHOW_STANDINGS_DESCRIPTION,
  SHOW_STANDINGS_EYEBROW,
  STANDINGS_PICK_PRIVACY_INFO_LABEL,
  STANDINGS_PICK_PRIVACY_INLINE,
  STANDINGS_PICK_PRIVACY_TOOLTIP,
} from '../../../shared/config/dashboardVocabulary';
import { calculateTotalScore } from '../../../shared/utils/scoring';
import MetaChip from '../../../shared/ui/MetaChip';

import LeaderboardRow from './LeaderboardRow';
import { usePlayerIdentityMap } from '../../profile';

export default function LeaderboardList({
  sortedPicks,
  actualSetlist,
  expandedUser,
  onToggle,
  getPickPayload,
  title = 'Everyone',
  headerEnd = null,
  selfUserId = null,
  /** When true, hide the top “Leading this show” callout (e.g. Standings already shows “Tonight’s winner”). */
  suppressLeadingCallout = false,
  /** Pre-lock: blur opponent pick titles in expanded rows (#303). */
  redactOpponentPicksPreLock = false,
}) {
  const { identities } = usePlayerIdentityMap(
    sortedPicks.map((p) => p.userId || p.uid)
  );

  if (sortedPicks.length === 0) {
    return (
      <div className="mt-10 text-center font-bold text-content-secondary">
        No one is on the show standings for this date yet.
      </div>
    );
  }

  const leader = sortedPicks[0];
  const leaderId = leader?.uid || leader?.id;
  const leaderScore =
    leader && actualSetlist
      ? calculateTotalScore(getPickPayload(leader), actualSetlist)
      : null;
  const showLeaderCallout =
    !suppressLeadingCallout &&
    Boolean(actualSetlist && leader && leaderScore != null && sortedPicks.length > 0);

  return (
    <div className="space-y-4 pb-6 md:pb-16 text-white">
      {showLeaderCallout ? (
        <div
          className="mx-0.5 rounded-xl border border-brand-primary/35 bg-brand-primary/[0.07] px-3.5 py-3.5 shadow-inset-glass md:px-4 md:py-4"
          role="status"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
            {LEADING_THIS_SHOW}
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-100 md:text-base">
            <span className="text-brand-primary">{leader.handle || 'Anonymous'}</span>
            {' — '}
            <span className="tabular-nums text-white">{leaderScore}</span>
            <span className="font-semibold text-content-secondary"> pts</span>
            {sortedPicks.length > 1 ? (
              <span className="mt-1 block text-[11px] font-medium text-content-secondary md:text-xs">
                Expand a row to compare picks and points for this show.
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4 px-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
            {SHOW_STANDINGS_EYEBROW}
          </h2>
          <p className="mt-0.5 text-sm font-bold leading-snug text-white break-words md:text-base">
            {title}
          </p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-content-secondary md:text-xs">
            {SHOW_STANDINGS_DESCRIPTION}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start sm:self-center pt-0.5 sm:pt-0">
          {headerEnd}
          <MetaChip>
            {sortedPicks.length} {sortedPicks.length === 1 ? 'player' : 'players'}
          </MetaChip>
        </div>
      </div>

      {redactOpponentPicksPreLock ? (
        <div className="mx-2 mb-1 flex min-h-0 items-center gap-1 border-b border-border-subtle/40 pb-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight text-content-secondary sm:text-xs">
            {STANDINGS_PICK_PRIVACY_INLINE}
          </span>
          {/*
            Native `title` on <button> is often delayed, truncated, or ignored (#303 follow-up).
            <details> gives a reliable tap/click surface with the full message; `title` on
            <summary> remains a best-effort hover hint where the browser cooperates.
          */}
          <details className="relative shrink-0">
            <summary
              className="list-none cursor-pointer rounded p-0.5 text-brand-primary/85 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg [&::-webkit-details-marker]:hidden"
              title={STANDINGS_PICK_PRIVACY_TOOLTIP}
              aria-label={STANDINGS_PICK_PRIVACY_INFO_LABEL}
            >
              <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </summary>
            <div
              role="tooltip"
              className="absolute right-0 top-full z-30 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border-subtle bg-surface-panel-strong px-3 py-2 text-left text-xs font-medium leading-snug text-slate-100 shadow-lg"
            >
              {STANDINGS_PICK_PRIVACY_TOOLTIP}
            </div>
          </details>
        </div>
      ) : null}

      {sortedPicks.map((p, index) => {
        const uniqueId = p.uid || p.id;
        const userPicks = getPickPayload(p);
        const isExpanded = expandedUser === uniqueId;
        const ranked = Number(p.rank);
        const rank = Number.isFinite(ranked) && ranked >= 1 ? ranked : index + 1;
        const isSelf = Boolean(selfUserId) && (p.userId || p.uid) === selfUserId;
        const maskPickTitles =
          Boolean(redactOpponentPicksPreLock) && !isSelf;
        // Pre-grade, the self row is pinned to rank 1 by `useLeaderboard`;
        // skip the natural rank badge so users don't misread "1" as a
        // scoring result before the setlist lands.
        const displayRank = isSelf && !actualSetlist ? null : rank;
        const playerUid = p.userId || p.uid;

        return (
          <LeaderboardRow
            key={uniqueId}
            rank={displayRank}
            isLeaderRow={showLeaderCallout && uniqueId === leaderId}
            isSelf={isSelf}
            p={p}
            actualSetlist={actualSetlist}
            isExpanded={isExpanded}
            onToggle={() => onToggle(uniqueId)}
            userPicks={userPicks}
            maskPickTitles={maskPickTitles}
            identity={playerUid ? identities[playerUid] : null}
            anchorId={
              isSelf && selfUserId ? `standings-player-${selfUserId}` : undefined
            }
          />
        );
      })}
    </div>
  );
}

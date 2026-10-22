import React from 'react';
import { Inbox, Loader2, Music } from 'lucide-react';

import { StatsRatesDidYouKnow } from '../../feature-discovery';
import { PicksLockTimingBanner } from '../../picks';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import StandingsSelfRecapCard from './StandingsSelfRecapCard';
import StandingsOfficialSetlistCard from './StandingsOfficialSetlistCard';
import Leaderboard from './Leaderboard';
import StandingsActiveShowCard from './StandingsActiveShowCard';
import StandingsBannerWaitingSetlist from './StandingsBannerWaitingSetlist';
import StandingsLiveSetlistDegradedBanner from './StandingsLiveSetlistDegradedBanner';
import StandingsCrowdPulse from './StandingsCrowdPulse';
import StandingsPoolPicker from './StandingsPoolPicker';
import StandingsWinnerOfTheNightBanner from './StandingsWinnerOfTheNightBanner';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

/**
 * Standings show / pools-view composition. Pure presentational — all state
 * comes from `useStandingsScreen`. Branches:
 *   1. Pools view, no pool selected → render the pool picker only.
 *   2. Loading → spinner (with picker on top in pools view).
 *   3. Show view, status NEXT → "tonight's show" CTA + leaderboard.
 *   4. Status FUTURE → neutral "results aren't up yet" copy.
 *   5. Default → optional banners + leaderboard or empty state.
 */
export default function StandingsShowOrPoolView({ screen }) {
  const {
    view,
    poolId,
    userPools,
    setPoolId,
    onOpenPoolHub,
    loading,
    showStatus,
    showLabel,
    selectedShow,
    selectedDate,
    isShowToday,
    picks,
    actualSetlist,
    displayedPicks,
    leaderboardTitle,
    showWinnerBanner,
    previousShowWinner,
    winnerOfTheNight,
    activePoolName,
    selfUserId,
    selfUserPicks,
    selfStandingsRecap,
    shareGradedRecapAllowed,
    isSecured,
    picksStatusLoading,
    showLastShowWinnerBanner,
    lastShowViewResults,
    onSelectShowDate,
    redactOpponentPicksPreLock,
    inviteChooser,
    crowdTourLeaders,
    liveSetlistServiceStatus,
  } = screen;

  const degradedBanner = liveSetlistServiceStatus?.visible ? (
    <StandingsLiveSetlistDegradedBanner message={liveSetlistServiceStatus.message} />
  ) : null;

  const isPoolsView = view === 'pools';
  const isShowView = view === 'show';
  const lastShowViewResultsForShowTab =
    isShowView && lastShowViewResults ? lastShowViewResults : null;

  if (isPoolsView && !poolId) {
    return (
      <>
        {degradedBanner}
        <StandingsPoolPicker
          pools={userPools || []}
          activePoolId={null}
          onChange={setPoolId}
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {isPoolsView ? (
          <StandingsPoolPicker
            pools={userPools || []}
            activePoolId={poolId}
            onChange={setPoolId}
          />
        ) : null}
        {degradedBanner}
        <div className="mt-20 flex flex-col items-center justify-center gap-3 font-bold text-brand-primary">
          <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
          <p>Loading standings for {showLabel}…</p>
        </div>
      </>
    );
  }

  // Show view (#255): when the selected date is the next pickable show
  // (NEXT — see timeLogic.js), surface the actionable "tonight's show"
  // CTA as the primary affordance and render the leaderboard beneath
  // it. The CTA stays pinned at the top until showtime regardless of
  // pick status — "Make picks" when not secured, the "edit until
  // showtime" message when already secured (copy mirrors
  // PoolHubActiveShow). Self row is pinned at rank 1 pre-grade.
  if (isShowView && showStatus === 'NEXT') {
    return (
      <>
        <PicksLockTimingBanner
          key={selectedDate}
          show={selectedShow}
          showStatus={showStatus}
        />
        {degradedBanner}
        {showLastShowWinnerBanner ? (
          <StandingsWinnerOfTheNightBanner
            variant="lastShow"
            compact
            winners={previousShowWinner.winners}
            max={previousShowWinner.max}
            beats={previousShowWinner.beats}
            viewResults={lastShowViewResultsForShowTab}
            onSelectShowDate={onSelectShowDate}
            lastShowPoolScopeLabel={isPoolsView ? activePoolName : null}
          />
        ) : null}
        <StandingsActiveShowCard
          showLabel={showLabel}
          isShowToday={Boolean(isShowToday)}
          isSecured={Boolean(isSecured)}
          picksStatusLoading={Boolean(picksStatusLoading)}
        />
        <StandingsCrowdPulse
          className="mt-3"
          showDate={selectedDate}
          picks={picks}
          tourLeaders={crowdTourLeaders}
          actualSetlist={actualSetlist}
          showStatus={showStatus}
        />
        {displayedPicks.length > 0 ? (
          <div className="mt-3">
            {!actualSetlist && picks.length > 0 ? (
              <StandingsBannerWaitingSetlist />
            ) : null}
            {actualSetlist ? (
              <StandingsOfficialSetlistCard
                actualSetlist={actualSetlist}
                showDate={selectedDate}
                showLabel={showLabel}
                showStatus={showStatus}
              />
            ) : null}
            {selfStandingsRecap ? (
              <div className="mb-3">
                <StandingsSelfRecapCard
                  recap={selfStandingsRecap}
                  showLabel={showLabel}
                  poolLabel={isPoolsView ? activePoolName : null}
                  userPicks={selfUserPicks}
                  actualSetlist={actualSetlist}
                  shareGradedRecapAllowed={shareGradedRecapAllowed}
                  collapsible
                />
                <StatsRatesDidYouKnow className="mt-2" />
              </div>
            ) : null}
            <Leaderboard
              poolPicks={displayedPicks}
              actualSetlist={actualSetlist}
              title={leaderboardTitle}
              selfUserId={selfUserId}
              suppressLeadingCallout={Boolean(showWinnerBanner)}
              redactOpponentPicksPreLock={redactOpponentPicksPreLock}
            />
          </div>
        ) : null}
      </>
    );
  }

  if (showStatus === 'FUTURE') {
    // FUTURE = a listed show beyond the next pickable one; picks aren't
    // open yet, so we keep the neutral "results aren't up yet" copy on
    // both Show and Pools views.
    return (
      <>
        {isPoolsView ? (
          <StandingsPoolPicker
            pools={userPools || []}
            activePoolId={poolId}
            onChange={setPoolId}
          />
        ) : null}
        {degradedBanner}
        <DashboardJobShell tone="none" pad="row" className="text-center">
          <p className={STANDINGS_BOX_TITLE}>Results aren&apos;t up yet</p>
          <p className={`mx-auto mt-1 max-w-sm ${STANDINGS_BOX_BODY}`}>
            This date hasn&apos;t happened yet. Lock your picks on Picks, then check
            Standings after the show for scores and rankings.
          </p>
        </DashboardJobShell>
      </>
    );
  }

  return (
    <>
      {isPoolsView ? (
        <StandingsPoolPicker
          pools={userPools || []}
          activePoolId={poolId}
          onChange={setPoolId}
        />
      ) : null}

      {isPoolsView && onOpenPoolHub ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="truncate text-xs font-bold uppercase tracking-widest text-content-secondary">
            {activePoolName || 'This pool'} · {showLabel}
          </p>
          <button
            type="button"
            onClick={onOpenPoolHub}
            className="shrink-0 rounded-full border border-border-subtle bg-surface-panel px-3 py-1 text-xs font-semibold text-content-secondary transition-colors hover:bg-surface-panel-strong hover:text-white"
          >
            Pool details
          </button>
        </div>
      ) : null}

      {degradedBanner}

      {showLastShowWinnerBanner ? (
        <StandingsWinnerOfTheNightBanner
          variant="lastShow"
          compact={Boolean(showWinnerBanner)}
          winners={previousShowWinner.winners}
          max={previousShowWinner.max}
          beats={previousShowWinner.beats}
          viewResults={lastShowViewResultsForShowTab}
          onSelectShowDate={onSelectShowDate}
          lastShowPoolScopeLabel={isPoolsView ? activePoolName : null}
        />
      ) : null}

      {showWinnerBanner ? (
        <StandingsWinnerOfTheNightBanner
          winners={winnerOfTheNight.winners}
          max={winnerOfTheNight.max}
          beats={winnerOfTheNight.beats}
        />
      ) : null}

      {selfStandingsRecap ? (
        <div className="mb-3">
          <StandingsSelfRecapCard
            recap={selfStandingsRecap}
            showLabel={showLabel}
            poolLabel={isPoolsView ? activePoolName : null}
            userPicks={selfUserPicks}
            actualSetlist={actualSetlist}
            shareGradedRecapAllowed={shareGradedRecapAllowed}
            collapsible
          />
          <StatsRatesDidYouKnow className="mt-2" />
        </div>
      ) : null}

      {!actualSetlist && picks.length > 0 ? (
        <StandingsBannerWaitingSetlist />
      ) : null}

      {actualSetlist ? (
        <StandingsOfficialSetlistCard
          actualSetlist={actualSetlist}
          showDate={selectedDate}
          showLabel={showLabel}
          showStatus={showStatus}
        />
      ) : null}

      {isShowView ? (
        <StandingsCrowdPulse
          className="mb-3"
          showDate={selectedDate}
          picks={picks}
          tourLeaders={crowdTourLeaders}
          actualSetlist={actualSetlist}
          showStatus={showStatus}
        />
      ) : null}

      {displayedPicks.length === 0 ? (
        <DashboardJobShell
          tone="none"
          pad="row"
          className="mt-8 flex flex-col items-center justify-center text-center"
        >
          {showStatus === 'PAST' ? (
            <>
              <Inbox
                className="mb-3 h-10 w-10 text-content-secondary"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className={`mb-1 ${STANDINGS_BOX_TITLE}`}>No picks for this show</p>
              <p className={`max-w-sm ${STANDINGS_BOX_BODY}`}>
                {isPoolsView
                  ? 'Nobody in this pool submitted picks for this date.'
                  : 'Nobody submitted picks for this date.'}
              </p>
            </>
          ) : (
            <>
              <Music
                className="mb-3 h-10 w-10 text-brand-primary/80"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className={`mb-1 ${STANDINGS_BOX_TITLE}`}>No picks yet</p>
              <p className={`max-w-sm ${STANDINGS_BOX_BODY}`}>
                {isPoolsView ? (
                  <>
                    Nobody in this pool has locked in yet.{' '}
                    <button
                      type="button"
                      onClick={inviteChooser?.openChooser}
                      className="font-bold text-brand-primary underline decoration-brand-primary/50 underline-offset-2 transition-colors hover:text-brand-primary-strong"
                    >
                      Invite friends
                    </button>{' '}
                    to join the fun.
                  </>
                ) : (
                  'Be the first to lock in picks for this show — head to the Picks tab.'
                )}
              </p>
            </>
          )}
        </DashboardJobShell>
      ) : (
        <Leaderboard
          poolPicks={displayedPicks}
          actualSetlist={actualSetlist}
          title={leaderboardTitle}
          selfUserId={selfUserId}
          suppressLeadingCallout={Boolean(showWinnerBanner)}
          redactOpponentPicksPreLock={redactOpponentPicksPreLock}
        />
      )}
    </>
  );
}

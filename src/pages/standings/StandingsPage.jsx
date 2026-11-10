import React from 'react';

import { AdPlacement, AD_SLOT_STANDINGS_INLINE } from '../../features/ads';
import { InviteChooserSheet } from '../../features/invite';
import {
  StandingsChrome,
  StandingsInvitePromo,
  StandingsShowOrPoolView,
  StandingsTourView,
  StandingsYearView,
  useStandingsScreen,
} from '../../features/scoring';

export default function StandingsPage({ selectedDate, onSelectShowDate }) {
  const screen = useStandingsScreen(selectedDate, { onSelectShowDate });
  const invite = screen.inviteChooser;

  return (
    <div className="w-full">
      <StandingsChrome
        view={screen.view}
        onChange={screen.setView}
        onOpenScoringRules={screen.openScoringRules}
      />

      <InviteChooserSheet
        open={invite.open}
        onClose={invite.closeChooser}
        step={invite.step}
        inviterHandle={invite.inviterHandle}
        inviteablePools={invite.inviteablePools}
        selectedPoolId={invite.selectedPoolId}
        onSelectPoolId={invite.setSelectedPoolId}
        selectedPool={invite.selectedPool}
        sharing={invite.sharing}
        onShareSiteInvite={invite.shareSiteInvite}
        onSharePoolInvite={invite.sharePoolInvite}
        onGoToPoolStep={invite.goToPoolStep}
        onBackToChoose={invite.backToChoose}
      />

      <div className="mt-4 md:mt-5">
        <StandingsInvitePromo
          onInvite={invite.openChooser}
          className="mb-3"
        />

        {/*
          Existing Standings seam (#609). Filled only when Remote Config
          returns a creative (#121). Empty in production until ads_enabled.
        */}
        <AdPlacement slotId={AD_SLOT_STANDINGS_INLINE} className="mb-3" />

        {screen.view === 'tour' ? (
          <StandingsTourView
            tourName={screen.selectedTour?.tour}
            leaders={screen.tourLeaders}
            loading={screen.tourLoading}
            error={screen.tourError}
            hasCurrentTour={Boolean(screen.selectedTour)}
            selfUserId={screen.selfUserId}
          />
        ) : screen.view === 'year' ? (
          <StandingsYearView
            yearLabel={screen.selectedYear?.year}
            leaders={screen.yearLeaders}
            loading={screen.yearLoading}
            error={screen.yearError}
            hasYear={Boolean(screen.selectedYear)}
            selfUserId={screen.selfUserId}
            celebration={screen.yearCelebration}
          />
        ) : (
          <StandingsShowOrPoolView screen={screen} />
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { createPortal } from 'react-dom';

import { InviteChooserSheet } from '../../features/invite';
import {
  StandingsInvitePromo,
  StandingsMobileFixedChrome,
  StandingsShowOrPoolView,
  StandingsSponsorPreview,
  StandingsStickyChrome,
  StandingsTourView,
  StandingsYearView,
  useStandingsScreen,
} from '../../features/scoring';
import {
  useDashboardDesktopPageChromePortal,
  useDashboardMobileChromePortal,
} from '../../shared/hooks/useDashboardMobileChromePortal';
import { SponsorSlot } from '../../shared/ui';

export default function StandingsPage({ selectedDate, onSelectShowDate }) {
  const screen = useStandingsScreen(selectedDate, { onSelectShowDate });
  const invite = screen.inviteChooser;
  const mobileChromeRoot = useDashboardMobileChromePortal();
  const desktopChromeRoot = useDashboardDesktopPageChromePortal();

  const mobileFixedChrome = (
    <StandingsMobileFixedChrome
      view={screen.view}
      onChange={screen.setView}
      onOpenScoringRules={screen.openScoringRules}
    />
  );

  return (
    <div className="w-full">
      {mobileChromeRoot
        ? createPortal(mobileFixedChrome, mobileChromeRoot)
        : null}

      {desktopChromeRoot
        ? createPortal(
            <StandingsStickyChrome
              view={screen.view}
              onChange={screen.setView}
              onOpenScoringRules={screen.openScoringRules}
            />,
            desktopChromeRoot,
          )
        : null}

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
          Ads epic #419 Phase 1 seam — no-op unless VITE_ENABLE_SPONSOR_SLOTS.
          Filled house-promo mock for local layout QA (#609); #121 replaces this.
        */}
        <SponsorSlot slotId="dashboard-standings-top" className="mb-3">
          <StandingsSponsorPreview onCtaClick={invite.openChooser} />
        </SponsorSlot>

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
          />
        ) : (
          <StandingsShowOrPoolView screen={screen} />
        )}
      </div>
    </div>
  );
}

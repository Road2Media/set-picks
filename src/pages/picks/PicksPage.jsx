import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock } from 'lucide-react';

import { logCommsEmailLanded } from '../../features/comms';
import {
  PicksCrowdHelper,
  PicksFieldsForm,
  PicksLockTimingBanner,
  PicksMobileFixedChrome,
  PicksSelfRecapSection,
  PicksSubmitButton,
  trackPicksPageInteractive,
  usePicksForm,
  usePicksSelfRecap,
} from '../../features/picks';
import { useShowCalendar } from '../../features/show-calendar';
import { useScoringRulesModal } from '../../features/scoring';
import { useDashboardMobileChromePortal } from '../../shared/hooks/useDashboardMobileChromePortal';
import { showOptionLabelCompact } from '../../shared/utils/showOptionLabel';
import Card from '../../shared/ui/Card';

export default function PicksPage({ user: userProp, selectedDate: selectedDateProp }) {
  const [searchParams] = useSearchParams();
  const outlet = useOutletContext() || {};
  const user = userProp ?? outlet.user;
  const selectedDate = selectedDateProp ?? outlet.selectedDate;
  const { showDates, showDatesByTour } = useShowCalendar();
  const showForShare = selectedDate ? showDates?.find((s) => s.date === selectedDate) : null;
  const shareShowLabel = showForShare ? showOptionLabelCompact(showForShare) : selectedDate || '';
  const localForm = usePicksForm({
    user: outlet.picksForm ? null : user,
    selectedDate: outlet.picksForm ? '' : selectedDate,
    showDates,
    showDatesByTour,
  });
  const {
    formData,
    handleInput,
    handleSave,
    isSaving,
    isLoadingPicks,
    isLocked,
    hasExistingPicks,
    showStatus,
    saveFeedback,
    pickConstraintMessage,
  } = outlet.picksForm ?? localForm;

  const picksRecap = usePicksSelfRecap({ user, selectedDate, showDates, formData });

  const { openScoringRules } = useScoringRulesModal();
  const statusContentId = useId();
  const landedLoggedRef = useRef(false);
  const interactiveLoggedRef = useRef(false);
  const mobileChromeRoot = useDashboardMobileChromePortal();
  const [clusterToolsRoot, setClusterToolsRoot] = useState(null);

  useEffect(() => {
    setClusterToolsRoot(document.getElementById('picks-cluster-mobile-tools-root'));
  }, []);
  const mobileToolsRoot = clusterToolsRoot || mobileChromeRoot;

  const shouldShowSavedStatus = !isLocked && hasExistingPicks;
  const shouldShowLockedStatus = isLocked;
  const shouldShowStatus = shouldShowSavedStatus || shouldShowLockedStatus;

  const [isMobileStatusExpanded, setIsMobileStatusExpanded] = useState(() => shouldShowLockedStatus);

  useEffect(() => {
    setIsMobileStatusExpanded(shouldShowLockedStatus);
  }, [shouldShowLockedStatus, shouldShowSavedStatus]);

  // #535: email deep-link funnel (utm_campaign from click host / email links)
  useEffect(() => {
    if (landedLoggedRef.current) return;
    const campaign = (searchParams.get('utm_campaign') || '').trim();
    if (!campaign) return;
    landedLoggedRef.current = true;
    logCommsEmailLanded({
      triggerId: campaign,
      templateId: campaign.replace(/_/g, '-'),
      surface: 'dashboard_picks',
    });
  }, [searchParams]);

  useEffect(() => {
    if (interactiveLoggedRef.current) return;
    if (isLoadingPicks || !selectedDate) return;
    interactiveLoggedRef.current = true;
    const campaign = (searchParams.get('utm_campaign') || '').trim();
    trackPicksPageInteractive({
      show_id: selectedDate,
      comms_trigger_id: campaign || undefined,
    });
  }, [isLoadingPicks, selectedDate, searchParams]);

  const mobileFixedChrome = (
    <PicksMobileFixedChrome
      onOpenScoringRules={openScoringRules}
      shouldShowStatus={shouldShowStatus}
      shouldShowLockedStatus={shouldShowLockedStatus}
      isStatusExpanded={isMobileStatusExpanded}
      onToggleStatus={() => setIsMobileStatusExpanded((prev) => !prev)}
      statusContentId={statusContentId}
    />
  );

  return (
    <div>
      {mobileToolsRoot
        ? createPortal(mobileFixedChrome, mobileToolsRoot)
        : null}

      <div className="relative">
        <PicksLockTimingBanner
          key={selectedDate}
          show={showForShare}
          showStatus={showStatus}
        />
        {shouldShowStatus ? (
          <>
            <div id={statusContentId} className={isMobileStatusExpanded ? 'block' : 'hidden desk:block'}>
              {shouldShowSavedStatus ? (
                <div
                  className="mb-4 flex items-center gap-2.5 rounded-md border border-brand-primary/40 bg-brand-primary/10 p-3 text-sm text-brand-primary"
                  role="status"
                >
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-brand-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>
                    Your picks are secured. You can edit them until showtime.
                  </span>
                </div>
              ) : null}
              {shouldShowLockedStatus ? (
                <div
                  className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-200/90"
                  role="status"
                >
                  <Lock className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                  <span>Picks are locked for this show.</span>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {!isLoadingPicks && picksRecap.recap ? (
          <PicksSelfRecapSection
            recap={picksRecap.recap}
            shareGradedRecapAllowed={picksRecap.shareGradedRecapAllowed}
            showLabel={shareShowLabel}
            formData={formData}
            actualSetlist={picksRecap.actualSetlist}
            standingsTo={
              selectedDate
                ? `/dashboard/standings?showDate=${encodeURIComponent(selectedDate)}`
                : '/dashboard/standings'
            }
          />
        ) : null}
        <PicksCrowdHelper
          selectedDate={selectedDate}
          showStatus={showStatus}
          isLocked={isLocked}
          formData={formData}
          onChange={handleInput}
          pickRecommendationsArtifact={outlet.pickRecommendationsArtifact}
        />
        <Card
          as="form"
          onSubmit={handleSave}
          variant="venue"
          className="space-y-4 transition-all duration-300"
        >
          {pickConstraintMessage ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-100"
              role="status"
            >
              {pickConstraintMessage}
            </div>
          ) : null}
          <PicksFieldsForm
            formData={formData}
            onChange={handleInput}
            isLocked={isLocked}
            disabled={isLoadingPicks}
            selectedDate={selectedDate}
            pickRecommendationsArtifact={outlet.pickRecommendationsArtifact}
          />
          <PicksSubmitButton
            isSaving={isSaving}
            isLocked={isLocked}
            hasExistingPicks={hasExistingPicks}
            saveFeedback={saveFeedback}
          />
        </Card>
      </div>
    </div>
  );
}

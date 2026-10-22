import React, { useEffect, useState } from 'react';
import { revertRollupForShow } from '../api/adminRollupApi';
import Card from '../../../shared/ui/Card';
import { AlertTriangle } from 'lucide-react';
import { useShowCalendar } from '../../show-calendar';
import { resolveShowTimeZone } from '../../../shared/utils/showTimeZone';
import { useAdminSetlistForm } from '../model/useAdminSetlistForm';
import { useLiveSetlistAutomationPanel } from '../model/useLiveSetlistAutomationPanel';
import { useAdminPicksLock } from '../model/useAdminPicksLock';
import { useTourKeyMissingAudits } from '../model/useTourKeyMissingAudits';
import AdminSetlistSlotInputs from './AdminSetlistSlotInputs';
import AdminSetlistFetchButton from './AdminSetlistFetchButton';
import AdminSongCatalogRefresh from './AdminSongCatalogRefresh';
import AdminLiveSetlistAutomationControls from './AdminLiveSetlistAutomationControls';
import AdminPicksLockControls from './AdminPicksLockControls';
import AdminActionToggle from './AdminActionToggle';
import AdminOfficialSetlistBuilder from './AdminOfficialSetlistBuilder';
import AdminFinalizeAndSave from './AdminFinalizeAndSave';
import AdminWarRoomShowDate from './AdminWarRoomShowDate';
import AdminClaimBootstrap from './AdminClaimBootstrap';
import AdminTourKeyMissingNotice from './AdminTourKeyMissingNotice';
import ConfirmationModal from '../../../shared/ui/ConfirmationModal/ConfirmationModal';

function normalizeDashboardShowDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return '';
}

export default function AdminForm({ user, selectedDate }) {
  const { showDates } = useShowCalendar();
  const [warRoomShowDate, setWarRoomShowDate] = useState(() =>
    normalizeDashboardShowDate(selectedDate),
  );
  const [setlistActionsOpen, setSetlistActionsOpen] = useState(true);
  const [liveAutomationOpen, setLiveAutomationOpen] = useState(true);
  const [picksLockOpen, setPicksLockOpen] = useState(true);
  const [songCatalogActionsOpen, setSongCatalogActionsOpen] = useState(false);
  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [revertError, setRevertError] = useState('');
  const [revertSuccess, setRevertSuccess] = useState('');

  useEffect(() => {
    const next = normalizeDashboardShowDate(selectedDate);
    if (next) setWarRoomShowDate(next);
  }, [selectedDate]);

  useEffect(() => {
    setRevertSuccess('');
    setRevertError('');
  }, [warRoomShowDate]);

  const {
    isAdmin,
    selectedShow,
    setlistData,
    officialSetlist,
    officialSetlistInput,
    isSaving,
    isFetchingApi,
    apiFetchError,
    message,
    setOfficialSetlistInput,
    handleInputChange,
    addOfficialSong,
    removeOfficialSongAt,
    handleFetchFromApi,
    handleSave,
    handleFinalizeAndRollup,
    finalizeAllowedWithoutForce,
    finalizeTimingTooltip,
    finalizeForceModalOpen,
    handleOpenFinalizeEarlyModal,
    handleCloseFinalizeForceModal,
    handleConfirmForceFinalizeAndRollup,
  } = useAdminSetlistForm({ user, selectedDate: warRoomShowDate, showDates });
  const automationPanel = useLiveSetlistAutomationPanel({
    showDate: warRoomShowDate,
    isAdmin,
  });
  const {
    showStatus: picksLockShowStatus,
    picksAlreadyLocked,
    adminLockActive,
    isLocking: isPicksLocking,
    statusText: picksLockStatusText,
    errorText: picksLockErrorText,
    handleLockNow,
  } = useAdminPicksLock({
    selectedDate: warRoomShowDate,
    showDates,
    userEmail: user?.email ?? null,
  });
  const warRoomShow = showDates.find((show) => show.date === warRoomShowDate) || null;
  const warRoomTimeZone = resolveShowTimeZone(warRoomShow);
  const tourKeyDrift = useTourKeyMissingAudits({ enabled: isAdmin });

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-20 flex flex-col items-center gap-3 text-red-500 font-bold">
        <AlertTriangle className="h-10 w-10 shrink-0" aria-hidden />
        UNAUTHORIZED ACCESS
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pb-6 md:pb-12">
      <AdminWarRoomShowDate
        value={warRoomShowDate}
        onChange={setWarRoomShowDate}
        disabled={isSaving}
        timeZone={warRoomTimeZone}
        show={warRoomShow}
      />
      <AdminClaimBootstrap user={user} />
      <AdminTourKeyMissingNotice
        shows={tourKeyDrift.shows}
        errorText={tourKeyDrift.errorText}
      />
      <Card variant="danger" padding="sm" className="mb-6 mt-4">
        <p className="text-xs text-red-300/80 font-bold uppercase tracking-wider flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            Locking the official setlist for {selectedShow}. This will trigger scoring.
          </span>
        </p>
      </Card>

      <Card
        as="section"
        variant="default"
        padding="md"
        className="space-y-6"
      >
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-content-secondary ml-1">
            Admin actions
          </h2>
          <div className="space-y-3">
            <AdminActionToggle
              id="admin-setlist-fetch"
              title="Setlist"
              description="Pull slot picks and ordered setlist from the configured API for this show date."
              open={setlistActionsOpen}
              onOpenChange={setSetlistActionsOpen}
            >
              <AdminSetlistFetchButton
                embedded
                onFetch={handleFetchFromApi}
                disabled={isSaving}
                isFetching={isFetchingApi}
                errorText={apiFetchError}
              />
            </AdminActionToggle>
            <AdminActionToggle
              id="admin-song-catalog"
              title="Song catalog"
              description="Upload Phish.net master list to Cloud Storage (public JSON); clients fetch with a 3-day cache."
              open={songCatalogActionsOpen}
              onOpenChange={setSongCatalogActionsOpen}
            >
              <AdminSongCatalogRefresh embedded disabled={isSaving} />
            </AdminActionToggle>
            <AdminActionToggle
              id="admin-live-automation"
              title="Live automation"
              description="Polling health, Phish.net Force poll, and the player delay message. Separate from Save Official Setlist."
              open={liveAutomationOpen}
              onOpenChange={setLiveAutomationOpen}
            >
              <AdminLiveSetlistAutomationControls
                enabled={automationPanel.enabled}
                isToggling={automationPanel.isToggling}
                isPolling={automationPanel.isPolling}
                isPublishing={automationPanel.isPublishing}
                statusText={automationPanel.statusText}
                errorText={automationPanel.errorText}
                health={automationPanel.health}
                lastResult={automationPanel.lastResult}
                failureCount={automationPanel.failureCount}
                lastError={automationPanel.lastError}
                lastPolledAt={automationPanel.lastPolledAt}
                nextPollAt={automationPanel.nextPollAt}
                lastSuccessfulPollMode={automationPanel.lastSuccessfulPollMode}
                messageKey={automationPanel.messageKey}
                messageChoices={automationPanel.messageChoices}
                clearOnRecovery={automationPanel.clearOnRecovery}
                bannerVisible={automationPanel.bannerVisible}
                bannerActivatedBy={automationPanel.bannerActivatedBy}
                onToggle={automationPanel.handleToggle}
                onPollNow={automationPanel.handlePollNow}
                onMessageKey={automationPanel.setMessageKey}
                onClearOnRecovery={automationPanel.setClearOnRecovery}
                onPublishBanner={automationPanel.handlePublishBanner}
                onClearBanner={automationPanel.handleClearBanner}
              />
            </AdminActionToggle>
            <AdminActionToggle
              id="admin-picks-lock"
              title="Picks lock"
              description="One-click override when the show starts before the resolved lock or Phish.net is slow."
              open={picksLockOpen}
              onOpenChange={setPicksLockOpen}
            >
              <AdminPicksLockControls
                showStatus={picksLockShowStatus}
                picksAlreadyLocked={picksAlreadyLocked}
                adminLockActive={adminLockActive}
                isLocking={isPicksLocking}
                statusText={picksLockStatusText}
                errorText={picksLockErrorText}
                onLockNow={handleLockNow}
                disabled={isSaving}
              />
            </AdminActionToggle>
          </div>
        </div>

        <div className="border-t border-border-muted pt-6 space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-content-secondary ml-1">
            Official setlist
          </h2>
          <AdminSetlistSlotInputs
            formState={setlistData}
            handleInputChange={handleInputChange}
          />

          <AdminOfficialSetlistBuilder
            officialSetlistInput={officialSetlistInput}
            setOfficialSetlistInput={setOfficialSetlistInput}
            officialSetlist={officialSetlist}
            addOfficialSong={addOfficialSong}
            removeOfficialSongAt={removeOfficialSongAt}
            isSaving={isSaving}
          />

          <AdminFinalizeAndSave
            isSaving={isSaving}
            onSave={handleSave}
            onFinalize={handleFinalizeAndRollup}
            finalizeAllowedWithoutForce={finalizeAllowedWithoutForce}
            finalizeTimingTooltip={finalizeTimingTooltip}
            onFinalizeEarlyOverride={handleOpenFinalizeEarlyModal}
            message={message}
          />
          <ConfirmationModal
            open={finalizeForceModalOpen}
            title="Finalize early?"
            message="The server treats this show as not PAST yet (or the calendar is unavailable). Forcing stamps rollup_audit.forceEarlyFinalizeOverride and can mis-credit season totals if the setlist is still incomplete. Only continue if you are correcting an edge case."
            confirmLabel="Finalize anyway"
            confirmVariant="danger"
            busy={isSaving}
            onClose={handleCloseFinalizeForceModal}
            onConfirm={handleConfirmForceFinalizeAndRollup}
          />

          <div className="border-t border-border-muted pt-4 space-y-2">
            <button
              type="button"
              disabled={!selectedShow || isSaving || isReverting}
              onClick={() => {
                setRevertError('');
                setRevertSuccess('');
                setRevertModalOpen(true);
              }}
              className="text-xs font-bold uppercase tracking-widest text-amber-400/90 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed underline underline-offset-2"
            >
              Revert rollup (undo finalize)…
            </button>
            {revertSuccess ? (
              <p className="text-xs font-medium text-teal-300/90" role="status">
                {revertSuccess}
              </p>
            ) : null}
            <ConfirmationModal
              open={revertModalOpen}
              title="Revert rollup for this show?"
              message="Calls Cloud Function revertRollupForShow: reverses user counters for graded picks on this date, resets picks to live scores from the saved official setlist, and writes rollup_audit. Requires a prior rollup_audit entry. See docs/ROLLUP_RECOVERY_RUNBOOK.md."
              confirmLabel="Revert rollup"
              confirmVariant="danger"
              busy={isReverting}
              onClose={() => {
                if (!isReverting) setRevertModalOpen(false);
              }}
              onConfirm={async () => {
                if (!selectedShow) return;
                setIsReverting(true);
                setRevertError('');
                try {
                  const r = await revertRollupForShow({ showDate: selectedShow });
                  setRevertModalOpen(false);
                  setRevertSuccess(
                    r.noop
                      ? 'Revert completed (no graded picks were on file).'
                      : `Revert completed — ${r.revertedPicks} pick(s) reset.`
                  );
                } catch (e) {
                  setRevertModalOpen(false);
                  const msg =
                    e && typeof e === 'object' && 'message' in e
                      ? String(e.message)
                      : 'Revert failed.';
                  setRevertError(msg);
                } finally {
                  setIsReverting(false);
                }
              }}
            />
            {revertError ? (
              <p className="text-xs font-bold text-red-400" role="alert">
                {revertError}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useNextShowPicksStatus } from '../../features/picks';
import {
  PoolAdminSection,
  PoolHubActiveShow,
  PoolHubHeader,
  PoolHubShowArchive,
  PoolHubStandingsSection,
  usePoolAdminControls,
  usePoolHub,
  usePoolStandingsSection,
} from '../../features/pools';
import { useShowCalendar } from '../../features/show-calendar';
import BackButton from '../../shared/ui/BackButton';
import { getNextShow, getShowStatus, scheduleTodayYmd } from '../../shared/utils/timeLogic.js';
import { showOptionLabelDesktop } from '../../shared/utils/showOptionLabel.js';

export default function PoolHubPage({ user }) {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const {
    pool,
    members,
    loading,
    notFound,
    forbidden,
    inviteCode,
    onInviteShareSuccess,
    reload,
  } = usePoolHub(poolId, user);
  const { showDates } = useShowCalendar();
  const {
    leaderboardMembers,
    loading: standingsLoading,
    scope: standingsScope,
    setScope: setStandingsScope,
    selectableTours: standingsSelectableTours,
    selectedTourKey: standingsSelectedTourKey,
    setTourKey: setStandingsTourKey,
    tourName: standingsTourName,
    tourAvailable: standingsTourAvailable,
  } = usePoolStandingsSection(poolId, pool, members);
  const admin = usePoolAdminControls(poolId, user, pool, {
    navigate: (path) => navigate(path),
    onReloadPool: () => reload(),
  });
  const nextShow = getNextShow(showDates);
  const nextShowDate = nextShow.date;
  const {
    hasSubmittedPicksForNextShow,
    loading: picksStatusLoading,
    error: picksStatusError,
  } = useNextShowPicksStatus(nextShowDate);
  const isSecured = picksStatusLoading
    ? false
    : picksStatusError
      ? false
      : hasSubmittedPicksForNextShow;
  const nextShowTimeStatus = getShowStatus(nextShowDate, showDates);
  const isLocked =
    nextShowTimeStatus === 'LIVE' ||
    nextShowTimeStatus === 'PAST' ||
    nextShowTimeStatus === 'FUTURE';
  const activeShowLine = showOptionLabelDesktop(nextShow);
  const isShowToday = nextShow.date === scheduleTodayYmd();

  if (loading) {
    return (
      <div className="mt-20 flex flex-col items-center justify-center gap-3 text-brand-primary">
        <Loader2 className="w-10 h-10 animate-spin" aria-hidden />
        <p className="font-bold">Loading pool…</p>
      </div>
    );
  }

  if (notFound || !pool) {
    return (
      <div className="max-w-xl mx-auto mt-8 text-center space-y-4">
        <p className="text-slate-300 font-bold">Pool not found.</p>
        <Link
          to="/dashboard/pools"
          className="inline-block font-black text-sm uppercase tracking-widest text-brand-primary hover:text-brand-primary-strong hover:underline"
        >
          Back to pools
        </Link>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto mt-8 text-center space-y-4">
        <p className="text-slate-300 font-bold">
          You are not a member of this pool.
        </p>
        <Link
          to="/dashboard/pools"
          className="inline-block font-black text-sm uppercase tracking-widest text-brand-primary hover:text-brand-primary-strong hover:underline"
        >
          Back to pools
        </Link>
      </div>
    );
  }

  const memberCount = pool.members?.length ?? 0;
  const ownerId = pool.ownerId;
  const isArchived = pool.status === 'archived';
  const ownerMember =
    ownerId != null ? members.find((m) => m.id === ownerId) : null;
  const ownerHandle =
    ownerMember?.handle != null
      ? String(ownerMember.handle).trim()
      : '';
  const creatorLabel =
    ownerHandle !== '' ? `Created by ${ownerHandle}` : null;

  return (
    <div className="max-w-xl mx-auto pb-6 md:pb-16 flex flex-col gap-3 md:gap-6">
      <div className="flex flex-col gap-2">
        <div className="px-1">
          <BackButton />
        </div>
        <PoolHubHeader
          poolName={pool.name}
          memberCount={memberCount}
          inviteCode={inviteCode}
          onInviteShareSuccess={onInviteShareSuccess}
          creatorLabel={creatorLabel}
          isArchived={isArchived}
        />
      </div>
      <div className="flex flex-col gap-6">
        <PoolAdminSection
          canAdmin={admin.canAdmin}
          isArchived={admin.isArchived}
          editNameOpen={admin.editNameOpen}
          onOpenEditName={admin.openEditName}
          onCloseEditName={admin.closeEditName}
          busy={admin.busy}
          formError={admin.formError}
          poolName={admin.poolName}
          onSaveName={admin.handleSaveName}
          onArchivePool={admin.openArchiveConfirm}
          onDeletePool={admin.openDeleteConfirm}
          confirmModalOpen={admin.confirmModalOpen}
          onCloseConfirm={admin.closeConfirm}
          confirmModalProps={admin.confirmModalProps}
        />
        <section>
          <h2 className="mb-3 ml-1 text-xs font-bold uppercase tracking-widest text-content-secondary">
            Game Status
          </h2>
          <PoolHubActiveShow
            showLabel={activeShowLine}
            showDate={nextShowDate}
            isShowToday={isShowToday}
            isSecured={isSecured}
            isLocked={isLocked}
            nextShowTimeStatus={nextShowTimeStatus}
            picksStatusLoading={picksStatusLoading}
            poolId={pool.id}
          />
        </section>
        <PoolHubStandingsSection
          members={leaderboardMembers}
          loading={standingsLoading}
          scope={standingsScope}
          onScopeChange={setStandingsScope}
          tourName={standingsTourName}
          tourAvailable={standingsTourAvailable}
          selectableTours={standingsSelectableTours}
          selectedTourKey={standingsSelectedTourKey}
          onSelectTour={setStandingsTourKey}
        />
        <PoolHubShowArchive poolId={poolId} />
      </div>
    </div>
  );
}

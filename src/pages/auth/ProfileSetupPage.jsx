import React, { useMemo } from 'react';

import { ProfileSetupForm, useProfileSetup } from '../../features/auth';
import { POOL_INVITE_STORAGE_KEY } from '../../shared/config/poolInvite';
import { getLocalStorageItem } from '../../shared/lib/local-storage';

export default function ProfileSetupPage({ user }) {
  const {
    handle,
    setHandle,
    favoriteSong,
    setFavoriteSong,
    isSaving,
    error,
    saveProfile,
  } = useProfileSetup(user);

  const poolInvitePending = useMemo(
    () => Boolean(getLocalStorageItem(POOL_INVITE_STORAGE_KEY)?.trim()),
    [],
  );

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-transparent p-6 text-center text-white">
      <div className="w-full max-w-md rounded-[2.5rem] border border-border-subtle/50 bg-surface-panel-strong/72 p-8 shadow-inset-glass ring-1 ring-border-glass/20">
        <h2 className="font-display text-display-xl md:text-display-xl-lg font-bold italic text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400 mb-2">
          ALMOST THERE
        </h2>

        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">
          {poolInvitePending
            ? 'Complete your profile to enter the pool.'
            : 'Complete your profile to get started.'}
        </p>

        <ProfileSetupForm
          handle={handle}
          onHandleChange={setHandle}
          favoriteSong={favoriteSong}
          onFavoriteSongChange={setFavoriteSong}
          onSubmit={saveProfile}
          isSaving={isSaving}
          error={error}
        />
      </div>
    </div>
  );
}

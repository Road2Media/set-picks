import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAcceptedInviteAttribution } from '../../features/invite';
import { isDashboardEntryPath } from '../../shared/lib/appBootPath';
import { usePushNavigationBridge } from '../../shared/lib/usePushNavigationBridge';
import { useServiceWorkerUpdate } from '../../shared/lib/useServiceWorkerUpdate';
import AppBackground from '../../shared/ui/AppBackground';
import RouteSuspenseFallback from '../../shared/ui/RouteSuspenseFallback';
import UpdateAvailableBanner from '../../shared/ui/UpdateAvailableBanner';
import { shellTransitionKey } from './model/shellTransitionKey';
import DashboardBootSkeleton from './ui/DashboardBootSkeleton';

/**
 * Global chrome: ambient background + top-level route outlet with enter animation.
 * Keeps router hooks in the app layer; AppBackground stays a shared presentational primitive.
 *
 * The `<Suspense>` boundary here catches every top-level lazy route (dashboard,
 * setup, public profile, pool-invite, etc.), so we only need one boundary at
 * this level. Nested boundaries exist inside `DashboardLayout` for its child
 * pages.
 *
 * The enter-animation wrapper uses {@link shellTransitionKey} — not raw
 * `pathname` — so dashboard tab switches do not remount the lazy route tree.
 */
export default function RootAppShell() {
  const { pathname } = useLocation();
  const transitionKey = shellTransitionKey(pathname);
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  usePushNavigationBridge();
  useAcceptedInviteAttribution();

  return (
    <>
      <AppBackground />
      <div className="relative z-[1] min-h-screen">
        <div key={transitionKey} className="min-h-screen animate-page-enter">
          <Suspense
            fallback={
              isDashboardEntryPath(pathname) ? (
                <DashboardBootSkeleton />
              ) : (
                <RouteSuspenseFallback />
              )
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
      {updateAvailable && <UpdateAvailableBanner onReload={applyUpdate} />}
    </>
  );
}

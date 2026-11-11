import React from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../../features/auth';
import { DashboardNotificationsBell } from '../../../features/notifications';

import {
  BRAND_APP_CHROME_MARK_SRC,
  brandAppChromeMarkImgClassNames,
  brandWordmarkDashboardMobileBarScaleWrapperClassNames,
  brandWordmarkDashboardMobileLeadingClassNames,
} from '../../../shared/config/branding';
import { PROFILE_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import { scrollAppToTop } from '../../../shared/lib/scrollAppToTop';
import BrandWordmarkBarRow from '../../../shared/ui/BrandWordmarkBarRow';

function avatarInitial(userProfile, user) {
  const handle = userProfile?.handle?.trim?.();
  if (handle) return handle.charAt(0).toUpperCase();
  const email = user?.email?.trim?.();
  if (email) return email.charAt(0).toUpperCase();
  return '👤';
}

export default function DashboardMobileBrandBar({ user }) {
  const { userProfile } = useAuth();
  const initial = avatarInitial(userProfile, user);

  return (
    <div className="short:hidden border-b border-border-subtle/35 bg-[linear-gradient(to_bottom,rgb(var(--brand-bg-deep)/0.76),rgb(var(--brand-bg)/0.60))] py-2 shadow-[0_10px_28px_-14px_rgba(15,10,46,0.85)] ring-1 ring-inset ring-white/6 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-2xl supports-backdrop-filter:backdrop-saturate-150">
      <BrandWordmarkBarRow variant="dashboard">
        <h1 className={brandWordmarkDashboardMobileLeadingClassNames}>
          <Link
            to="/dashboard"
            onClick={scrollAppToTop}
            className="inline-flex max-w-full items-center justify-start overflow-visible text-left outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs hover:opacity-80 transition-opacity"
            aria-label="Setlist Pick 'Em — dashboard home"
          >
            <span className={brandWordmarkDashboardMobileBarScaleWrapperClassNames}>
              <img
                className={brandAppChromeMarkImgClassNames.dashboardMobileBar}
                src={BRAND_APP_CHROME_MARK_SRC}
                alt=""
                aria-hidden="true"
                loading="eager"
              />
            </span>
          </Link>
        </h1>

        <div className="flex shrink-0 items-center gap-2">
          <DashboardNotificationsBell />
          <Link
            to={PROFILE_CLUSTER_PATHS.account}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-border-subtle/35 bg-surface-panel-strong/72 text-xs font-bold text-white transition-colors hover:border-brand-primary/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Account"
          >
            {initial}
          </Link>
        </div>
      </BrandWordmarkBarRow>
    </div>
  );
}

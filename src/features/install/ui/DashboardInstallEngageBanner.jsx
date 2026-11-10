import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Download, Share2 } from 'lucide-react';

import {
  PROFILE_PREFERENCES_OPEN_PUSH_HREF,
  isMakePicksPath,
  isPoolsTertiaryPath,
  isProfileClusterPath,
} from '../../../shared/config/dashboardRoutes';
import { ga4Event } from '../../../shared/lib/ga4';
import { getInstallLeadCopy, resolveInstallCopyBranch } from '../model/installCopy';
import { useDashboardPushNudge } from '../model/useDashboardPushNudge';
import { useInstallPrompt } from '../model/useInstallPrompt';
import IosInstallScreenshotGallery from './IosInstallScreenshotGallery.jsx';
import IosSafariInstallSteps from './IosSafariInstallSteps.jsx';

/**
 * Routes where the compact install + push nudge may appear (#334). Profile
 * cluster and pool detail stay focused (no engage banner).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function dashboardRouteShowsInstallEngage(pathname) {
  const n = pathname.replace(/\/$/, '') || '/dashboard';
  if (isProfileClusterPath(n) || n === '/dashboard/admin') {
    return false;
  }
  if (n.startsWith('/dashboard/pool/')) return false;
  return (
    isMakePicksPath(n) ||
    n === '/dashboard/standings' ||
    isPoolsTertiaryPath(n)
  );
}

/**
 * Inner component: only mounts on routes where the banner may show, so
 * `useInstallPrompt` is not duplicated with `InstallAppCard` on Preferences (#334 / #770).
 *
 * @param {{ userId: string | null | undefined }} props
 */
function DashboardInstallEngageBannerLoaded({ userId }) {
  const install = useInstallPrompt();
  const push = useDashboardPushNudge({
    userId,
    isInstalled: install.isInstalled,
  });

  const showInstall = install.shouldShowDashboardInstallBanner;
  const showPush = push.shouldShowPushNudge;

  const branch = useMemo(
    () =>
      resolveInstallCopyBranch({
        canPrompt: install.canPrompt,
        shouldShowIosFlow: install.shouldShowIosFlow,
        shouldShowIosNonSafariFlow: install.shouldShowIosNonSafariFlow,
      }),
    [
      install.canPrompt,
      install.shouldShowIosFlow,
      install.shouldShowIosNonSafariFlow,
    ],
  );
  const lead = getInstallLeadCopy(branch);

  if (!showInstall && !showPush) return null;

  return (
    <div className="mb-4 space-y-2 md:mb-5">
      {showInstall ? (
        <div className="rounded-2xl border border-border-subtle/50 bg-surface-panel/50 px-4 py-3 shadow-inset-glass md:px-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-brand-primary">
            {lead.eyebrow}
          </p>
          {install.canPrompt || install.shouldShowIosFlow || install.shouldShowIosNonSafariFlow ? (
            <p className="mt-1 text-xs font-bold leading-snug text-content-secondary">{lead.body}</p>
          ) : null}

          {install.canPrompt ? (
            <button
              type="button"
              onClick={() => install.promptInstall()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-primary/45 bg-brand-primary/10 py-2.5 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              {lead.ctaLabel || 'Add to Home Screen'}
            </button>
          ) : null}

          {install.shouldShowIosFlow ? (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() =>
                  install.showIosGuide ? install.closeIosGuide() : install.openIosGuide()
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-subtle/50 bg-surface-field py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-brand-primary/50 hover:bg-surface-panel/50"
              >
                <Share2 className="h-4 w-4 shrink-0" aria-hidden />
                {install.showIosGuide ? 'Hide steps' : 'Show Safari steps'}
              </button>
              {install.showIosGuide ? (
                <div className="space-y-2">
                  <IosSafariInstallSteps compact variant="safari" />
                  <IosInstallScreenshotGallery compact />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => install.dismissIos()}
                className="text-[11px] font-black uppercase tracking-widest text-content-secondary underline decoration-border-muted/60 underline-offset-4 hover:text-white"
              >
                Don&apos;t show again
              </button>
            </div>
          ) : null}

          {install.shouldShowIosNonSafariFlow ? (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() =>
                  install.showIosGuide ? install.closeIosGuide() : install.openIosGuide()
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-subtle/50 bg-surface-field py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-brand-primary/50 hover:bg-surface-panel/50"
              >
                <Share2 className="h-4 w-4 shrink-0" aria-hidden />
                {install.showIosGuide ? 'Hide steps' : 'Show Chrome steps'}
              </button>
              {install.showIosGuide ? (
                <div className="space-y-2">
                  <IosSafariInstallSteps compact variant="chrome" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => install.dismissIos()}
                className="text-[11px] font-black uppercase tracking-widest text-content-secondary underline decoration-border-muted/60 underline-offset-4 hover:text-white"
              >
                Don&apos;t show again
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border-muted/60 pt-3">
            <button
              type="button"
              onClick={() => install.snoozeInstallDashboard(7)}
              className="text-[11px] font-black uppercase tracking-widest text-content-secondary hover:text-white"
            >
              Not now · ask again in 7 days
            </button>
          </div>
        </div>
      ) : null}

      {showPush ? (
        <div className="rounded-2xl border border-brand-primary/35 bg-brand-primary/[0.07] px-4 py-3 md:px-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-brand-primary">
            {push.highlightAfterInstall ? "You're set up — one more tap" : 'Stay in the loop'}
          </p>
          <p className="mt-1 text-xs font-bold text-content-secondary">
            {push.highlightAfterInstall
              ? 'Turn on alerts for lock reminders and score updates (your browser will ask permission once).'
              : 'Get lock reminders and score alerts on this device.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={PROFILE_PREFERENCES_OPEN_PUSH_HREF}
              onClick={() => {
                ga4Event('push_nudge_cta_clicked', { surface: 'dashboard' });
                push.clearSessionInstallFlag();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand-primary/50 bg-brand-primary/15 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/25 min-[400px]:flex-none"
            >
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Turn on alerts
            </Link>
            <button
              type="button"
              onClick={() => push.dismissPushNudge()}
              className="rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-widest text-content-secondary hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{ userId: string | null | undefined, pathname: string }} props
 */
export default function DashboardInstallEngageBanner({ userId, pathname }) {
  if (!dashboardRouteShowsInstallEngage(pathname)) return null;
  return <DashboardInstallEngageBannerLoaded userId={userId} />;
}

import React from 'react';

import {
  BRAND_APP_CHROME_MARK_SRC,
  brandAppChromeMarkImgClassNames,
  brandWordmarkDashboardMobileBarScaleWrapperClassNames,
  brandWordmarkDashboardMobileLeadingClassNames,
  brandWordmarkDashboardSidebarScaleWrapperClassNames,
} from '../../../shared/config/branding';
import BrandWordmarkBarRow from '../../../shared/ui/BrandWordmarkBarRow';

/**
 * React twin of the static `dist/dashboard/index.html` boot shell (#773).
 * Shown while auth/profile resolve so createRoot does not flash bare "Loading…".
 */
export default function DashboardBootSkeleton() {
  return (
    <div
      className="flex h-dvh min-h-0 w-full overflow-hidden bg-transparent text-white"
      role="status"
      aria-busy="true"
      aria-label="Loading Setlist Pick'em"
      data-dashboard-boot-skeleton="true"
    >
      <nav
        className="z-10 hidden w-64 flex-col border-r border-border-muted/65 bg-surface-chrome/50 p-4 desk:flex"
        aria-hidden="true"
      >
        <div className="mb-6 overflow-visible py-2">
          <div className="w-full overflow-visible text-center leading-none">
            <span className={brandWordmarkDashboardSidebarScaleWrapperClassNames}>
              <img
                src={BRAND_APP_CHROME_MARK_SRC}
                alt=""
                width={128}
                height={128}
                className={brandAppChromeMarkImgClassNames.dashboardSidebar}
                decoding="async"
              />
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-11 rounded-xl bg-brand-primary/10 ring-1 ring-inset ring-brand-primary/25" />
          <div className="h-11 animate-pulse rounded-xl bg-surface-inset/72" />
          <div className="h-11 animate-pulse rounded-xl bg-surface-inset/72" />
          <div className="h-11 animate-pulse rounded-xl bg-surface-inset/72" />
        </div>
      </nav>

      <div className="fixed left-0 top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)] short:hidden desk:hidden">
        <div className="border-b border-border-subtle/35 bg-[linear-gradient(to_bottom,rgb(var(--brand-bg-deep)/0.76),rgb(var(--brand-bg)/0.60))] py-2 shadow-[0_10px_28px_-14px_rgba(15,10,46,0.85)] ring-1 ring-inset ring-white/6 backdrop-blur-xl">
          <BrandWordmarkBarRow variant="dashboard">
            <div className={brandWordmarkDashboardMobileLeadingClassNames}>
              <span className={brandWordmarkDashboardMobileBarScaleWrapperClassNames}>
                <img
                  className={brandAppChromeMarkImgClassNames.dashboardMobileBar}
                  src={BRAND_APP_CHROME_MARK_SRC}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                />
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
              <div className="h-8 w-8 rounded-full border border-border-subtle/35 bg-surface-panel-strong/72" />
              <div className="h-8 w-8 rounded-full border border-border-subtle/35 bg-surface-panel-strong/72" />
            </div>
          </BrandWordmarkBarRow>
        </div>
      </div>

      <main className="relative min-w-0 flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)] pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] short:pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] desk:p-8 desk:pb-8 desk:pt-8">
        <div className="mx-auto w-full max-w-xl min-w-0 space-y-3 px-4 pt-2 desk:p-0">
          <div className="h-20 animate-pulse rounded-2xl bg-surface-panel/50 ring-1 ring-border-muted/35" />
          <div className="h-28 animate-pulse rounded-2xl bg-surface-panel/50 ring-1 ring-border-muted/35" />
          <div className="h-16 animate-pulse rounded-2xl bg-surface-panel/50 ring-1 ring-border-muted/35" />
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-border-subtle/35 bg-[linear-gradient(to_top,rgb(var(--brand-bg-deep)/0.76),rgb(var(--brand-bg)/0.60))] pb-[env(safe-area-inset-bottom,0px)] shadow-[inset_0_1px_0_0_rgb(var(--brand-primary)/0.12),0_-10px_28px_-14px_rgba(15,10,46,0.85)] ring-1 ring-inset ring-white/6 backdrop-blur-xl desk:hidden"
        aria-hidden="true"
      >
        <div className="grid h-16 grid-cols-4 items-center gap-0.5 px-1.5">
          <div className="mx-auto h-[calc(100%-10px)] w-full max-w-18 rounded-xl bg-brand-primary/[0.14] ring-1 ring-inset ring-brand-primary/30" />
          <div className="mx-auto h-[calc(100%-10px)] w-full max-w-18 animate-pulse rounded-xl bg-surface-inset/80" />
          <div className="mx-auto h-[calc(100%-10px)] w-full max-w-18 animate-pulse rounded-xl bg-surface-inset/80" />
          <div className="mx-auto h-[calc(100%-10px)] w-full max-w-18 animate-pulse rounded-xl bg-surface-inset/80" />
        </div>
      </nav>
    </div>
  );
}

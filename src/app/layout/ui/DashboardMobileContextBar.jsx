import React from 'react';

import {
  dashboardMobileContextTitleGradientClasses,
  dashboardMobileContextTitleWarRoomClasses,
} from '../../../shared/config/dashboardHeadingTypography';
import { DASHBOARD_MOBILE_CONTEXT_TRAILING_ROOT_ID } from '../../../shared/hooks/useDashboardMobileChromePortal';
import { DASHBOARD_MOBILE_SCOPE_SLOT_ID } from '../../../shared/ui/DashboardAdaptiveScope';

/**
 * Uniform H2 across tabs (#609):
 * - Fixed `min-h` so Profile (no scope) matches Picks/Pools/Standings.
 * - 3-column grid: title | optically centered scope slot | trailing slot.
 * - The scope slot is filled by one portaled control (Tour Date / Tour / Year).
 * - Trailing column always reserves Scale width (`w-9`) so the date picker
 *   stays in the same place whether Standings mounts Scale or not.
 */
export default function DashboardMobileContextBar({
  contextTitle,
  contextTitleTone = 'default',
}) {
  const isWarRoom = contextTitleTone === 'warRoom';

  return (
    <div className="grid min-h-13.5 w-full min-w-0 grid-cols-[minmax(0,1.2fr)_auto_minmax(0,0.8fr)] items-center gap-x-2 bg-[rgb(var(--surface-chrome)/0.98)] px-4 py-3 shadow-[0_10px_26px_-18px_rgb(var(--brand-bg-deep)/0.9),0_0_24px_-16px_rgb(var(--brand-primary)/0.07)] backdrop-blur-xs supports-backdrop-filter:backdrop-saturate-125">
      <span
        className={`min-w-0 justify-self-start truncate text-sm font-bold ${
          isWarRoom
            ? dashboardMobileContextTitleWarRoomClasses
            : dashboardMobileContextTitleGradientClasses
        }`}
      >
        {contextTitle}
      </span>

      <div id={DASHBOARD_MOBILE_SCOPE_SLOT_ID} className="justify-self-center" />

      {/*
        Always reserve the Scale hit-target width so optical center of the
        date/tour control does not shift when trailing content mounts.
      */}
      <div
        id={DASHBOARD_MOBILE_CONTEXT_TRAILING_ROOT_ID}
        className="flex h-7 w-7 shrink-0 items-center justify-end justify-self-end"
      />
    </div>
  );
}

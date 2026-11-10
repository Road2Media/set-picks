import React from 'react';

import {
  DASHBOARD_DESKTOP_PAGE_CHROME_ROOT_ID,
  DASHBOARD_DESKTOP_QUATERNARY_CHROME_ROOT_ID,
} from '../../../shared/hooks/useDashboardMobileChromePortal';

/**
 * Desktop sticky stack in the dashboard scrollport: optional date/tour scope
 * plus portal targets for cluster title + tertiary tray and optional
 * quaternary filters (Stats). Banners and page body render after this stack
 * so they scroll underneath. Shown on `desk` only (`hidden desk:block`, #705).
 * Phone landscape is `mob` and keeps the fixed mobile stack.
 *
 * @param {{ children?: React.ReactNode }} props
 */
export default function DashboardStickyChromeStack({ children = null }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 hidden bg-brand-bg/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-brand-bg/75 desk:-mx-8 desk:block desk:px-8">
      {children ? <div className="pb-3 pt-1">{children}</div> : null}
      <div id={DASHBOARD_DESKTOP_PAGE_CHROME_ROOT_ID} />
      <div id={DASHBOARD_DESKTOP_QUATERNARY_CHROME_ROOT_ID} />
    </div>
  );
}

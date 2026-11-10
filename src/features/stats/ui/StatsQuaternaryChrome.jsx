import React from 'react';
import { createPortal } from 'react-dom';

import {
  useDashboardDesktopQuaternaryChromePortal,
  useDashboardMobileQuaternaryChromePortal,
} from '../../../shared/hooks/useDashboardMobileChromePortal';

/**
 * Ports Stats quaternary filter trays into the desktop sticky stack (below
 * tertiary) and the mobile fixed chrome (below the Personal/Global/Band tray)
 * so both rows stay visible while the board scrolls.
 *
 * @param {{
 *   render: () => React.ReactNode,
 * }} props
 */
export default function StatsQuaternaryChrome({ render }) {
  const desktopRoot = useDashboardDesktopQuaternaryChromePortal();
  const mobileRoot = useDashboardMobileQuaternaryChromePortal();
  const portalsReady = Boolean(desktopRoot || mobileRoot);

  const desktop = (
    <div className="space-y-2 border-t border-border-subtle/25 pb-3 pt-2">
      {render()}
    </div>
  );

  const mobile = (
    <div className="space-y-2 border-b border-border-subtle/40 bg-brand-bg/95 px-4 py-2 backdrop-blur-md supports-backdrop-filter:bg-brand-bg/80">
      {render()}
    </div>
  );

  return (
    <>
      {desktopRoot ? createPortal(desktop, desktopRoot) : null}
      {mobileRoot ? createPortal(mobile, mobileRoot) : null}
      {!portalsReady ? <div className="space-y-2">{render()}</div> : null}
    </>
  );
}

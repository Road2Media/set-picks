import React from 'react';
import { createPortal } from 'react-dom';

import { useDashboardDeskMedia } from '../../../shared/hooks/useDashboardDeskMedia';
import {
  useDashboardDesktopPageChromePortal,
  useDashboardMobileChromePortal,
} from '../../../shared/hooks/useDashboardMobileChromePortal';
import StandingsMobileFixedChrome from './StandingsMobileFixedChrome';
import StandingsStickyChrome from './StandingsStickyChrome';

/**
 * Standings Show / Tour / Year / Pools chrome (#707).
 *
 * One mount and one handler path. The mobile tools band and the desktop
 * sticky tray stay different widgets, and only the widget for the current
 * viewport is in the DOM, so there is one `tablist`.
 *
 * @param {{
 *   view: 'show' | 'tour' | 'year' | 'pools',
 *   onChange: (next: 'show' | 'tour' | 'year' | 'pools') => void,
 *   onOpenScoringRules: () => void,
 * }} props
 */
export default function StandingsChrome({ view, onChange, onOpenScoringRules }) {
  const isDesk = useDashboardDeskMedia();
  const mobileChromeRoot = useDashboardMobileChromePortal();
  const desktopChromeRoot = useDashboardDesktopPageChromePortal();
  const chromeProps = { view, onChange, onOpenScoringRules };

  if (isDesk) {
    return desktopChromeRoot
      ? createPortal(<StandingsStickyChrome {...chromeProps} />, desktopChromeRoot)
      : null;
  }

  return mobileChromeRoot
    ? createPortal(<StandingsMobileFixedChrome {...chromeProps} />, mobileChromeRoot)
    : null;
}

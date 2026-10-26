import React from 'react';
import { createPortal } from 'react-dom';
import { Scale } from 'lucide-react';

import { useDashboardMobileContextTrailingPortal } from '../../../shared/hooks/useDashboardMobileChromePortal';
import DashboardMobileChromeBar from '../../../shared/ui/DashboardMobileChromeBar';
import ChromeIconButton from '../../../shared/ui/ChromeIconButton';
import StandingsViewToggle from './StandingsViewToggle';

/**
 * Mobile-only Standings views chrome (#609) — fixed under the context bar.
 * Show/Tour/Year/Pools fills the tools band (Profile-style full-width segmented
 * control). Scoring rules Scale portals into the context-bar trailing slot
 * so the H2 row stays seamless across Standings views.
 *
 * @param {{
 *   view: 'show' | 'tour' | 'year' | 'pools',
 *   onChange: (next: 'show' | 'tour' | 'year' | 'pools') => void,
 *   onOpenScoringRules: () => void,
 * }} props
 */
export default function StandingsMobileFixedChrome({
  view,
  onChange,
  onOpenScoringRules,
}) {
  const trailingRoot = useDashboardMobileContextTrailingPortal();

  return (
    <>
      {trailingRoot
        ? createPortal(
            <ChromeIconButton
              icon={Scale}
              label="Scoring rules"
              onClick={onOpenScoringRules}
              size="sm"
            />,
            trailingRoot,
          )
        : null}

      <DashboardMobileChromeBar
        heading="Standings views"
        headingId="standings-views-heading"
      >
        <StandingsViewToggle
          view={view}
          onChange={onChange}
          className="mb-0 w-full"
        />
      </DashboardMobileChromeBar>
    </>
  );
}

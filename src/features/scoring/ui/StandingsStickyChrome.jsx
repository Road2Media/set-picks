import React from 'react';
import { Scale } from 'lucide-react';

import { NAV_LABEL_STANDINGS } from '../../../shared/config/dashboardVocabulary';
import ChromeIconButton from '../../../shared/ui/ChromeIconButton';
import DashboardStickyPageChrome from '../../../shared/ui/DashboardStickyPageChrome';
import StandingsViewToggle from './StandingsViewToggle';

/**
 * Desktop Standings page chrome: title + Scoring rules Scale icon (title-row,
 * same control as mobile) + full-width Show/Tour/Pools tray. Portaled into the
 * layout sticky stack (`DashboardStickyChromeStack`). Invite lives in-flow as
 * {@link StandingsInvitePromo} (mirrors mobile).
 *
 * Mobile views chrome lives in the fixed header stack as
 * {@link StandingsMobileFixedChrome} (#609) — this component is desktop
 * portal content only.
 *
 * @param {{
 *   view: 'show' | 'tour' | 'year' | 'pools',
 *   onChange: (next: 'show' | 'tour' | 'year' | 'pools') => void,
 *   onOpenScoringRules: () => void,
 * }} props
 */
export default function StandingsStickyChrome({
  view,
  onChange,
  onOpenScoringRules,
}) {
  return (
    <DashboardStickyPageChrome
      title={NAV_LABEL_STANDINGS}
      trailing={
        <ChromeIconButton
          icon={Scale}
          label="Scoring rules"
          onClick={onOpenScoringRules}
          size="sm"
        />
      }
    >
      <StandingsViewToggle
        view={view}
        onChange={onChange}
        className="mb-0 min-w-0 flex-1"
      />
    </DashboardStickyPageChrome>
  );
}

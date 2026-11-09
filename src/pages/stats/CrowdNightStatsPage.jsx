import React from 'react';

import {
  CrowdNightStatsPanel,
  CrowdPulseHiddenNotice,
  useHideCrowdPulse,
} from '../../features/crowd-picks';
import { useCrowdNightStatsScreen } from '../../features/scoring';

/**
 * Stats cluster — crowd night deep dive (`/dashboard/stats/night`).
 * Not a tertiary chip. The show date picker scopes it.
 * A hidden preference skips the night reads.
 *
 * @param {{ selectedDate?: string }} props
 */
export default function CrowdNightStatsPage({ selectedDate = '' }) {
  const { hideCrowdPulse } = useHideCrowdPulse();
  if (hideCrowdPulse) return <CrowdPulseHiddenNotice />;
  return <CrowdNightStatsActive selectedDate={selectedDate} />;
}

function CrowdNightStatsActive({ selectedDate }) {
  const screen = useCrowdNightStatsScreen(selectedDate);
  return <CrowdNightStatsPanel {...screen} />;
}

import React from 'react';

import { CrowdNightStatsPanel } from '../../features/crowd-picks';
import { useCrowdNightStatsScreen } from '../../features/scoring';

/**
 * Stats cluster — crowd night deep dive (`/dashboard/stats/night`).
 * Not a tertiary chip. The show date picker scopes it.
 *
 * @param {{ selectedDate?: string }} props
 */
export default function CrowdNightStatsPage({ selectedDate = '' }) {
  const screen = useCrowdNightStatsScreen(selectedDate);
  return <CrowdNightStatsPanel {...screen} />;
}

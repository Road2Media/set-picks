import React from 'react';
import { Link } from 'react-router-dom';

import { PROFILE_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import { DASHBOARD_CARD_BODY } from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';

/**
 * Direct visits to crowd night while the preference is on.
 * Standings and Make Picks omit the block instead of showing this note.
 */
export default function CrowdPulseHiddenNotice() {
  return (
    <DashboardJobShell as="section" tone="teal" pad="label" aria-label="Crowd pulse hidden">
      <p className="text-sm font-black text-white">Crowd pulse is hidden</p>
      <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
        This page, the Standings card, and the Make Picks helper stay off
        until you turn crowd pulse back on.
      </p>
      <Link
        to={PROFILE_CLUSTER_PATHS.account}
        className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-brand-primary"
      >
        Preferences
      </Link>
    </DashboardJobShell>
  );
}

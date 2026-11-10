import React from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import { useFeatureSpotlight } from '../model/useFeatureSpotlight';

const LINK =
  'font-bold text-slate-100 underline-offset-2 hover:text-white hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg rounded-sm';

/**
 * Dismissible note that Personal and Global carry picking average, PPS, and SLG.
 * One dismissal per signed-in player, through 2026-12-31.
 *
 * @param {{ className?: string }} [props]
 */
export default function StatsRatesDidYouKnow({ className = '' }) {
  const { active, markSeen, trackClick } = useFeatureSpotlight('stats-rates');
  if (!active) return null;

  return (
    <DashboardJobShell
      tone="none"
      pad="row"
      className={['flex items-start gap-2', className].filter(Boolean).join(' ')}
      role="note"
      aria-label="Personal and Global stats"
    >
      <div className="min-w-0 flex-1">
        <p className={DASHBOARD_CARD_TITLE}>Did you know?</p>
        <p className={`mt-0.5 ${DASHBOARD_CARD_BODY}`}>
        In Stats,{' '}
        <Link
          to="/dashboard/stats/personal"
          className={LINK}
          onClick={trackClick}
        >
          Personal
        </Link>{' '}
        and{' '}
        <Link
          to="/dashboard/stats/global"
          className={LINK}
          onClick={trackClick}
        >
          Global
        </Link>{' '}
        show your picking average, points per show, and slugging percentage.
        </p>
      </div>
      <button
        type="button"
        onClick={markSeen}
        className="-mr-1 -mt-0.5 rounded-md p-1 text-content-secondary transition hover:bg-surface-inset/72 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Dismiss stats tip"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </DashboardJobShell>
  );
}

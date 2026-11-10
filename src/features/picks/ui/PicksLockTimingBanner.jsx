import React, { useState } from 'react';
import { Clock3, X } from 'lucide-react';

import { DASHBOARD_CARD_BODY } from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import {
  PICKS_LOCK_AFTER_START_MIN,
  formatLockTimeLocalLabel,
  parseLocalHm,
  resolvePicksLockHm,
} from '../../../shared/utils/picksLockTime';

function durationWords(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins > 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/**
 * @param {{
 *   date?: string,
 *   doorsLocal?: string,
 *   scheduledStartLocal?: string,
 *   picksLockLocal?: string,
 *   picksLockSource?: string,
 * } | null | undefined} show
 */
export function buildPicksLockTimingMessage(show) {
  const lock = resolvePicksLockHm(show);
  const lockLabel = formatLockTimeLocalLabel(lock);
  const start = parseLocalHm(lock.scheduledStartLocal);
  const isStartBased =
    lock.source === 'scheduledStart' ||
    show?.picksLockSource === 'scheduledStart';

  if (start && isStartBased) {
    return `Picks lock at ${lockLabel} — ${durationWords(
      PICKS_LOCK_AFTER_START_MIN
    )} after tonight’s published ticket time (${formatLockTimeLocalLabel(start)}).`;
  }

  return `Picks lock at ${lockLabel} venue-local.`;
}

function dismissalKey(showDate) {
  return `picks-lock-timing-dismissed:${showDate}`;
}

function wasDismissed(showDate) {
  if (!showDate || typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(dismissalKey(showDate)) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal(showDate) {
  if (!showDate || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(dismissalKey(showDate), '1');
  } catch {
    // Storage can be disabled; local state still dismisses for this mount.
  }
}

/**
 * Small pre-lock timing notice shared by Picks and Standings.
 *
 * @param {{
 *   show: {
 *     date?: string,
 *     doorsLocal?: string,
 *     scheduledStartLocal?: string,
 *     picksLockLocal?: string,
 *     picksLockSource?: string,
 *   } | null | undefined,
 *   showStatus: string | null | undefined
 * }} props
 */
export default function PicksLockTimingBanner({ show, showStatus }) {
  const showDate = typeof show?.date === 'string' ? show.date : '';
  const [dismissed, setDismissed] = useState(() => wasDismissed(showDate));

  if (!show || showStatus !== 'NEXT' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    rememberDismissal(showDate);
  };

  return (
    <DashboardJobShell
      tone="none"
      pad="row"
      className="mb-4 flex items-start gap-3"
      role="status"
    >
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-content-secondary" aria-hidden />
      <p className={`min-w-0 flex-1 ${DASHBOARD_CARD_BODY}`}>
        {buildPicksLockTimingMessage(show)}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 -mt-0.5 rounded-md p-1 text-content-secondary transition hover:bg-surface-inset/72 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Dismiss picks lock timing"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </DashboardJobShell>
  );
}

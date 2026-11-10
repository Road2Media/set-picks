import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Loader2, Pencil, Ticket } from 'lucide-react';

import { HundredthShowCardMark } from '../../hundredth-show';
import Button from '../../../shared/ui/Button';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_BOX_EYEBROW,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

/**
 * "Tonight's show / make picks" surface for the Standings page Show view
 * (#255). Mirrors `PoolHubActiveShow`'s pre-lock branches — "Make picks"
 * when not secured, "You're in / edit until showtime" when secured — but
 * intentionally omits the `isLocked` / "View show standings" branch
 * because this card only renders while the pick window is open; once the
 * show locks, the leaderboard itself is the primary surface and this
 * card is hidden by the page.
 *
 * Routes to `/dashboard` (Picks tab) so users land on the editable form.
 *
 * @param {Object} props
 * @param {string} props.showLabel — venue + date for the selected show
 * @param {string} [props.showDate] — YYYY-MM-DD, for 100th-show branding
 * @param {boolean} props.isShowToday — selectedDate === today
 * @param {boolean} props.isSecured — user has submitted non-empty picks
 * @param {boolean} [props.picksStatusLoading] — avoids flashing "no picks" before Firestore resolves
 */
export default function StandingsActiveShowCard({
  showLabel,
  showDate = '',
  isShowToday,
  isSecured,
  picksStatusLoading = false,
}) {
  const navigate = useNavigate();

  let eyebrow;
  let bodyLine;

  if (picksStatusLoading) {
    eyebrow = isShowToday ? "TONIGHT'S SHOW" : 'NOW PICKING FOR';
    bodyLine = 'Checking your picks for this show…';
  } else if (!isSecured) {
    eyebrow = isShowToday ? "TONIGHT'S SHOW" : 'NOW PICKING FOR';
    bodyLine = isShowToday
      ? "You haven't locked in picks for tonight's show yet."
      : "You haven't locked in picks for this upcoming show yet.";
  } else {
    eyebrow = isShowToday ? "TONIGHT'S SHOW" : 'PICKS SECURED';
    bodyLine = isShowToday
      ? "You're in for tonight — you can still edit on the Picks tab until showtime."
      : "You're in for this show — you can still edit on the Picks tab until showtime.";
  }

  return (
    <DashboardJobShell as="section" tone="teal" pad="label">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p
            className={`inline-flex items-center gap-1.5 ${STANDINGS_BOX_EYEBROW} text-brand-primary`}
          >
            <Ticket
              className={`${DASHBOARD_JOB_ICON} text-brand-primary`}
              aria-hidden
            />
            {eyebrow}
          </p>
          {showLabel ? (
            <p className={`wrap-break-word ${STANDINGS_BOX_TITLE}`}>{showLabel}</p>
          ) : null}
          <HundredthShowCardMark showDate={showDate} />
          {picksStatusLoading ? (
            <p className={`flex items-center gap-2 ${STANDINGS_BOX_BODY}`}>
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-content-secondary"
                aria-hidden
              />
              {bodyLine}
            </p>
          ) : (
            <p className={STANDINGS_BOX_BODY}>{bodyLine}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {picksStatusLoading ? (
            <div
              className="flex h-10 w-full min-w-44 items-center justify-center rounded-xl border border-border-subtle/50 bg-surface-field sm:w-auto"
              aria-busy="true"
              aria-label="Loading picks status"
            >
              <Loader2 className="h-4 w-4 animate-spin text-content-secondary" />
            </div>
          ) : !isSecured ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full min-w-44 sm:w-auto uppercase tracking-widest"
              onClick={() => navigate('/dashboard')}
            >
              <ListMusic className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Make picks
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full min-w-44 sm:w-auto uppercase tracking-widest"
              onClick={() => navigate('/dashboard')}
            >
              <Pencil className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              View / Edit picks
            </Button>
          )}
        </div>
      </div>
    </DashboardJobShell>
  );
}

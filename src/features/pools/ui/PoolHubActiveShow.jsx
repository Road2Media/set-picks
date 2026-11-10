import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Loader2, Pencil, Trophy } from 'lucide-react';

import { HundredthShowCardMark } from '../../hundredth-show';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';

/**
 * Prominent “active show” CTA on pool details (above season totals).
 *
 * @param {Object} props
 * @param {string} props.showLabel — e.g. venue + date line for the next pickable show
 * @param {string} [props.showDate] — YYYY-MM-DD, for 100th-show branding
 * @param {boolean} props.isShowToday — when next pickable show’s calendar date is today
 * @param {boolean} props.isSecured — defensive: false while loading or on fetch error
 * @param {boolean} props.isLocked — show is not in NEXT pick window (LIVE / PAST / FUTURE)
 * @param {string} props.nextShowTimeStatus — from {@link getShowStatus} for LIVE vs PAST copy
 * @param {boolean} [props.picksStatusLoading] — when !isLocked, avoids flashing “no picks” before Firestore resolves
 * @param {string} props.poolId — passed through to Standings via router state
 */
export default function PoolHubActiveShow({
  showLabel,
  showDate = '',
  isShowToday,
  isSecured,
  isLocked,
  nextShowTimeStatus,
  picksStatusLoading = false,
  poolId,
}) {
  const navigate = useNavigate();

  const lockedEyebrow =
    nextShowTimeStatus === 'LIVE'
      ? 'LIVE NOW'
      : nextShowTimeStatus === 'PAST'
        ? 'PAST SHOW'
        : 'SHOW LOCKED';

  let eyebrow = 'CURRENT SHOW';
  let bodyLine = null;

  if (isLocked) {
    eyebrow = lockedEyebrow;
    bodyLine =
      nextShowTimeStatus === 'PAST'
        ? 'This show has wrapped — open Standings, choose this pool under Compare, and pick that night’s date.'
        : 'Open Standings, choose this pool under Compare, and follow scores for tonight.';
  } else if (picksStatusLoading) {
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
    <Card as="section" variant="venue" padding="sm" className="md:p-6">
      <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
            {eyebrow}
          </p>
          <p className="font-display text-lg font-bold leading-snug text-white md:text-xl">
            <span className="break-words text-brand-primary">{showLabel}</span>
          </p>
          <HundredthShowCardMark showDate={showDate} />
          {picksStatusLoading && !isLocked ? (
            <p className="flex items-center gap-2 text-sm font-bold text-content-secondary">
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-content-secondary"
                aria-hidden
              />
              {bodyLine}
            </p>
          ) : bodyLine ? (
            <p className="text-sm font-bold text-content-secondary">{bodyLine}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {isLocked ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full min-w-[12rem] sm:w-auto uppercase tracking-widest"
              onClick={() =>
                navigate('/dashboard/standings', {
                  state: { targetPoolId: poolId },
                })
              }
            >
              <Trophy className="mr-2 h-5 w-5 shrink-0" aria-hidden />
              View show standings
            </Button>
          ) : picksStatusLoading ? (
            <div
              className="flex h-11 w-full min-w-[12rem] items-center justify-center rounded-xl border border-border-subtle bg-surface-field sm:w-auto"
              aria-busy="true"
              aria-label="Loading picks status"
            >
              <Loader2 className="h-5 w-5 animate-spin text-content-secondary" />
            </div>
          ) : !isSecured ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full min-w-[12rem] sm:w-auto uppercase tracking-widest"
              onClick={() => navigate('/dashboard')}
            >
              <ListMusic className="mr-2 h-5 w-5 shrink-0" aria-hidden />
              Make picks
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full min-w-[12rem] sm:w-auto uppercase tracking-widest"
              onClick={() => navigate('/dashboard')}
            >
              <Pencil className="mr-2 h-5 w-5 shrink-0" aria-hidden />
              View / Edit picks
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

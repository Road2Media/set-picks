import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

import { useShowCalendar } from '../../show-calendar';
import { formatShowLabel, scheduleTodayYmd } from '../../../shared';
import { GAME_LAUNCH_SHOW_DATE } from '../../../shared/config/gameLaunch';

export default function PoolHubShowArchive({ poolId }) {
  const { showDates } = useShowCalendar();
  // Past Shows lists every previously-finalized night for the schedule the
  // pool plays on. Phish.net's `show_calendar` (#160) syncs upstream tour
  // dates — including nights before the game existed; those are pure noise
  // here. Floor at #254's `GAME_LAUNCH_SHOW_DATE` so the archive only
  // surfaces nights with possible standings.
  const pastShows = useMemo(() => {
    const today = scheduleTodayYmd();
    return showDates.filter(
      (s) => s.date >= GAME_LAUNCH_SHOW_DATE && s.date < today
    );
  }, [showDates]);

  return (
    <section>
      <details className="group rounded-xl border border-border-subtle/50 bg-surface-glass/32 shadow-inset-glass">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-content-secondary transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
          <span className="uppercase tracking-widest">Past shows</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-2 border-t border-border-muted/60 px-3 py-3">
          {pastShows.length > 0 ? (
            <ul className="space-y-2">
              {pastShows.map((show) => (
                <li key={show.date}>
                  <Link
                    to={`/dashboard/standings?showDate=${encodeURIComponent(show.date)}&poolId=${encodeURIComponent(poolId)}`}
                    className="block rounded-xl border border-border-subtle/50 bg-surface-panel/50 px-4 py-3 text-sm font-bold text-brand-primary transition-colors hover:bg-surface-panel-strong/72 hover:text-brand-primary-strong"
                  >
                    Show standings · {formatShowLabel(show.date)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm font-bold text-content-secondary">
              No past shows in the schedule yet.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

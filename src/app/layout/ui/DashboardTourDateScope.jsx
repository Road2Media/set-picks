import React from 'react';

import { HundredthShowCardMark } from '../../../features/hundredth-show';

import {
  dashboardScopeSelectCardClasses,
  dashboardTourDateLabelGradientClasses,
  dashboardTourDateSelectChromeDesktopWrap,
  dashboardTourDateSelectChromeMobileWrap,
} from '../../../shared/config/dashboardHeadingTypography';
import { useDashboardDeskMedia } from '../../../shared/hooks/useDashboardDeskMedia';
import ChromeScopeStepper from '../../../shared/ui/ChromeScopeStepper';
import DashboardAdaptiveScope from '../../../shared/ui/DashboardAdaptiveScope';
import { adjacentScopeKeys } from '../../../shared/utils/adjacentScopeKeys';
import {
  showOptionLabelCompact,
  showOptionLabelDesktop,
  showOptionTitle,
} from '../../../shared/utils/showOptionLabel.js';

const SELECT_CLASS_MOBILE =
  'show-date-select w-full max-w-full min-w-0 appearance-none rounded-[7px] border-0 bg-surface-field py-1.5 pl-2.5 pr-2 text-[11px] font-bold text-white outline-none ring-0 transition-colors cursor-pointer focus:border-transparent focus:ring-0';

const SELECT_CLASS_DESKTOP =
  'show-date-select w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-[11px] border-0 bg-surface-field px-3 py-2.5 text-sm font-bold text-white outline-none ring-0 transition-colors focus:border-transparent focus:ring-0';

/**
 * Global Tour Date scope control (#609 / #707) — one mount, one select.
 * Desktop card chrome uses `desk:` classes. Below `desk`, the same tree
 * portals into the mobile context bar ({@link DashboardAdaptiveScope}).
 *
 * @param {{
 *   selectedDate: string,
 *   onSelectedDateChange: (ymd: string) => void,
 *   showDates: Array<{ date: string }>,
 *   showDatesByTour: Array<{ tour: string, shows: Array<object> }>,
 * }} props
 */
export default function DashboardTourDateScope(props) {
  return (
    <DashboardAdaptiveScope>
      <DashboardTourDateScopeControl {...props} />
    </DashboardAdaptiveScope>
  );
}

/**
 * Presentational half. Tests render this directly; the default export places it.
 *
 * @param {{
 *   selectedDate: string,
 *   onSelectedDateChange: (ymd: string) => void,
 *   showDates: Array<{ date: string }>,
 *   showDatesByTour: Array<{ tour: string, shows: Array<object> }>,
 * }} props
 */
export function DashboardTourDateScopeControl({
  selectedDate,
  onSelectedDateChange,
  showDates,
  showDatesByTour,
}) {
  const isDesk = useDashboardDeskMedia();
  const { prevKey, nextKey } = adjacentScopeKeys(
    showDates,
    selectedDate,
    (show) => show.date,
  );
  const optionLabel = isDesk ? showOptionLabelDesktop : showOptionLabelCompact;

  return (
    <div className={`flex min-w-0 items-center ${dashboardScopeSelectCardClasses}`}>
      <span className="hidden min-w-0 shrink flex-col gap-0.5 px-2 desk:flex">
        <span
          className={`text-xs font-black uppercase tracking-widest ${dashboardTourDateLabelGradientClasses}`}
        >
          Tour Date:
        </span>
        <HundredthShowCardMark showDate={selectedDate} />
      </span>
      <ChromeScopeStepper
        size={isDesk ? 'md' : 'sm'}
        canPrev={Boolean(prevKey)}
        canNext={Boolean(nextKey)}
        prevLabel="Previous show date"
        nextLabel="Next show date"
        onPrev={() => prevKey && onSelectedDateChange(prevKey)}
        onNext={() => nextKey && onSelectedDateChange(nextKey)}
        className={isDesk ? 'min-w-0 shrink' : 'min-w-0 shrink-0'}
      >
        <div
          className={
            isDesk
              ? `${dashboardTourDateSelectChromeDesktopWrap} w-64 max-w-full`
              : `${dashboardTourDateSelectChromeMobileWrap} min-w-0 w-[11rem] max-w-[11rem] sm:w-[12rem] sm:max-w-[12rem]`
          }
        >
          <select
            value={selectedDate}
            onChange={(event) => onSelectedDateChange(event.target.value)}
            aria-label="Tour date"
            className={isDesk ? SELECT_CLASS_DESKTOP : SELECT_CLASS_MOBILE}
          >
            {showDatesByTour.map(({ tour, shows }, idx) => (
              <optgroup
                key={`${tour}-${shows[0]?.date ?? idx}`}
                label={tour}
                className="tour-optgroup"
              >
                {shows.map((show) => (
                  <option
                    key={show.date}
                    value={show.date}
                    title={showOptionTitle(show)}
                  >
                    {optionLabel(show)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </ChromeScopeStepper>
    </div>
  );
}

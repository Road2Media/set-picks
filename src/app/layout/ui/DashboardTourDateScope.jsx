import React from 'react';

import { HundredthShowCardMark } from '../../../features/hundredth-show';

import {
  dashboardTourDateLabelGradientClasses,
  dashboardTourDateSelectChromeDesktopWrap,
  dashboardTourDateSelectChromeMobileWrap,
} from '../../../shared/config/dashboardHeadingTypography';
import ChromeScopeStepper from '../../../shared/ui/ChromeScopeStepper';
import { adjacentScopeKeys } from '../../../shared/utils/adjacentScopeKeys';
import {
  showOptionLabelCompact,
  showOptionLabelDesktop,
  showOptionTitle,
} from '../../../shared/utils/showOptionLabel.js';

/**
 * Global Tour Date scope control (#609) — single-row select with prev/next
 * arrows. Keeps the prior chrome row height (label inline, not stacked).
 *
 * @param {{
 *   variant: 'mobile' | 'desktop',
 *   selectedDate: string,
 *   onSelectedDateChange: (ymd: string) => void,
 *   showDates: Array<{ date: string }>,
 *   showDatesByTour: Array<{ tour: string, shows: Array<object> }>,
 * }} props
 */
export default function DashboardTourDateScope({
  variant,
  selectedDate,
  onSelectedDateChange,
  showDates,
  showDatesByTour,
}) {
  const { prevKey, nextKey } = adjacentScopeKeys(
    showDates,
    selectedDate,
    (s) => s.date,
  );

  const select = (
    <select
      value={selectedDate}
      onChange={(e) => onSelectedDateChange(e.target.value)}
      aria-label="Tour date"
      className={
        variant === 'desktop'
          ? 'show-date-select w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-[11px] border-0 bg-surface-field px-3 py-2.5 text-sm font-bold text-white outline-none ring-0 transition-colors focus:border-transparent focus:ring-0'
          : 'show-date-select w-full max-w-full min-w-0 appearance-none rounded-[7px] border-0 bg-surface-field py-1.5 pl-2.5 pr-2 text-[11px] font-bold text-white outline-none ring-0 transition-colors cursor-pointer focus:border-transparent focus:ring-0'
      }
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
              {variant === 'desktop'
                ? showOptionLabelDesktop(show)
                : showOptionLabelCompact(show)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  if (variant === 'desktop') {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border-muted/70 bg-surface-panel-strong p-3 shadow-inset-glass ring-1 ring-border-glass/45 backdrop-blur-md">
        <span className="flex min-w-0 shrink flex-col gap-0.5 px-2">
          <span
            className={`text-xs font-black uppercase tracking-widest ${dashboardTourDateLabelGradientClasses}`}
          >
            Tour Date:
          </span>
          <HundredthShowCardMark showDate={selectedDate} />
        </span>
        <ChromeScopeStepper
          size="md"
          canPrev={Boolean(prevKey)}
          canNext={Boolean(nextKey)}
          prevLabel="Previous show date"
          nextLabel="Next show date"
          onPrev={() => prevKey && onSelectedDateChange(prevKey)}
          onNext={() => nextKey && onSelectedDateChange(nextKey)}
          className="min-w-0 shrink"
        >
          <div className={`${dashboardTourDateSelectChromeDesktopWrap} w-64 max-w-full`}>
            {select}
          </div>
        </ChromeScopeStepper>
      </div>
    );
  }

  // Mobile: compact single row — no stacked label (aria-label on select).
  return (
    <ChromeScopeStepper
      size="sm"
      canPrev={Boolean(prevKey)}
      canNext={Boolean(nextKey)}
      prevLabel="Previous show date"
      nextLabel="Next show date"
      onPrev={() => prevKey && onSelectedDateChange(prevKey)}
      onNext={() => nextKey && onSelectedDateChange(nextKey)}
      className="min-w-0 shrink-0"
    >
      <div
        className={`${dashboardTourDateSelectChromeMobileWrap} min-w-0 w-[11rem] max-w-[11rem] sm:w-[12rem] sm:max-w-[12rem]`}
      >
        {select}
      </div>
    </ChromeScopeStepper>
  );
}

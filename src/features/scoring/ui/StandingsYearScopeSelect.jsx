import React from 'react';

import {
  dashboardTourDateLabelGradientClasses,
  dashboardTourDateSelectChromeDesktopWrap,
  dashboardTourDateSelectChromeMobileWrap,
} from '../../../shared/config/dashboardHeadingTypography';

/**
 * Year scope selector for the Standings Year view (#1110). Same chrome slot
 * as Tour Date / the tour picker: the date picker hides, this select shows.
 *
 * @param {{
 *   variant: 'mobile' | 'desktop',
 *   years: Array<{ year: string }>,
 *   selectedYearKey: string | null | undefined,
 *   onSelectYear: (yearKey: string) => void,
 * }} props
 */
export default function StandingsYearScopeSelect({
  variant,
  years,
  selectedYearKey,
  onSelectYear,
}) {
  if (!Array.isArray(years) || years.length === 0) return null;

  const activeKey = selectedYearKey ?? years[0]?.year ?? '';
  const multiple = years.length > 1;

  if (variant === 'desktop') {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border-muted/70 bg-surface-panel-strong p-3 shadow-inset-glass ring-1 ring-border-glass/45 backdrop-blur-md">
        <span
          className={`shrink-0 px-2 text-xs font-black uppercase tracking-widest ${dashboardTourDateLabelGradientClasses}`}
        >
          Year:
        </span>
        <div className="min-w-0 w-64 max-w-full shrink">
          {multiple ? (
            <div className={dashboardTourDateSelectChromeDesktopWrap}>
              <select
                value={activeKey}
                onChange={(e) => onSelectYear(e.target.value)}
                aria-label="Select year"
                className="show-date-select w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-[11px] border-0 bg-surface-field px-3 py-2.5 text-base font-bold text-white outline-none ring-0 transition-colors focus:border-transparent focus:ring-0"
              >
                {years.map((group) => (
                  <option key={group.year} value={group.year}>
                    {group.year}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="block truncate px-3 py-2.5 text-base font-bold text-white">
              {activeKey}
            </span>
          )}
        </div>
      </div>
    );
  }

  return multiple ? (
    <div
      className={`${dashboardTourDateSelectChromeMobileWrap} min-w-0 w-[11rem] max-w-[11rem] shrink-0 sm:w-[12rem] sm:max-w-[12rem]`}
    >
      <select
        value={activeKey}
        onChange={(e) => onSelectYear(e.target.value)}
        aria-label="Select year"
        className="show-date-select w-full min-w-0 max-w-full appearance-none rounded-[7px] border-0 bg-surface-field py-1.5 pl-2.5 pr-2 text-xs font-bold text-white outline-none ring-0 transition-colors cursor-pointer focus:border-transparent focus:ring-0"
      >
        {years.map((group) => (
          <option key={group.year} value={group.year}>
            {group.year}
          </option>
        ))}
      </select>
    </div>
  ) : (
    <span className="w-[11rem] max-w-[11rem] shrink-0 truncate text-center text-xs font-bold text-white sm:w-[12rem] sm:max-w-[12rem]">
      {activeKey}
    </span>
  );
}

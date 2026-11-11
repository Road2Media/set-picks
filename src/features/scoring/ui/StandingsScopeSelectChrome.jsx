import React from 'react';

import {
  dashboardScopeSelectCardClasses,
  dashboardTourDateLabelGradientClasses,
  dashboardTourDateSelectChromeDesktopWrap,
  dashboardTourDateSelectChromeMobileWrap,
} from '../../../shared/config/dashboardHeadingTypography';
import { useDashboardDeskMedia } from '../../../shared/hooks/useDashboardDeskMedia';
import DashboardAdaptiveScope from '../../../shared/ui/DashboardAdaptiveScope';

const SELECT_CLASS_MOBILE =
  'show-date-select w-full min-w-0 max-w-full appearance-none rounded-[7px] border-0 bg-surface-field py-1.5 pl-2.5 pr-2 text-xs font-bold text-white outline-hidden ring-0 transition-colors cursor-pointer focus:border-transparent focus:ring-0';

const SELECT_CLASS_DESKTOP =
  'show-date-select w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-[11px] border-0 bg-surface-field px-3 py-2.5 text-base font-bold text-white outline-hidden ring-0 transition-colors focus:border-transparent focus:ring-0';

/**
 * Shared Tour / Year scope chrome (#609 / #1110 / #707).
 * One select. Desktop card uses `desk:` classes. Mobile placement is the
 * context-bar portal in {@link DashboardAdaptiveScope}.
 *
 * @param {{
 *   label: string,
 *   ariaLabel: string,
 *   options: Array<{ value: string }>,
 *   activeKey: string,
 *   onSelect: (value: string) => void,
 * }} props
 */
export function StandingsScopeSelectControl({
  label,
  ariaLabel,
  options,
  activeKey,
  onSelect,
}) {
  const isDesk = useDashboardDeskMedia();
  const multiple = options.length > 1;

  const value = multiple ? (
    <div
      className={
        isDesk
          ? dashboardTourDateSelectChromeDesktopWrap
          : `${dashboardTourDateSelectChromeMobileWrap} min-w-0 w-44 max-w-44 shrink-0 sm:w-48 sm:max-w-48`
      }
    >
      <select
        value={activeKey}
        onChange={(event) => onSelect(event.target.value)}
        aria-label={ariaLabel}
        className={isDesk ? SELECT_CLASS_DESKTOP : SELECT_CLASS_MOBILE}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
    </div>
  ) : (
    <span
      className={
        isDesk
          ? 'block truncate px-3 py-2.5 text-base font-bold text-white'
          : 'w-44 max-w-44 shrink-0 truncate text-center text-xs font-bold text-white sm:w-48 sm:max-w-48'
      }
    >
      {activeKey}
    </span>
  );

  return (
    <div className={`flex min-w-0 items-center ${dashboardScopeSelectCardClasses}`}>
      <span
        className={`hidden shrink-0 px-2 text-xs font-black uppercase tracking-widest desk:inline ${dashboardTourDateLabelGradientClasses}`}
      >
        {label}
      </span>
      <div
        className={
          isDesk
            ? 'min-w-0 w-64 max-w-full shrink'
            : 'contents'
        }
      >
        {value}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   label: string,
 *   ariaLabel: string,
 *   options: Array<{ value: string }>,
 *   activeKey: string,
 *   onSelect: (value: string) => void,
 * }} props
 */
export default function StandingsScopeSelectChrome(props) {
  if (!props.options?.length) return null;
  return (
    <DashboardAdaptiveScope>
      <StandingsScopeSelectControl {...props} />
    </DashboardAdaptiveScope>
  );
}

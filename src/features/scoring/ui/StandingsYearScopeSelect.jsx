import React from 'react';

import StandingsScopeSelectChrome from './StandingsScopeSelectChrome';

/**
 * Year scope selector for the Standings Year view (#1110 / #707). Same chrome
 * slot as Tour Date / the tour picker: the date picker hides, this select shows.
 *
 * @param {{
 *   years: Array<{ year: string }>,
 *   selectedYearKey: string | null | undefined,
 *   onSelectYear: (yearKey: string) => void,
 * }} props
 */
export default function StandingsYearScopeSelect({
  years,
  selectedYearKey,
  onSelectYear,
}) {
  const options = Array.isArray(years) ? years.map((group) => ({ value: group.year })) : [];
  const activeKey = selectedYearKey ?? options[0]?.value ?? '';
  return (
    <StandingsScopeSelectChrome
      label="Year:"
      ariaLabel="Select year"
      options={options}
      activeKey={activeKey}
      onSelect={onSelectYear}
    />
  );
}

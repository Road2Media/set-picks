import React from 'react';

import StandingsScopeSelectChrome from './StandingsScopeSelectChrome';

/**
 * Tour scope selector for the Standings Tour view (#295 / #609 / #707).
 * Same chrome slot as Tour Date. One mount, one select.
 *
 * Prev/next arrows omitted: with only a couple of selectable tours, stepping
 * adds little over the select. Revisit when the list regularly exceeds ~3.
 *
 * @param {{
 *   tours: Array<{ tour: string }>,
 *   selectedTourKey: string | null | undefined,
 *   onSelectTour: (tourKey: string) => void,
 * }} props
 */
export default function StandingsTourScopeSelect({
  tours,
  selectedTourKey,
  onSelectTour,
}) {
  const options = Array.isArray(tours) ? tours.map((tour) => ({ value: tour.tour })) : [];
  const activeKey = selectedTourKey ?? options[0]?.value ?? '';
  return (
    <StandingsScopeSelectChrome
      label="Tour:"
      ariaLabel="Select tour"
      options={options}
      activeKey={activeKey}
      onSelect={onSelectTour}
    />
  );
}

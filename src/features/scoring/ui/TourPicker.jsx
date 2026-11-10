import React from 'react';

import { useDashboardDeskMedia } from '../../../shared/hooks/useDashboardDeskMedia';
import FilterPill from '../../../shared/ui/FilterPill';

/**
 * Tour selection UI for the "Past tours" picker (#295 / #707).
 *
 * Renders nothing when there is only one (or zero) tours to choose from —
 * the single-tour case needs no picker UI.
 *
 * One mount, one `onSelect`. The two widgets are different, so both stay in
 * this file, and only the one for the current viewport is in the DOM:
 *   - Mobile, including phone landscape (`mob`): native `<select>`.
 *   - `desk` (wide and at least 480px tall): horizontal pill/chip group
 *     matching the pool picker pattern in {@link StandingsPoolPicker}.
 *
 * @param {{
 *   tours: Array<{ tour: string }>,
 *   selectedTourKey: string | null | undefined,
 *   onSelect: (tourKey: string) => void,
 *   className?: string,
 * }} props
 */
export default function TourPicker({ tours, selectedTourKey, onSelect, className = '' }) {
  const isDesk = useDashboardDeskMedia();
  if (!Array.isArray(tours) || tours.length <= 1) return null;

  const activeKey = selectedTourKey ?? tours[0]?.tour ?? '';

  return (
    <TourPickerControls
      isDesk={isDesk}
      tours={tours}
      activeKey={activeKey}
      onSelect={onSelect}
      className={className}
    />
  );
}

/**
 * @param {{
 *   isDesk: boolean,
 *   tours: Array<{ tour: string }>,
 *   activeKey: string,
 *   onSelect: (tourKey: string) => void,
 *   className?: string,
 * }} props
 */
export function TourPickerControls({ isDesk, tours, activeKey, onSelect, className = '' }) {
  return (
    <div className={['mb-4', className].filter(Boolean).join(' ')}>
      {isDesk ? (
        <div
          className="flex flex-wrap gap-1.5 px-1"
          role="group"
          aria-label="Select tour"
        >
          {tours.map((tour) => (
            <FilterPill
              key={tour.tour}
              selected={activeKey === tour.tour}
              onClick={() => onSelect(tour.tour)}
            >
              {tour.tour}
            </FilterPill>
          ))}
        </div>
      ) : (
        <select
          className="w-full rounded-xl border border-border-subtle/50 bg-surface-panel/50 px-3 py-2 text-sm font-semibold text-white focus:outline-hidden focus:ring-2 focus:ring-brand"
          value={activeKey}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Select tour"
        >
          {tours.map((tour) => (
            <option key={tour.tour} value={tour.tour}>
              {tour.tour}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

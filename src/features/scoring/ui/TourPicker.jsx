import React from 'react';

import FilterPill from '../../../shared/ui/FilterPill';

/**
 * Tour selection UI for the "Past tours" picker (#295).
 *
 * Renders nothing when there is only one (or zero) tours to choose from —
 * the single-tour case needs no picker UI.
 *
 * Responsive (`desk` / `mob`, #705 — not the `md` width breakpoint):
 *   - Mobile, including phone landscape: native `<select>`.
 *   - Desk (wide and at least 480px tall): horizontal pill/chip group
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
  if (!Array.isArray(tours) || tours.length <= 1) return null;

  const activeKey = selectedTourKey ?? tours[0]?.tour ?? '';

  return (
    <div className={['mb-4', className].filter(Boolean).join(' ')}>
      {/* Mobile: native select */}
      <select
        className="desk:hidden w-full rounded-xl border border-border-subtle bg-surface-panel px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        value={activeKey}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Select tour"
      >
        {tours.map((t) => (
          <option key={t.tour} value={t.tour}>
            {t.tour}
          </option>
        ))}
      </select>

      {/* Desktop: pill group */}
      <div
        className="hidden desk:flex flex-wrap gap-1.5 px-1"
        role="group"
        aria-label="Select tour"
      >
        {tours.map((t) => (
          <FilterPill
            key={t.tour}
            selected={activeKey === t.tour}
            onClick={() => onSelect(t.tour)}
          >
            {t.tour}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

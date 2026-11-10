import React from 'react';

/**
 * Fixed mobile chrome band under the dashboard context bar (#609).
 *
 * Contract:
 * - Uniform `min-h` so the band is the same height on every tab regardless
 *   of content (pills, icon buttons, sub-nav).
 * - Darker surface than the context bar (`brand-bg` vs `surface-chrome`) so
 *   the title row and the tools row read as two tiers, not one gray block.
 * - `heading` is screen-reader-only; visible chrome stays controls-only.
 *
 * @param {{
 *   heading: string,
 *   headingId: string,
 *   children: React.ReactNode,
 * }} props
 */
export default function DashboardMobileChromeBar({ heading, headingId, children }) {
  return (
    <header
      aria-labelledby={headingId}
      className="flex min-h-14 items-center border-b border-border-subtle/35 bg-brand-bg/95 px-4 py-2 backdrop-blur-xs supports-backdrop-filter:backdrop-saturate-125"
    >
      <h3 id={headingId} className="sr-only">
        {heading}
      </h3>
      <div className="min-w-0 flex-1">{children}</div>
    </header>
  );
}

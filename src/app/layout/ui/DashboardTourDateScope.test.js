import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DashboardTourDateScopeControl } from './DashboardTourDateScope.jsx';

const showDates = [{ date: '2026-10-07', venue: 'Richmond, VA' }];
const showDatesByTour = [{ tour: 'Fall Tour 2026', shows: showDates }];

function renderControl() {
  return renderToStaticMarkup(
    React.createElement(DashboardTourDateScopeControl, {
      selectedDate: '2026-10-07',
      onSelectedDateChange: () => {},
      showDates,
      showDatesByTour,
    }),
  );
}

describe('DashboardTourDateScope (#707)', () => {
  it('renders one tour-date select and keeps desktop chrome classes on the same tree', () => {
    const html = renderControl();
    const selects = html.split('<select').length - 1;
    expect(selects).toBe(1);
    expect(html).toContain('aria-label="Tour date"');
    expect(html).toContain('10/07/26 Richmond');
    expect(html).toContain('desk:rounded-2xl');
    expect(html).toContain('Previous show date');
    expect(html).toContain('Next show date');
    expect(html.match(/aria-label="Previous show date"/g)).toHaveLength(1);
  });
});

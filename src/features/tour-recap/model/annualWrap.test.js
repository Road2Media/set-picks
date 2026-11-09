import { describe, expect, it } from 'vitest';

import { ANNUAL_WRAP_TEMPLATE_ID, annualWrapStandingsHref } from './annualWrap.js';

describe('annual wrap link', () => {
  it('uses the year board and keeps a four-digit year in the URL', () => {
    expect(ANNUAL_WRAP_TEMPLATE_ID).toBe('annual-wrap');
    expect(annualWrapStandingsHref('2026')).toBe('/dashboard/standings?view=year&year=2026');
    expect(annualWrapStandingsHref('')).toBe('/dashboard/standings?view=year');
    expect(annualWrapStandingsHref('26')).toBe('/dashboard/standings?view=year');
  });
});

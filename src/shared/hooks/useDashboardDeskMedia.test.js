import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_DESK_MEDIA_QUERY,
  DASHBOARD_SHORT_MEDIA_QUERY,
} from './useDashboardDeskMedia.js';

const indexCss = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('dashboard media queries (#707)', () => {
  it('matches the Tailwind desk, mob, and short variants', () => {
    expect(indexCss).toContain(`@custom-variant desk (@media ${DASHBOARD_DESK_MEDIA_QUERY});`);
    expect(indexCss).toContain(`@custom-variant short (@media ${DASHBOARD_SHORT_MEDIA_QUERY});`);
    expect(indexCss).toContain('@custom-variant mob {');
    expect(indexCss).toContain('@media (max-width: 767.98px), (max-height: 479.98px)');
  });
});

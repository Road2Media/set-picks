import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../../tailwind.config.js';
import {
  DASHBOARD_DESK_MEDIA_QUERY,
  DASHBOARD_SHORT_MEDIA_QUERY,
} from './useDashboardDeskMedia.js';

describe('dashboard media queries (#707)', () => {
  it('matches the Tailwind desk and short screens', () => {
    const screens = tailwindConfig.theme.extend.screens;
    expect(screens.desk.raw).toBe(DASHBOARD_DESK_MEDIA_QUERY);
    expect(screens.short.raw).toBe(DASHBOARD_SHORT_MEDIA_QUERY);
  });
});

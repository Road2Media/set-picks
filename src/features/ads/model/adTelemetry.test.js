import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import { trackAdClick, trackAdImpression } from './adTelemetry';

describe('ad telemetry', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('emits one impression payload', () => {
    trackAdImpression({ slotId: 'dashboard_standings_inline', creativeId: 'install_pwa_v1' });
    expect(ga4Event).toHaveBeenCalledWith('ad_impression', {
      slot_id: 'dashboard_standings_inline',
      creative_id: 'install_pwa_v1',
    });
  });

  it('emits a click with the destination type before navigation', () => {
    trackAdClick({
      slotId: 'dashboard_standings_inline',
      creativeId: 'install_pwa_v1',
      destinationType: 'internal',
    });
    trackAdClick({
      slotId: 'dashboard_standings_inline',
      creativeId: 'install_pwa_v1',
      destinationType: 'external',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(1, 'ad_click', {
      slot_id: 'dashboard_standings_inline',
      creative_id: 'install_pwa_v1',
      destination_type: 'internal',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(2, 'ad_click', {
      slot_id: 'dashboard_standings_inline',
      creative_id: 'install_pwa_v1',
      destination_type: 'external',
    });
  });

  it('drops a click with an unknown destination type', () => {
    trackAdClick({
      slotId: 'dashboard_standings_inline',
      creativeId: 'install_pwa_v1',
      destinationType: 'popup',
    });
    expect(ga4Event).not.toHaveBeenCalled();
  });
});

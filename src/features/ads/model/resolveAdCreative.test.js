import { describe, expect, it } from 'vitest';

import { resolveAdCreative } from './resolveAdCreative';

const creative = {
  creative_id: 'install_pwa_v1',
  image_url: 'https://www.setlistpickem.com/branding/splash-vinyl-mark.webp',
  alt_text: 'Mark',
  headline: 'Faster picks on show night',
  cta_label: 'Install',
  destination_url: '/dashboard/profile',
  destination_type: 'internal',
};

describe('resolveAdCreative', () => {
  it('returns nothing unless the kill switch is on', () => {
    expect(
      resolveAdCreative({ adsEnabled: false, rawValue: JSON.stringify(creative) }),
    ).toBeNull();
    expect(resolveAdCreative({ adsEnabled: true, rawValue: '' })).toBeNull();
  });

  it('returns nothing for malformed JSON', () => {
    expect(resolveAdCreative({ adsEnabled: true, rawValue: '{not json' })).toBeNull();
    expect(resolveAdCreative({ adsEnabled: true, rawValue: 'null' })).toBeNull();
  });

  it('returns a creative when the flag is on and the JSON is valid', () => {
    expect(
      resolveAdCreative({ adsEnabled: true, rawValue: JSON.stringify(creative) }),
    ).toMatchObject({
      creative_id: 'install_pwa_v1',
      destination_url: '/dashboard/profile',
    });
  });
});

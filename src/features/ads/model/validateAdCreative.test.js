import { describe, expect, it } from 'vitest';

import { validateAdCreative } from './validateAdCreative';

const valid = {
  creative_id: 'install_pwa_v1',
  image_url: 'https://www.setlistpickem.com/branding/splash-vinyl-mark.webp',
  alt_text: 'Setlist Pick em mark',
  headline: 'Faster picks on show night',
  body: 'Add the app to your home screen.',
  cta_label: 'Install',
  destination_url: '/dashboard/profile/account?openPush=1',
  destination_type: 'internal',
};

describe('validateAdCreative', () => {
  it('accepts a house promo with an allowlisted internal path', () => {
    expect(validateAdCreative(valid)).toMatchObject({
      creative_id: 'install_pwa_v1',
      destination_url: '/dashboard/profile/account?openPush=1',
      destination_type: 'internal',
      headline: 'Faster picks on show night',
    });
  });

  it('accepts an https external destination and an omitted body', () => {
    const rest = { ...valid };
    delete rest.body;
    const creative = validateAdCreative({
      ...rest,
      destination_type: 'external',
      destination_url: 'https://www.setlistpickem.com/how-it-works',
    });
    expect(creative.body).toBe('');
    expect(creative.destination_type).toBe('external');
    expect(creative.destination_url).toBe('https://www.setlistpickem.com/how-it-works');
  });

  it('rejects javascript, data, and http urls', () => {
    expect(validateAdCreative({ ...valid, image_url: 'javascript:alert(1)' })).toBeNull();
    expect(validateAdCreative({ ...valid, image_url: 'data:image/svg+xml,x' })).toBeNull();
    expect(validateAdCreative({ ...valid, image_url: 'http://cdn.example/logo.png' })).toBeNull();
    expect(
      validateAdCreative({
        ...valid,
        destination_type: 'external',
        destination_url: 'javascript:alert(1)',
      }),
    ).toBeNull();
    expect(
      validateAdCreative({
        ...valid,
        destination_type: 'external',
        destination_url: 'http://example.com/promo',
      }),
    ).toBeNull();
  });

  it('rejects protocol-relative and off-allowlist internal paths', () => {
    expect(validateAdCreative({ ...valid, destination_url: '//evil.example' })).toBeNull();
    expect(validateAdCreative({ ...valid, destination_url: '/login' })).toBeNull();
    expect(validateAdCreative({ ...valid, destination_url: '/dashboard/admin' })).toBeNull();
    expect(
      validateAdCreative({ ...valid, destination_url: '/dashboard/profile/../admin' }),
    ).toBeNull();
  });

  it('caps creative_id at 64 characters', () => {
    const sixtyFour = `a${'b'.repeat(63)}`;
    expect(validateAdCreative({ ...valid, creative_id: sixtyFour })?.creative_id).toBe(sixtyFour);
    expect(validateAdCreative({ ...valid, creative_id: `${sixtyFour}c` })).toBeNull();
  });

  it('rejects missing fields, markup, and non-objects', () => {
    const noHeadline = { ...valid };
    delete noHeadline.headline;
    expect(validateAdCreative(noHeadline)).toBeNull();
    expect(validateAdCreative({ ...valid, headline: '<b>Hi</b>' })).toBeNull();
    expect(validateAdCreative(null)).toBeNull();
    expect(validateAdCreative([])).toBeNull();
    expect(validateAdCreative('install_pwa_v1')).toBeNull();
  });
});

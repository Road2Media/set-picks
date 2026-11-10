import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AdCreativeLink from './AdCreativeLink';

const creative = {
  creative_id: 'install_pwa_v1',
  image_url: 'https://www.setlistpickem.com/branding/splash-vinyl-mark.webp',
  alt_text: 'Setlist Pick em mark',
  headline: 'Faster picks on show night',
  body: 'Add the app to your home screen.',
  cta_label: 'Install',
  destination_url: '/dashboard/profile/account?openPush=1',
  destination_type: 'internal',
};

function markup(next) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AdCreativeLink, {
        slotId: 'dashboard_standings_inline',
        creative: next,
      }),
    ),
  );
}

describe('AdCreativeLink', () => {
  it('renders an in-app link with a 56px logo and the headline', () => {
    const html = markup(creative);
    expect(html).toContain('href="/dashboard/profile/account?openPush=1"');
    expect(html).toContain('h-14 w-14');
    expect(html).toContain('Faster picks on show night');
    expect(html).toContain('Install');
    expect(html).toContain('alt="Setlist Pick em mark"');
    expect(html).not.toContain('target="_blank"');
  });

  it('opens an external url in a new tab', () => {
    const html = markup({
      ...creative,
      destination_type: 'external',
      destination_url: 'https://www.setlistpickem.com/how-it-works',
    });
    expect(html).toContain('href="https://www.setlistpickem.com/how-it-works"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

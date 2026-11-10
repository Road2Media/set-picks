import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { MARKETING_NAV_MENU_IDLE } from '../model/marketingNavMenu';
import {
  MarketingFooterNav,
  MarketingHeaderNav,
  MarketingMobileMenu,
} from './MarketingSiteNav';

afterEach(() => {
  vi.unstubAllEnvs();
});

function markup(node) {
  return renderToStaticMarkup(node);
}

function header(pathname, menuState = MARKETING_NAV_MENU_IDLE) {
  return markup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      React.createElement(MarketingHeaderNav, {
        className: 'flex',
        initialMenuState: menuState,
      }),
    ),
  );
}

function mobile(pathname, menuState) {
  return markup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      React.createElement(MarketingMobileMenu, {
        className: 'flex',
        initialMenuState: menuState,
      }),
    ),
  );
}

function footer(pathname, variant = 'primary') {
  return markup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      React.createElement(MarketingFooterNav, { variant }),
    ),
  );
}

describe('marketing header markup (#1232)', () => {
  it('renders four top-level links and carets only on Play and Tour Stats', () => {
    const html = header('/about');
    expect(html.match(/data-marketing-nav-item="/g)).toHaveLength(4);
    expect(html).toContain('>Play<');
    expect(html).toContain('>Phish IQ<');
    expect(html).toContain('>Tour Stats<');
    expect(html).toContain('>About<');
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(2);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Play menu"');
    expect(html).toContain('aria-label="Tour Stats menu"');
    expect(html).not.toContain('aria-label="Phish IQ menu"');
    expect(html).not.toContain('aria-label="About menu"');
    expect(html).toContain('focus-visible:ring-2');
    expect(html).not.toContain('/rewind');
    expect(html).not.toContain('Sign In');
    expect(html).not.toContain('How it works');
    expect(html.toLowerCase()).not.toContain('chair');
    expect(html).toContain('aria-current="page"');
  });

  it('opens the Play menu with children and aria-controls', () => {
    const html = header('/how-scoring-changed', {
      ...MARKETING_NAV_MENU_IDLE,
      desktopOpenId: 'play',
    });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
    expect(html).toContain('href="/how-it-works"');
    expect(html).toContain('href="/how-scoring-works"');
    expect(html).toContain('href="/how-scoring-changed"');
    expect(html).toContain('>How scoring changed<');
    const controls = html.match(/aria-controls="([^"]+)"/);
    expect(controls).not.toBeNull();
    expect(html).toContain(`id="${controls[1]}"`);
    expect(html).toContain('href="/how-scoring-changed"');
    expect(html).toMatch(/how-scoring-changed/);
    const scoring = html.match(/<a[^>]*href="\/how-scoring-changed"[^>]*>/);
    expect(scoring?.[0]).toContain('aria-current="page"');
  });

  it('opens Tour Stats children without promoting Rewind', () => {
    const html = header('/tour-stats', {
      ...MARKETING_NAV_MENU_IDLE,
      desktopOpenId: 'tour-stats',
    });
    expect(html).toContain("New Year&#x27;s Run");
    expect(html).toContain('href="/tour-stats/2026-2027-nye-run"');
    expect(html).toContain('href="/phish-at-msg"');
    expect(html).toContain('>Annual 2026<');
    expect(html).toContain('href="/tour-stats/2026"');
    expect(html).toContain('>All tours<');
    expect(html).not.toContain('/rewind');
  });
});

describe('marketing mobile menu markup (#1232)', () => {
  it('stays closed until the hamburger opens the same hubs', () => {
    const closed = mobile('/');
    expect(closed).toContain('aria-label="Open menu"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('>Play<');

    const open = mobile('/phish-iq', {
      ...MARKETING_NAV_MENU_IDLE,
      mobileOpen: true,
      mobileDisclosureIds: ['tour-stats'],
    });
    expect(open).toContain('aria-label="Close menu"');
    expect(open).toContain('aria-expanded="true"');
    expect(open.match(/data-marketing-nav-item="/g)).toHaveLength(4);
    expect(open).toContain('class="block py-2 pl-8 pr-4');
    expect(open).toContain('href="/phish-at-msg"');
    expect(open).not.toContain('href="/how-it-works"');
    expect(open).not.toContain('/rewind');
    expect(open.toLowerCase()).not.toContain('chair');
  });
});

describe('marketing footer nav markup (#1232)', () => {
  it('lists every hub and child in the primary footer', () => {
    const html = footer('/how-it-works');
    for (const href of [
      '/phish-setlist-prediction-game',
      '/how-it-works',
      '/how-scoring-works',
      '/how-scoring-changed',
      '/phish-iq',
      '/tour-stats',
      '/tour-stats/2026-2027-nye-run',
      '/phish-at-msg',
      '/tour-stats/2026',
      '/about',
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('/rewind');
    expect(html).not.toContain('Privacy Policy');
    expect(html.toLowerCase()).not.toContain('chair');
  });

  it('adds Rewind in the footer only when the flag is on', () => {
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', 'true');
    const html = footer('/');
    expect(html).toContain('href="/rewind"');
    expect(html).toContain('>Rewind<');
  });

  it('keeps legal links on their own row', () => {
    const html = footer('/', 'legal');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain('>Play<');
    expect(html).not.toContain('/rewind');
  });
});

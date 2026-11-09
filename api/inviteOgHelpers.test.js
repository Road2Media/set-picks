import { describe, expect, it } from 'vitest';

import {
  buildInvitePageUrl,
  buildPoolInviteShareTitle,
  buildPoolInviteShareTitleFromInviter,
  buildSiteInviteShareTitle,
  CRAWLER_RE,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  POOL_INVITE_FROM_DESCRIPTION,
  POOL_INVITE_GENERIC_DESCRIPTION,
  resolveInviteOgContent,
  SITE_INVITE_DESCRIPTION,
  injectOgIntoSpa,
  resolveInviteBootKind,
  selectInviteBootPreloadHrefs,
  stripPrerenderBodyFromSpaShell,
} from './inviteOgHelpers.mjs';

describe('inviteOgHelpers', () => {
  it('detects social crawlers without matching Instagram in-app browser', () => {
    expect(CRAWLER_RE.test('facebookexternalhit/1.1')).toBe(true);
    expect(CRAWLER_RE.test('Twitterbot/1.0')).toBe(true);
    expect(CRAWLER_RE.test('Instagram 219.0.0.12.117 Android')).toBe(false);
  });

  it('builds invite page URLs', () => {
    expect(buildInvitePageUrl({ handle: 'Mikey' })).toBe(
      'https://www.setlistpickem.com/invite/Mikey',
    );
    expect(buildInvitePageUrl({ code: 'yem42' })).toBe(
      'https://www.setlistpickem.com/join/YEM42',
    );
    expect(buildInvitePageUrl({ code: 'YEM42', from: 'Mikey' })).toBe(
      'https://www.setlistpickem.com/join/YEM42?from=Mikey',
    );
  });

  it('resolves site invite OG for browsers (static handle)', () => {
    expect(
      resolveInviteOgContent({ handle: 'Mikey' }),
    ).toEqual({
      title: buildSiteInviteShareTitle('Mikey'),
      description: SITE_INVITE_DESCRIPTION,
    });
  });

  it('falls back to generic site OG when crawler profile lookup fails', () => {
    expect(
      resolveInviteOgContent({ handle: 'unknown', siteProfileFound: false }),
    ).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
    });
  });

  it('resolves pool invite OG with from= and optional pool name', () => {
    expect(
      resolveInviteOgContent({ code: 'YEM42', from: 'Mikey', poolName: 'Denver Crew' }),
    ).toEqual({
      title: buildPoolInviteShareTitleFromInviter('Mikey', 'Denver Crew'),
      description: POOL_INVITE_FROM_DESCRIPTION,
    });

    expect(
      resolveInviteOgContent({ code: 'YEM42', from: 'Mikey' }),
    ).toEqual({
      title: buildPoolInviteShareTitleFromInviter('Mikey'),
      description: POOL_INVITE_FROM_DESCRIPTION,
    });
  });

  it('resolves pool invite OG without from= using legacy pool copy', () => {
    expect(
      resolveInviteOgContent({ code: 'YEM42', poolName: 'Denver Crew' }),
    ).toEqual({
      title: buildPoolInviteShareTitle('Denver Crew'),
      description:
        "Join my Setlist Pick 'Em pool — Denver Crew. Pick openers, closers, and more before each show.",
    });

    expect(resolveInviteOgContent({ code: 'YEM42' })).toEqual({
      title: buildPoolInviteShareTitle(),
      description: POOL_INVITE_GENERIC_DESCRIPTION,
    });
  });

  it('strips SEO prerender body from SPA shell before invite boot', () => {
    const shell = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><div id="root"><!--seo-prerender:/-->
  <main data-seo-prerender="true"><h1>About Setlist Pick'Em</h1></main></div></body></html>`;
    expect(stripPrerenderBodyFromSpaShell(shell)).toBe(
      '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><div id="root"></div></body></html>',
    );
    const injected = injectOgIntoSpa(shell, {
      title: 'Pool invite',
      description: 'Join the pool',
      url: 'https://www.setlistpickem.com/join/YEM42',
      image: 'https://www.setlistpickem.com/branding/og-card-1200x630.jpg',
    });
    expect(injected).toContain('<div id="root"></div>');
    expect(injected).not.toContain('About Setlist Pick');
    expect(injected).toContain('property="og:title"');
  });
});

describe('invite boot preload selection', () => {
  const manifest = {
    pool: ['/assets/PoolInvitePage-aaaaaaaa.js', 'not a url', 'https://evil.example/x.js'],
    site: ['/assets/InviteLandingPage-bbbbbbbb.js'],
  };

  it('selects pool vs site from the request', () => {
    expect(resolveInviteBootKind({ code: 'YEM42' })).toBe('pool');
    expect(resolveInviteBootKind({ handle: 'Mikey' })).toBe('site');
    expect(resolveInviteBootKind({ code: 'YEM42', handle: 'Mikey' })).toBe('pool');
    expect(resolveInviteBootKind({})).toBeNull();
  });

  it('returns only hashed asset hrefs for the matching kind', () => {
    expect(selectInviteBootPreloadHrefs(manifest, { code: 'yem42' })).toEqual([
      '/assets/PoolInvitePage-aaaaaaaa.js',
    ]);
    expect(selectInviteBootPreloadHrefs(manifest, { handle: '@Mikey' })).toEqual([
      '/assets/InviteLandingPage-bbbbbbbb.js',
    ]);
    expect(selectInviteBootPreloadHrefs(null, { code: 'YEM42' })).toEqual([]);
    expect(selectInviteBootPreloadHrefs(manifest, {})).toEqual([]);
  });
});

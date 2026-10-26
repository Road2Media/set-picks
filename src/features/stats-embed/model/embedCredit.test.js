import { describe, expect, it } from 'vitest';

import { buildEmbedCreditUrl, buildStatsEmbedSnippet } from './embedCredit';

describe('buildEmbedCreditUrl', () => {
  it('is a normal https link with the embed campaign', () => {
    const href = buildEmbedCreditUrl();
    const url = new URL(href);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('www.setlistpickem.com');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('utm_source')).toBe('embed');
    expect(url.searchParams.get('utm_campaign')).toBe('seo_geo');
    expect(href.startsWith('javascript:')).toBe(false);
    expect(href.includes('nofollow')).toBe(false);
  });
});

describe('buildStatsEmbedSnippet', () => {
  it('returns an iframe a plain HTML page can host', () => {
    const snippet = buildStatsEmbedSnippet({ tourSlug: '2026-fall-tour' });
    expect(snippet.startsWith('<iframe ')).toBe(true);
    expect(snippet).toContain('src="https://www.setlistpickem.com/embed/stats?tour=2026-fall-tour"');
    expect(snippet).toContain('title="Setlist Pick \'Em standings"');
    expect(snippet).not.toContain('sandbox');
    expect(snippet).not.toContain('nofollow');
  });

  it('can request the no-data badge card', () => {
    const snippet = buildStatsEmbedSnippet({ card: 'badge' });
    const src = snippet.match(/src="([^"]+)"/)?.[1] || '';
    const url = new URL(src);
    expect(url.pathname).toBe('/embed/stats');
    expect(url.searchParams.get('card')).toBe('badge');
    expect(url.searchParams.get('tour')).toBeNull();
  });

  it('does not put a rejected slug into the snippet', () => {
    const snippet = buildStatsEmbedSnippet({
      tourSlug: '"><script>alert(1)</script>',
    });
    expect(snippet).not.toContain('<script>');
    expect(snippet).not.toContain('alert');
  });
});

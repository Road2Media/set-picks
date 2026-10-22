import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildEmbedCardModel } from '../model/projectEmbedCard';
import StatsEmbedCard from './StatsEmbedCard';

function renderCard(model) {
  return renderToStaticMarkup(React.createElement(StatsEmbedCard, { model }));
}

describe('StatsEmbedCard', () => {
  it('renders a followable credit link and no song stats', () => {
    const model = buildEmbedCardModel({
      doc: {
        tourLabel: '2026 Fall Tour',
        tourWinners: { handles: ['Ada'], points: 128 },
        topSongs: [{ title: 'SENTINEL_SONG', timesPlayed: 424242 }],
        bustouts: [{ title: 'SENTINEL_BUSTOUT', gap: 515151 }],
      },
    });
    const html = renderCard(model);
    const href = html.match(/href="([^"]+)"/)?.[1] || '';
    const url = new URL(href.replace(/&amp;/g, '&'));
    expect(html).toContain('<a ');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('nofollow');
    expect(url.searchParams.get('utm_source')).toBe('embed');
    expect(url.searchParams.get('utm_campaign')).toBe('seo_geo');
    expect(html).toContain('Ada leads with 128 points.');
    expect(html).not.toContain('SENTINEL_SONG');
    expect(html).not.toContain('SENTINEL_BUSTOUT');
    expect(html).not.toContain('424242');
    expect(html).not.toContain('515151');
  });

  it('escapes a handle so it cannot become markup', () => {
    const model = buildEmbedCardModel({
      doc: {
        tourLabel: '2026 Fall Tour',
        tourWinners: { handles: ['<img src=x onerror=alert(1)>'], points: 4 },
      },
    });
    const html = renderCard(model);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

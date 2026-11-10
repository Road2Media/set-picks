import { describe, expect, it } from 'vitest';

import { getPrerenderRoute } from '../../../shared/config/seoRoutes.js';
import { buildFixtureShellHtml, injectPrerenderHtml } from '../../../../scripts/seo-prerender-lib.mjs';
import {
  buildCatalogQuiz,
  buildTodaysCatalogQuiz,
} from '../../../../scripts/lib/phishIqCrawlQuiz.mjs';
import { phishIqJsonLdErrors, quizLeaksInText } from './phishIqCrawl.js';

function crawlHtml() {
  const route = getPrerenderRoute('/phish-iq');
  return injectPrerenderHtml(buildFixtureShellHtml(), route);
}

describe('Phish IQ crawl document (#1276)', () => {
  const html = crawlHtml();
  const route = getPrerenderRoute('/phish-iq');

  it('prerenders the intro, FAQ, canonical, and share card', () => {
    expect(route).toBeTruthy();
    expect(html).toContain('<h1>A free daily Phish quiz</h1>');
    expect(html).toContain('a new quiz every day');
    expect(html).toContain('no sign-in');
    expect(html).toContain('data-seo-phish-iq="faq"');
    expect(html).toContain('What is Phish IQ?');
    expect(html).toContain('How often is there a new quiz?');
    expect(html).toContain('Where do the questions come from?');
    expect(html).toContain('href="https://phish.net"');
    expect(html).toContain(`<link rel="canonical" href="${route.canonicalUrl}" />`);
    expect(html).toContain('property="og:image" content="https://www.setlistpickem.com/branding/phish-iq-og.jpg?v=20261110"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:image"');
    expect(html.toLowerCase()).not.toContain('chair');
    expect(html).not.toContain('—');
  });

  it('publishes Quiz, WebApplication, and FAQPage JSON-LD', () => {
    const match = html.match(
      /<script type="application\/ld\+json" data-seo-prerender="true">([\s\S]*?)<\/script>/,
    );
    expect(match).toBeTruthy();
    const jsonLd = JSON.parse(match[1]);
    expect(phishIqJsonLdErrors(jsonLd)).toEqual([]);
  });

  it('keeps today and another day out of the crawlable HTML', () => {
    for (const quiz of [buildTodaysCatalogQuiz(new Date()), buildCatalogQuiz('2026-07-04')]) {
      expect(quiz.questions.length).toBeGreaterThan(0);
      expect(quizLeaksInText(html, quiz)).toEqual([]);
    }
  });
});

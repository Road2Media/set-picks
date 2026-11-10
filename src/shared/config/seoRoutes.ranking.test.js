import { describe, expect, it } from 'vitest';

import { RANK_TIE_EXPLANATION } from './dashboardVocabulary.js';
import { PRERENDER_ROUTES } from './seoRoutes.js';

function faqAnswer(route, question) {
  const faq = route.buildJsonLd()['@graph'].find((node) => node['@type'] === 'FAQPage');
  const entry = faq.mainEntity.find((item) => item.name === question);
  return entry?.acceptedAnswer?.text;
}

describe('seo ranking copy', () => {
  it('publishes the live cascade on the scoring pages', () => {
    const scoring = PRERENDER_ROUTES.find((route) => route.path === '/how-scoring-works');
    const changed = PRERENDER_ROUTES.find((route) => route.path === '/how-scoring-changed');
    expect(scoring.paragraphs).toContain(RANK_TIE_EXPLANATION);
    expect(changed.paragraphs).toContain(RANK_TIE_EXPLANATION);
    expect(faqAnswer(scoring, 'How are ties ranked?')).toBe(RANK_TIE_EXPLANATION);
    expect(faqAnswer(changed, 'How are ties ranked?')).toBe(RANK_TIE_EXPLANATION);
    expect(RANK_TIE_EXPLANATION).toMatch(/does not use nightly wins/);
    expect(RANK_TIE_EXPLANATION.toLowerCase()).not.toContain('chair');
  });
});

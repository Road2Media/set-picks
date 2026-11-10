/**
 * Crawl-leak checks for Phish IQ (#1276).
 * The prerendered page is evergreen copy. Today's prompts, choices, and
 * fact sentences must not show up in that HTML, its meta tags, or JSON-LD.
 * Quiz building stays in `scripts/lib/phishIqCrawlQuiz.mjs` so this file
 * does not import another feature.
 */

/**
 * @param {string} haystack
 * @param {string} needle
 */
function containsNeedle(haystack, needle) {
  const value = String(needle || '').trim();
  if (value.length < 2) return false;
  if (value.length >= 12) return haystack.includes(value);
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`).test(haystack);
}

/**
 * Prompts, fact sentences, and choice labels from one quiz.
 * Short labels use a word boundary so a lone digit does not match inside a longer number.
 *
 * @param {{ questions?: { prompt?: string, fact?: string, choices?: { label?: string }[] }[] } | null} quiz
 * @returns {string[]}
 */
export function quizLeakNeedles(quiz) {
  /** @type {string[]} */
  const needles = [];
  for (const question of quiz?.questions || []) {
    if (question?.prompt) needles.push(question.prompt);
    if (question?.fact) needles.push(question.fact);
    for (const choice of question?.choices || []) {
      const label = String(choice?.label || '').trim();
      if (label) needles.push(label);
    }
  }
  return needles;
}

/**
 * @param {string} text
 * @param {{ questions?: { prompt?: string, fact?: string, choices?: { label?: string }[] }[] } | null} quiz
 * @returns {string[]} needles that appear in the text
 */
export function quizLeaksInText(text, quiz) {
  const haystack = String(text || '');
  return quizLeakNeedles(quiz).filter((needle) => containsNeedle(haystack, needle));
}

/**
 * Shape check for the Phish IQ JSON-LD graph. No question payload.
 *
 * @param {unknown} jsonLd
 * @returns {string[]}
 */
export function phishIqJsonLdErrors(jsonLd) {
  const errors = [];
  const doc = /** @type {{ '@context'?: string, '@graph'?: unknown[] }} */ (jsonLd || {});
  if (doc['@context'] !== 'https://schema.org') errors.push('context');
  const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : null;
  if (!graph) {
    errors.push('graph');
    return errors;
  }
  const quiz = graph.find((node) => {
    const record = /** @type {{ '@type'?: string | string[] }} */ (node);
    const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
    return types.includes('Quiz') && types.includes('WebApplication');
  });
  if (!quiz) {
    errors.push('quiz type');
  } else {
    const record = /** @type {Record<string, unknown>} */ (quiz);
    if (record.name !== 'Phish IQ') errors.push('name');
    if (typeof record.url !== 'string' || !record.url.endsWith('/phish-iq')) errors.push('url');
    const offers = /** @type {{ price?: string, priceCurrency?: string }} */ (record.offers || {});
    if (offers.price !== '0' || offers.priceCurrency !== 'USD') errors.push('offer');
    if (record.isAccessibleForFree !== true) errors.push('free');
    if (record.applicationCategory !== 'GameApplication') errors.push('category');
    if (record.hasPart) errors.push('hasPart');
  }
  const faq = graph.find((node) => {
    const record = /** @type {{ '@type'?: string }} */ (node);
    return record['@type'] === 'FAQPage';
  });
  const mainEntity = faq
    ? /** @type {{ mainEntity?: unknown[] }} */ (faq).mainEntity
    : null;
  if (!Array.isArray(mainEntity) || mainEntity.length < 3) {
    errors.push('faq');
    return errors;
  }
  for (const item of mainEntity) {
    const question = /** @type {{ '@type'?: string, name?: string, acceptedAnswer?: { '@type'?: string, text?: string } }} */ (
      item
    );
    if (question['@type'] !== 'Question' || !question.name) errors.push('question');
    const answer = question.acceptedAnswer;
    if (answer?.['@type'] !== 'Answer' || !answer.text) errors.push('answer');
  }
  return errors;
}

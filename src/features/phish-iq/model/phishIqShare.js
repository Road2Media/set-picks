/**
 * Spoiler-free Phish IQ share text (#1143).
 * Score and a hit/miss grid only. No song titles, years, or which question
 * was which.
 */

export const PHISH_IQ_ATTRIBUTION = 'Data courtesy of Phish.net.';
export const PHISH_IQ_SOURCE_URL = 'https://phish.net';
export const PHISH_IQ_SHARE_ORIGIN = 'https://www.setlistpickem.com';

/**
 * @param {string} [origin]
 * @returns {string}
 */
export function phishIqShareUrl(origin = PHISH_IQ_SHARE_ORIGIN) {
  const base = typeof origin === 'string' && origin.trim() ? origin.trim() : PHISH_IQ_SHARE_ORIGIN;
  const url = new URL('/phish-iq', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'seo_geo');
  url.searchParams.set('utm_content', 'phish-iq');
  return url.toString();
}

/**
 * @param {{
 *   score?: number,
 *   total?: number,
 *   marks?: boolean[],
 *   streak?: number | null,
 *   origin?: string,
 * }} args
 */
export function buildPhishIqShareText(args) {
  const score = Number(args?.score) || 0;
  const total = Number(args?.total) || 0;
  const marks = Array.isArray(args?.marks) ? args.marks : [];
  const grid = marks.map((hit) => (hit ? '🟩' : '⬛')).join('');
  const lines = ['Phish IQ', `${score}/${total}`];
  if (typeof args?.streak === 'number' && args.streak > 0) {
    lines.push(`Streak ${args.streak}`);
  }
  if (grid) lines.push('', grid);
  lines.push(
    '',
    PHISH_IQ_ATTRIBUTION,
    PHISH_IQ_SOURCE_URL,
    `Play today → ${phishIqShareUrl(args?.origin)}`,
  );
  return lines.join('\n');
}

/**
 * Share text must not repeat a question prompt or a choice label.
 *
 * @param {string} text
 * @param {{ prompt: string, choices: { label: string }[] }[]} questions
 */
export function shareTextOmitsAnswers(text, questions) {
  const haystack = String(text || '');
  for (const question of questions || []) {
    if (question?.prompt && haystack.includes(question.prompt)) return false;
    for (const choice of question?.choices || []) {
      const label = String(choice?.label || '').trim();
      if (label.length >= 2 && haystack.includes(label)) return false;
    }
  }
  return true;
}

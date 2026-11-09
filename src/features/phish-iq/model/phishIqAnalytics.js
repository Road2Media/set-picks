import { ga4Event } from '../../../shared/lib/ga4';

/**
 * Quiz opened to the first question. No song titles.
 *
 * @param {{ quiz_date?: string }} [args]
 */
export function trackPhishIqStart({ quiz_date } = {}) {
  ga4Event('phish_iq_start', { quiz_date: quiz_date || '' });
}

/**
 * @param {{ quiz_date?: string, score?: number }} [args]
 */
export function trackPhishIqFinish({ quiz_date, score } = {}) {
  ga4Event('phish_iq_finish', {
    quiz_date: quiz_date || '',
    score: Number(score) || 0,
  });
}

/**
 * @param {{ quiz_date?: string, score?: number }} [args]
 */
export function trackPhishIqShare({ quiz_date, score } = {}) {
  ga4Event('phish_iq_share', {
    quiz_date: quiz_date || '',
    score: Number(score) || 0,
  });
}

/**
 * Sign-up CTA from the quiz that came back as a new account.
 *
 * @param {{ quiz_date?: string }} [args]
 */
export function trackPhishIqSignUp({ quiz_date } = {}) {
  ga4Event('phish_iq_sign_up', { quiz_date: quiz_date || '' });
}

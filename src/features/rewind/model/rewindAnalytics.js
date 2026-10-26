import { ga4Event } from '../../../shared/lib/ga4';

/** Player opened the Rewind card for a week. */
export function trackRewindStart({ week_id, show_date } = {}) {
  ga4Event('rewind_start', {
    week_id: week_id ?? '',
    show_date: show_date ?? '',
  });
}

/** Player locked a Rewind card. Score only — no song titles. */
export function trackRewindLock({ week_id, show_date, score } = {}) {
  ga4Event('rewind_lock', {
    week_id: week_id ?? '',
    show_date: show_date ?? '',
    score: Number(score) || 0,
  });
}

/** Player shared a Rewind result. */
export function trackRewindShare({ week_id } = {}) {
  ga4Event('rewind_share', {
    week_id: week_id ?? '',
  });
}

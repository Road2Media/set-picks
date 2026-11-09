import { ga4Event } from '../../../shared/lib/ga4';

/**
 * Crowd pulse card is shown on Standings (#694).
 *
 * @param {{
 *   show_date?: string,
 *   deep_stats?: 'locked' | 'open',
 *   pickers?: number,
 *   surface?: 'standings' | 'stats_night',
 * }} [payload]
 */
export function trackCrowdPulseView({
  show_date,
  deep_stats,
  pickers,
  surface,
} = {}) {
  ga4Event('crowd_pulse_view', {
    show_date: show_date ?? '',
    deep_stats: deep_stats === 'locked' ? 'locked' : 'open',
    pickers: typeof pickers === 'number' && Number.isFinite(pickers) ? pickers : 0,
    surface: surface === 'stats_night' ? 'stats_night' : 'standings',
  });
}

/**
 * User expands “Full crowd stats” disclosure.
 *
 * @param {{ show_date?: string }} [payload]
 */
export function trackCrowdPulseFullExpand({ show_date } = {}) {
  ga4Event('crowd_pulse_full_expand', {
    show_date: show_date ?? '',
  });
}

/**
 * User opens one of the deep-stat section cards.
 *
 * @param {{
 *   show_date?: string,
 *   section?: 'multi_picker' | 'highest_gaps' | 'vintage' | 'leaders' | string,
 * }} [payload]
 */
export function trackCrowdPulseSectionOpen({ show_date, section } = {}) {
  ga4Event('crowd_pulse_section_open', {
    show_date: show_date ?? '',
    section: section ?? '',
  });
}

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
 * @param {string | undefined} deep_stats
 * @returns {'locked' | 'open'}
 */
function deepStatsParam(deep_stats) {
  return deep_stats === 'locked' ? 'locked' : 'open';
}

/**
 * Standings teaser opened, or a pre-lock click through to full stats.
 * Compare `crowd_pulse_teaser_expand` with post-lock `crowd_pulse_full_expand`.
 *
 * @param {{
 *   show_date?: string,
 *   deep_stats?: 'locked' | 'open',
 *   via?: 'summary' | 'full_link',
 * }} [payload]
 */
export function trackCrowdPulseTeaserExpand({
  show_date,
  deep_stats,
  via,
} = {}) {
  ga4Event('crowd_pulse_teaser_expand', {
    show_date: show_date ?? '',
    deep_stats: deepStatsParam(deep_stats),
    via: via === 'full_link' ? 'full_link' : 'summary',
  });
}

/**
 * Post-lock open of full crowd stats. `deep_stats` defaults to `open`.
 *
 * @param {{ show_date?: string, deep_stats?: 'locked' | 'open' }} [payload]
 */
export function trackCrowdPulseFullExpand({ show_date, deep_stats } = {}) {
  ga4Event('crowd_pulse_full_expand', {
    show_date: show_date ?? '',
    deep_stats: deepStatsParam(deep_stats),
  });
}

/**
 * Make Picks helper placed a tour-chalk song in the first open slot.
 * The card is not saved until Lock In Picks.
 *
 * @param {{ show_date?: string }} [payload]
 */
export function trackCrowdPulseHelperUse({ show_date } = {}) {
  ga4Event('crowd_pulse_helper_use', {
    show_date: show_date ?? '',
    action: 'use',
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

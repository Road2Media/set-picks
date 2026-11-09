/**
 * Announced New Year's Run 2026-2027 (#1144).
 *
 * The first night is the scoring-ladder date. The last night is the Garden's
 * 100th performance. Show rows come from the committed MSG snapshot, which
 * already lists these nights. This file does not keep a second calendar.
 */
import { MSG_GARDEN_HUNDREDTH_DATE } from './aggregateMsgGardenStats.js';
import {
  SCORING_LADDER_V2_EFFECTIVE_DATE,
  SCORING_LADDER_V2_TOUR_NAME,
} from '../../../shared/utils/scoring.js';

export const NYE_RUN_SLUG = '2026-2027-nye-run';
export const NYE_RUN_PATH = `/tour-stats/${NYE_RUN_SLUG}`;
export const NYE_RUN_LABEL = SCORING_LADDER_V2_TOUR_NAME;
export const NYE_RUN_START = SCORING_LADDER_V2_EFFECTIVE_DATE;
export const NYE_RUN_END = MSG_GARDEN_HUNDREDTH_DATE;

/** Official announcement. Event `url` points here, not at a setlist. */
export const NYE_RUN_PHISH_URL = 'https://phish.com/news/phish-100-at-the-garden';

/** Suggested name on the create-pool form. */
export const NYE_POOL_NAME = 'NYE Run';

/**
 * Signed-out visitors hit `/login` and return here (`persistDashboardPath`).
 * UTM matches the public tour-stats share campaign.
 */
export function nyePoolCreateHref() {
  const params = new URLSearchParams({
    name: NYE_POOL_NAME,
    utm_source: 'tour-stats',
    utm_medium: 'cta',
    utm_campaign: 'seo_geo',
    utm_content: 'nye-pool',
  });
  return `/dashboard/pools/create?${params.toString()}`;
}

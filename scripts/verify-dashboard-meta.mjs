#!/usr/bin/env node
/**
 * Guardrail: `getDashboardPageMeta` must match product IA (context title, headings, date picker).
 * Run: `npm run verify:dashboard-meta`
 */

import {
  getDashboardPageMeta,
  normalizeDashboardPathname,
} from '../src/app/layout/model/dashboardPageMeta.js';
import {
  NAV_LABEL_ACCOUNT,
  NAV_LABEL_MESSAGES,
  NAV_LABEL_PICKS,
  NAV_LABEL_POOL_DETAILS,
  NAV_LABEL_POOLS,
  NAV_LABEL_PREFERENCES,
  NAV_LABEL_STANDINGS,
  NAV_LABEL_STATS,
  POOL_DETAILS_LAYOUT_EYEBROW,
} from '../src/shared/config/dashboardVocabulary.js';

const CASES = [
  {
    path: '/dashboard',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #766: Make Picks alias — same cluster meta as /dashboard.
    path: '/dashboard/picks',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #766: Picks Lab — primary Picks tab + date picker stay on.
    path: '/dashboard/picks/lab',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #766 / #767: Scorecard — primary Picks tab + date picker stay on.
    path: '/dashboard/picks/scorecard',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #1142: Rewind stays on the Picks tab. The live date picker is the wrong control.
    path: '/dashboard/rewind',
    expect: {
      contextTitle: NAV_LABEL_PICKS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/standings',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/standings',
    search: '?view=show',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/standings',
    search: '?view=pools&pool=abc',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #255: Tour view is cumulative; global date picker hidden for clarity.
    path: '/dashboard/standings',
    search: '?view=tour',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: true,
      showTourScopePicker: true,
      isStandingsYearView: false,
      showYearScopePicker: false,
    },
  },
  {
    // #1110: Year view is cumulative. Hide the date picker; show the year picker.
    path: '/dashboard/standings',
    search: '?view=year',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: false,
      isStandingsYearView: true,
      showYearScopePicker: true,
    },
  },
  {
    // #1110: `?year=` remembers the calendar year and does not bring the date picker back.
    path: '/dashboard/standings',
    search: '?view=year&year=2026',
    expect: {
      contextTitle: NAV_LABEL_STANDINGS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: false,
      isStandingsYearView: true,
      showYearScopePicker: true,
    },
  },
  {
    // #1004: legacy hop — Stats primary stays active; tour picker; redirects to Band.
    path: '/dashboard/tour-stats',
    expect: {
      contextTitle: NAV_LABEL_STATS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: true,
    },
  },
  {
    // #1004: Personal Stats — tour picker scopes the rollup only; no date picker.
    path: '/dashboard/stats',
    expect: {
      contextTitle: NAV_LABEL_STATS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: true,
    },
  },
  {
    path: '/dashboard/stats/personal',
    expect: {
      contextTitle: NAV_LABEL_STATS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: true,
    },
  },
  {
    // #1004: Global Stats — tour picker stays (Phase 2 boards may be tour-scoped).
    path: '/dashboard/stats/global',
    expect: {
      contextTitle: NAV_LABEL_STATS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: true,
    },
  },
  {
    path: '/dashboard/stats/band',
    expect: {
      contextTitle: NAV_LABEL_STATS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
      isStandingsTourView: false,
      showTourScopePicker: true,
    },
  },
  {
    path: '/dashboard/pools',
    expect: {
      contextTitle: NAV_LABEL_POOLS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #768: Create Pool tertiary — same Pools context as My Pools.
    path: '/dashboard/pools/create',
    expect: {
      contextTitle: NAV_LABEL_POOLS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    // #768: Join Pool tertiary — same Pools context as My Pools.
    path: '/dashboard/pools/join',
    expect: {
      contextTitle: NAV_LABEL_POOLS,
      showDatePicker: true,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/pool/test-pool-id',
    expect: {
      contextTitle: NAV_LABEL_POOL_DETAILS,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: false,
      layoutDetailEyebrow: POOL_DETAILS_LAYOUT_EYEBROW,
    },
  },
  {
    path: '/dashboard/profile',
    expect: {
      contextTitle: NAV_LABEL_ACCOUNT,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/profile/notifications',
    expect: {
      contextTitle: NAV_LABEL_MESSAGES,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/profile/account',
    expect: {
      contextTitle: NAV_LABEL_PREFERENCES,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  // Legacy paths (SPA redirects) — meta must still hide date picker.
  {
    path: '/dashboard/account-security',
    expect: {
      contextTitle: NAV_LABEL_PREFERENCES,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/notifications',
    expect: {
      contextTitle: NAV_LABEL_MESSAGES,
      showDatePicker: false,
      layoutDesktopHeading: null,
      ownsDesktopStickyChrome: true,
      layoutDetailEyebrow: null,
    },
  },
  {
    path: '/dashboard/admin',
    expect: {
      contextTitle: 'War Room',
      showDatePicker: true,
      layoutDesktopHeading: 'War Room',
      ownsDesktopStickyChrome: false,
      layoutDetailEyebrow: null,
      desktopHeadingTone: 'warRoom',
    },
  },
];

let failed = false;

for (const { path, search, expect: exp } of CASES) {
  const meta = getDashboardPageMeta(path, search);
  const normalized = normalizeDashboardPathname(path);
  const label = search ? `${path}${search}` : path;
  for (const key of Object.keys(exp)) {
    if (meta[key] !== exp[key]) {
      console.error(
        `[verify-dashboard-meta] ${label} (normalized: ${normalized}) — ${key}: got ${JSON.stringify(meta[key])}, expected ${JSON.stringify(exp[key])}`,
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`verify-dashboard-meta: ${CASES.length} cases OK`);

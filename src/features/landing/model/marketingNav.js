import {
  PUBLIC_SUPPORT_LABEL,
  PUBLIC_SUPPORT_MAILTO,
} from '../../../shared/config/supportContact';

/**
 * Public marketing routes for header/footer internal linking (#663).
 * Keep in sync with `App.jsx` public routes + `seoRoutes` prerender list.
 */

/** Educational / product pages (not legal). */
export const MARKETING_PRIMARY_NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/how-scoring-works', label: 'Scoring' },
  { to: '/tour-stats', label: 'Tour stats' },
  { to: '/phish-at-msg', label: 'Phish at MSG' },
  { to: '/phish-setlist-prediction-game', label: 'The game' },
  { to: '/about', label: 'About' },
];

/**
 * Legal links — footer only.
 * `hard: true` → `<a href>` so hosting serves the zero-JS legal door (#916).
 */
export const MARKETING_LEGAL_NAV = [
  { to: '/privacy', label: 'Privacy Policy', hard: true },
  { to: '/terms', label: 'Terms of Service', hard: true },
  { to: PUBLIC_SUPPORT_MAILTO, label: PUBLIC_SUPPORT_LABEL, hard: true },
];

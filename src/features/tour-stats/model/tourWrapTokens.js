/**
 * Finished-tour wrap colors (#1193).
 *
 * The on-page card and the 1200×630 share SVG both read these values.
 * A hex change here lands in both, so the card cannot drift from the preview.
 */

export const TOUR_WRAP_COLORS = {
  canvas: '#020617',
  panel: '#0f172a',
  accent: '#2dd4bf',
  accentBorder: 'rgba(45, 212, 191, 0.45)',
  statLabel: '#e2e8f0',
  detail: '#f8fafc',
  muted: '#94a3b8',
};

/** Headline counts, same order as the share image. */
export const TOUR_WRAP_STAT_LABELS = [
  'Shows',
  'Unique songs',
  'Songs played',
  'Bustouts',
];

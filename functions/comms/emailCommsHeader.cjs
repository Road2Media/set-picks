'use strict';

const { fanDateBadge } = require('../fanShowDate.cjs');

/**
 * In-app style email header (eyebrow + icon + title) — mirrors
 * `CommsTemplateBody` / `commsTemplateRegistry` without Lucide (email-safe emoji).
 *
 * Only templates that actually send **email** are listed (catalog channels).
 * Push/inApp-only triggers (score_*, show_recap, picks_confirmed) have no header here.
 */

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** Accents aligned with in-app Tailwind tokens (readable on white email cards). */
const ACCENT_TEAL = '#0d9488';
const ACCENT_AMBER = '#d97706';

/**
 * Email-channel templates only (see `docs/comms-triggers/catalog.json` channels).
 *
 * @param {string} templateId
 * @param {Record<string, unknown>} [p]
 * @returns {{ icon: string, eyebrow: string, title: string, accentColor: string } | null}
 */
function resolveCommsEmailHeader(templateId, p = {}) {
  const handle =
    typeof p.handle === 'string' && p.handle.trim() ? p.handle.trim() : 'Picker';

  switch (templateId) {
    case 'account-welcome':
      return {
        icon: '🎉',
        eyebrow: 'Welcome aboard',
        title: `Welcome to Setlist Pick'em, ${handle}`,
        accentColor: ACCENT_TEAL,
      };
    case 'tour-countdown': {
      const days = Number(p.days_remaining);
      const dayLabel = Number.isFinite(days)
        ? days === 0
          ? 'today'
          : days === 1
            ? 'tomorrow'
            : `in ${days} days`
        : 'soon';
      const tourName =
        typeof p.tour_name === 'string' && p.tour_name.trim()
          ? p.tour_name.trim()
          : '';
      return {
        icon: '📅',
        eyebrow: `Tour starts ${dayLabel}`,
        title: tourName ? `${tourName} is almost here` : 'The next tour is almost here',
        accentColor: ACCENT_AMBER,
      };
    }
    case 'tour-rankings-daily': {
      const dateBadge = fanDateBadge(p.show_date);
      return {
        icon: '📈',
        eyebrow: dateBadge ? `${dateBadge} · Tour standings` : 'Tour standings',
        title: 'Where you stand on tour',
        accentColor: ACCENT_TEAL,
      };
    }
    case 'tour-recap': {
      const tourName =
        typeof p.tour_name === 'string' && p.tour_name.trim()
          ? p.tour_name.trim()
          : 'Tour recap';
      return {
        icon: '🏆',
        eyebrow: 'Tour recap',
        title: `${tourName} is in the books`,
        accentColor: ACCENT_TEAL,
      };
    }
    case 'picks-lock-reminder': {
      const dateBadge = fanDateBadge(p.show_date);
      return {
        icon: '⏰',
        eyebrow: dateBadge ? `${dateBadge} · Picks lock soon` : 'Picks lock soon',
        title: 'Lock in your picks',
        accentColor: ACCENT_AMBER,
      };
    }
    case 'tour-engagement-reminder':
      return {
        icon: '✨',
        eyebrow: 'Keep the run going',
        title: "Don't stop now",
        accentColor: ACCENT_TEAL,
      };
    // Manual / batch marketing only — not an automated event trigger.
    case 'summer-tour-2026-launch': {
      const tourLabel =
        (typeof p.tour_label === 'string' && p.tour_label.trim()) ||
        (typeof p.tourLabel === 'string' && p.tourLabel.trim()) ||
        (typeof p.tour_name === 'string' && p.tour_name.trim()) ||
        'Tour update';
      const headline =
        (typeof p.header_title === 'string' && p.header_title.trim()) ||
        (typeof p.headerTitle === 'string' && p.headerTitle.trim()) ||
        'Bring your crew';
      return {
        icon: '🎸',
        eyebrow: tourLabel,
        title: headline,
        accentColor: ACCENT_TEAL,
      };
    }
    default:
      return null;
  }
}

/**
 * @param {{ icon?: string, eyebrow?: string, title?: string, accentColor?: string } | null | undefined} header
 * @returns {string}
 */
function buildCommsEmailHeaderHtml(header) {
  if (!header || typeof header !== 'object') return '';
  const eyebrow = typeof header.eyebrow === 'string' ? header.eyebrow.trim() : '';
  const title = typeof header.title === 'string' ? header.title.trim() : '';
  if (!eyebrow && !title) return '';
  const icon = typeof header.icon === 'string' ? header.icon.trim() : '';
  const accent = escapeHtml(header.accentColor || ACCENT_TEAL);
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 8px 0;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">${escapeHtml(eyebrow)}${
        icon ? `<span style="margin-left:6px;" aria-hidden="true">${escapeHtml(icon)}</span>` : ''
      }</p>`
    : '';
  const titleHtml = title
    ? `<h1 style="margin:0 0 20px 0;padding:0 0 16px 0;border-bottom:1px solid #e2e8f0;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;color:#0f172a;">${escapeHtml(title)}</h1>`
    : '';
  return `<div style="margin:0 0 4px 0;">${eyebrowHtml}${titleHtml}</div>`;
}

module.exports = {
  resolveCommsEmailHeader,
  buildCommsEmailHeaderHtml,
  ACCENT_TEAL,
  ACCENT_AMBER,
};

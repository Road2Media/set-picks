/**
 * Crawlable New Year's Run shows (#1144).
 * Dates and venue come from the MSG snapshot. No night setlist.
 */
import { SEO_CONFIG } from '../../../shared/config/seo.js';
import { formatFanDate, msgGardenSnapshotStats } from './msgGardenFacts.js';
import {
  NYE_RUN_END,
  NYE_RUN_LABEL,
  NYE_RUN_PATH,
  NYE_RUN_PHISH_URL,
  NYE_RUN_START,
  nyePoolCreateHref,
} from './nyeRunContract.js';

/**
 * Announced Garden nights from the run's first night through the 100th
 * performance. Always the committed snapshot, so a later live doc that drops
 * played dates does not empty this page.
 *
 * @returns {Array<{
 *   date: string,
 *   name: string,
 *   venueName: string,
 *   address: string,
 *   url: string,
 *   fanDate: string,
 *   hundredth: boolean,
 * }>}
 */
export function announcedNyeRunShows() {
  const garden = msgGardenSnapshotStats();
  const end = garden.milestoneShowDate || NYE_RUN_END;
  const dates = garden.upcomingShowDates.filter(
    (date) => date >= NYE_RUN_START && date <= end,
  );
  return dates.map((date) => {
    const hundredth = date === end;
    const venueName = garden.venueName;
    return {
      date,
      hundredth,
      venueName,
      address: garden.city,
      url: NYE_RUN_PHISH_URL,
      fanDate: formatFanDate(date),
      name: hundredth
        ? `Phish at ${venueName}, 100th performance`
        : `Phish at ${venueName}`,
    };
  });
}

/**
 * @param {ReturnType<typeof announcedNyeRunShows>} shows
 * @param {string} pageUrl
 */
export function buildNyeRunJsonLd(shows, pageUrl) {
  const list = Array.isArray(shows) ? shows : [];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: NYE_RUN_LABEL,
        description:
          'Four Phish shows at Madison Square Garden. January 2, 2027 is the 100th performance at the Garden.',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${SEO_CONFIG.siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tour Insights',
            item: `${SEO_CONFIG.siteUrl}/tour-stats`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: NYE_RUN_LABEL,
            item: pageUrl,
          },
        ],
      },
      ...list.map((show) => ({
        '@type': 'Event',
        name: show.name,
        startDate: show.date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: show.venueName,
          address: show.address,
        },
        url: show.url,
      })),
    ],
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {ReturnType<typeof announcedNyeRunShows>} shows
 */
export function buildNyeRunFactsHtml(shows) {
  const list = Array.isArray(shows) ? shows : [];
  const items = list
    .map((show) => {
      const note = show.hundredth ? ' 100th performance at the Garden.' : '';
      return `    <li data-seo-nye-run="show"><time datetime="${escapeHtml(show.date)}">${escapeHtml(show.fanDate)}</time> at ${escapeHtml(show.venueName)}, ${escapeHtml(show.address)}.${escapeHtml(note)} <a href="${escapeHtml(show.url)}">phish.com</a></li>`;
    })
    .join('\n');
  const cta = nyePoolCreateHref();
  return `    <ul data-seo-nye-run="shows">
${items}
    </ul>
    <p data-seo-nye-run="credit">Data courtesy of <a href="https://phish.net">Phish.net</a> / The Mockingbird Foundation. These are the announced shows, not a setlist.</p>
    <p data-seo-nye-run="cta"><a href="${escapeHtml(cta)}">Create a NYE pool</a></p>
    <p data-seo-nye-run="garden"><a href="/phish-at-msg">Phish at MSG</a> has the Garden totals.</p>`;
}

export { NYE_RUN_PATH };

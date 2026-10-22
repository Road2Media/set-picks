/**
 * Durable personalized tour recap — variable copy for in-app, email, and push (#510).
 *
 * Live catalog trigger is `tour_recap` / templateId `tour-recap`. Edition flavor
 * (headline, opening, podium, closing) comes from the send-time payload or
 * `content/comms/tours/<edition>.md` — do not hardcode a live tour in the catalog.
 *
 * Sphere ’26 (`sphere-2026-inaugural`) is a historical edition + War Room replay
 * archive only. See `sphere2026Recap.js`.
 */

import { SEO_CONFIG } from '../../../shared/config/seo.js';

/** @typedef {{ handle: string, points: number, wins: number }} TourRecapPodiumRow */

/** @typedef {'champion' | 'top5' | 'top10' | 'full_run' | 'partial' | 'fallback'} TourRecapRankBranch */

export const TOUR_RECAP_TEMPLATE_ID = 'tour-recap';

export const TOUR_RECAP_RANK_BRANCHES = /** @type {const} */ ([
  'champion',
  'top5',
  'top10',
  'full_run',
  'partial',
  'fallback',
]);

/**
 * Preview-only fixtures — no live calendar / Sphere show dates or template IDs.
 * Used by `/comms-preview` and War Room copy preview.
 */
export const PREVIEW_TOUR_EDITION = {
  tourId: 'preview-tour',
  tourName: 'Sample Tour',
  headline: "Sample Tour: Setlist Pick'em Wrap-Up",
  showCount: 8,
  participantCount: 24,
  openingParas: [
    'The last note is in, and this Setlist Pick\'em tour is officially in the books.',
    'Calling setlists is an inexact science on a good day, and an {{showCount}}-show run kept everyone honest. Despite the curveballs, {{participantCount}} of you stepped up to lay down your picks.',
    'Before the next run, here is the final tape.',
  ],
  closingLines: [
    "Thank you to everyone who submitted picks and made this run a success. Setlist Pick'em will be back for the next stretch of shows.",
    'See you on the next run.',
  ],
  resultSectionLabel: 'Your final result',
  pushTitle: 'Tour recap is in',
  podium: {
    places: [
      {
        rank: 1,
        label: 'Tour Winner',
        tied: false,
        points: 180,
        members: [{ handle: 'ChampionPat', points: 180, wins: 3, shows: 8 }],
      },
      {
        rank: 2,
        label: 'Runner-up',
        tied: false,
        points: 165,
        members: [{ handle: 'SilverPick', points: 165, wins: 2, shows: 8 }],
      },
      {
        rank: 3,
        label: 'Third Place',
        tied: false,
        points: 150,
        members: [{ handle: 'BronzeLane', points: 150, wins: 1, shows: 8 }],
      },
      {
        rank: 4,
        label: '4th',
        tied: false,
        points: 140,
        members: [{ handle: 'LateJoiner', points: 140, wins: 0, shows: 6 }],
      },
      {
        rank: 5,
        label: '5th',
        tied: false,
        points: 120,
        members: [{ handle: 'WildcardKid', points: 120, wins: 2, shows: 4 }],
      },
    ],
    rows: /** @type {TourRecapPodiumRow[]} */ ([
      { handle: 'ChampionPat', points: 180, wins: 3 },
      { handle: 'SilverPick', points: 165, wins: 2 },
      { handle: 'BronzeLane', points: 150, wins: 1 },
    ]),
    honorableMentions: [
      { handle: 'LateJoiner', note: 'Locked in 4th (140 pts) after joining mid-run.' },
      { handle: 'WildcardKid', note: 'Two nightly wins in just four shows played.' },
    ],
  },
};

/**
 * Official-rank places on a new send. Already-sent messages and the Sphere
 * archive have no `places` array and keep the older row layout.
 *
 * @param {{ places?: unknown } | null | undefined} podium
 * @returns {Array<{ rank: number, label?: string, tied?: boolean, points?: number, members?: Array<{ handle?: string, points?: number, wins?: number, shows?: number }> }> | null}
 */
export function tourRecapRankedPlaces(podium) {
  const places = podium?.places;
  if (!Array.isArray(places) || places.length === 0) return null;
  return places.filter((place) => place && Number(place.rank) >= 1);
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function joinPlaceNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

/**
 * @param {number} wins
 * @returns {string}
 */
function nightlyWinsPhrase(wins) {
  if (wins === 0) return 'no nightly wins';
  return `${wins} nightly ${wins === 1 ? 'win' : 'wins'}`;
}

/**
 * One podium line. A tie names every player at that rank.
 *
 * @param {{ rank?: number, label?: string, tied?: boolean, points?: number, members?: Array<{ handle?: string, points?: number, wins?: number, shows?: number }> }} place
 * @returns {string}
 */
export function formatTourRecapPlaceLine(place) {
  const members = Array.isArray(place?.members) ? place.members : [];
  const label = typeof place?.label === 'string' ? place.label : '';
  if (!members.length) return label;
  if (place?.tied) {
    const names = members.map((member) => {
      const handle = member?.handle || 'Anonymous';
      const bits = [];
      const wins = Number(member?.wins);
      if (Number.isFinite(wins)) bits.push(nightlyWinsPhrase(wins));
      const shows = Number(member?.shows);
      if (Number.isFinite(shows)) bits.push(`${shows} ${shows === 1 ? 'show' : 'shows'}`);
      return bits.length ? `${handle} (${bits.join(', ')})` : handle;
    });
    const points = Number(place?.points);
    const at = Number.isFinite(points) ? ` at ${points} points` : '';
    return `${label}${at}: ${joinPlaceNames(names)}`;
  }
  const member = members[0];
  const wins = Number(member?.wins);
  const winPhrase = Number.isFinite(wins) ? nightlyWinsPhrase(wins) : '';
  const points = Number.isFinite(Number(member?.points)) ? `${member.points} pts` : '';
  const stats = [points, winPhrase].filter(Boolean).join(', ');
  return stats ? `${label}: ${member.handle} (${stats})` : `${label}: ${member.handle}`;
}

/**
 * Rank paragraph used when a stored message has no server `personal_line`.
 * Editions that still carry their own `personalByBranch` (Sphere archive) keep that copy.
 *
 * @param {{
 *   rank: number,
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount: number,
 *   showCount: number,
 *   tourName: string,
 * }} ctx
 */
function factualFinishSentence(ctx) {
  const of = Number.isFinite(ctx.participantCount) && ctx.participantCount > 0
    ? ` of ${ctx.participantCount}`
    : '';
  const on = ctx.tourName ? ` on ${ctx.tourName}` : '';
  const points = Number.isFinite(ctx.points) ? ` with ${ctx.points} points` : '';
  const wins = Number.isFinite(ctx.wins)
    ? ` and ${ctx.wins} nightly ${ctx.wins === 1 ? 'win' : 'wins'}`
    : '';
  const shows = Number.isFinite(ctx.showsPlayed) && Number.isFinite(ctx.showCount) && ctx.showCount > 0
    ? `, playing ${ctx.showsPlayed} of ${ctx.showCount} shows`
    : '';
  return `You finished #${ctx.rank}${of}${on}${points}${wins}${shows}.`;
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} vars
 */
export function interpolateTourRecapCopy(template, vars = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

/**
 * @param {{
 *   rank: number,
 *   showsPlayed: number,
 *   showCount: number,
 * }} ctx
 * @returns {TourRecapRankBranch}
 */
export function resolveTourRecapRankBranch(ctx) {
  const r = Number(ctx.rank);
  const played = Number(ctx.showsPlayed);
  const showCount = Number(ctx.showCount);
  if (r === 1) return 'champion';
  if (r >= 2 && r <= 5) return 'top5';
  if (r >= 6 && r <= 10) return 'top10';
  if (r >= 11 && Number.isFinite(showCount) && showCount > 0 && played === showCount) {
    return 'full_run';
  }
  if (r >= 11 && Number.isFinite(played) && Number.isFinite(showCount) && played < showCount) {
    return 'partial';
  }
  return 'fallback';
}

/**
 * @param {object} [edition]
 * @param {object} [payload]
 */
export function resolveTourRecapEdition(edition, payload = {}) {
  const base = edition && typeof edition === 'object' ? edition : PREVIEW_TOUR_EDITION;
  const showCount = Number(payload.show_count ?? payload.showCount ?? base.showCount);
  const participantCount = Number(
    payload.participantCount ?? payload.participant_count ?? base.participantCount,
  );
  const tourName =
    (typeof payload.tour_name === 'string' && payload.tour_name.trim()) ||
    (typeof payload.tourName === 'string' && payload.tourName.trim()) ||
    base.tourName;
  const headline =
    (typeof payload.headline === 'string' && payload.headline.trim()) ||
    base.headline ||
    `${tourName}: Setlist Pick'em Wrap-Up`;
  const podium = payload.podium && typeof payload.podium === 'object' ? payload.podium : base.podium;
  const openingParas = Array.isArray(payload.opening_paras)
    ? payload.opening_paras
    : Array.isArray(payload.openingParas)
      ? payload.openingParas
      : base.openingParas;
  const closingLines = Array.isArray(payload.closing_lines)
    ? payload.closing_lines
    : Array.isArray(payload.closingLines)
      ? payload.closingLines
      : base.closingLines;

  return {
    ...base,
    tourId: payload.tour_id || payload.tourId || base.tourId,
    tourName,
    headline,
    showCount: Number.isFinite(showCount) ? showCount : base.showCount,
    participantCount: Number.isFinite(participantCount) ? participantCount : base.participantCount,
    openingParas,
    closingLines,
    podium,
    resultSectionLabel:
      (typeof payload.result_section_label === 'string' && payload.result_section_label.trim()) ||
      base.resultSectionLabel ||
      'Your final result',
    pushTitle:
      (typeof payload.push_title === 'string' && payload.push_title.trim()) ||
      base.pushTitle ||
      'Tour recap is in',
    personalByBranch: base.personalByBranch || null,
  };
}

/**
 * Personalized “your final result” copy (in-app + long email).
 *
 * A stored `personalLine` is the send. Editions with their own branch copy
 * (the Sphere archive) keep that copy. Everyone else gets the rank facts.
 *
 * @param {{
 *   rank: number,
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount?: number,
 *   showCount?: number,
 *   tourName?: string,
 *   edition?: object,
 *   personalLine?: string,
 *   personal_line?: string,
 * }} ctx
 * @returns {string}
 */
export function getTourRecapPersonalParagraph(ctx) {
  const explicit =
    (typeof ctx.personalLine === 'string' && ctx.personalLine.trim()) ||
    (typeof ctx.personal_line === 'string' && ctx.personal_line.trim()) ||
    '';
  if (explicit) return explicit;

  const edition = resolveTourRecapEdition(ctx.edition, ctx);
  const r = Number(ctx.rank);
  const pts = Number(ctx.points);
  const w = Number(ctx.wins);
  const played = Number(ctx.showsPlayed);
  const participantCount = Number(ctx.participantCount ?? edition.participantCount);
  const showCount = Number(ctx.showCount ?? edition.showCount);
  const tourName = ctx.tourName || edition.tourName;
  const ownTemplates = ctx.edition && ctx.edition.personalByBranch;
  if (ownTemplates) {
    const branch = resolveTourRecapRankBranch({ rank: r, showsPlayed: played, showCount });
    const template = ownTemplates[branch] || ownTemplates.fallback || '';
    return interpolateTourRecapCopy(template, {
      rank: r,
      points: pts,
      wins: w,
      showsPlayed: played,
      participantCount,
      showCount,
      tourName,
    });
  }
  return factualFinishSentence({
    rank: r,
    points: pts,
    wins: w,
    showsPlayed: played,
    participantCount,
    showCount,
    tourName,
  });
}

/**
 * One-line result hook for teaser emails (not the full personalized paragraph).
 *
 * @param {{ rank: number, points: number, wins: number, tourName?: string, edition?: object }} ctx
 */
export function getTourRecapEmailTeaserResultLine(ctx) {
  const edition = resolveTourRecapEdition(ctx.edition, ctx);
  const r = Number(ctx.rank);
  const pts = Number(ctx.points);
  const w = Number(ctx.wins);
  const tourName = ctx.tourName || edition.tourName;
  if (r === 1) {
    const champ =
      edition.emailTeaserChampion ||
      'You took #1 overall with {{points}} points and {{wins}} nightly wins — congratulations on winning {{tourName}}.';
    return interpolateTourRecapCopy(champ, { points: pts, wins: w, tourName });
  }
  const line =
    edition.emailTeaserDefault ||
    'You finished #{{rank}} overall with {{points}} points and {{wins}} nightly wins.';
  return interpolateTourRecapCopy(line, { rank: r, points: pts, wins: w, tourName });
}

/**
 * Abbreviated plain-text email: short hook + CTA to log in / open the site for the full recap.
 *
 * @param {{
 *   rank: number,
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount?: number,
 *   showCount?: number,
 *   tourName?: string,
 *   edition?: object,
 *   podium?: { rows: TourRecapPodiumRow[] },
 * }} ctx
 * @param {{ siteUrl?: string, recapPath?: string }} [options]
 */
export function buildTourRecapEmailAbbreviatedPlainText(ctx, options = {}) {
  const edition = resolveTourRecapEdition(ctx.edition, ctx);
  const siteUrl = (options.siteUrl ?? SEO_CONFIG.siteUrl).replace(/\/+$/, '');
  const recapPath = options.recapPath ?? '/dashboard';
  const recapUrl = `${siteUrl}${recapPath.startsWith('/') ? recapPath : `/${recapPath}`}`;
  const participantCount = ctx.participantCount ?? edition.participantCount;
  const podium = ctx.podium ?? edition.podium;
  const champion = podium?.rows?.[0];
  const tourName = ctx.tourName || edition.tourName;

  const lines = [
    edition.headline,
    '',
    `${tourName} is wrapped — thank you to everyone who played (${participantCount} pickers on the board).`,
    '',
    getTourRecapEmailTeaserResultLine({ ...ctx, edition, tourName }),
    '',
    champion
      ? `Champion: ${champion.handle} (${champion.points} pts, ${champion.wins} nightly wins).`
      : '',
    '',
    'The full story, podium, honorable mentions, and your personalized recap are in the app.',
    '',
    'Log in and open your dashboard to read it:',
    recapUrl,
    '',
    `Rather browse first? Visit ${siteUrl}`,
    '',
    "Until the next run — Setlist Pick'em",
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === ''));

  return lines.join('\n');
}

/**
 * Full plain-text body for email or long in-app message (no emoji; section headers are ASCII).
 *
 * @param {{
 *   rank: number,
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount?: number,
 *   showCount?: number,
 *   tourName?: string,
 *   edition?: object,
 *   podium?: typeof PREVIEW_TOUR_EDITION.podium,
 * }} ctx
 */
export function buildTourRecapEmailPlainText(ctx) {
  const edition = resolveTourRecapEdition(ctx.edition, ctx);
  const participantCount = ctx.participantCount ?? edition.participantCount;
  const showCount = ctx.showCount ?? edition.showCount;
  const podium = ctx.podium ?? edition.podium;
  const tourName = ctx.tourName || edition.tourName;
  const personal = getTourRecapPersonalParagraph({
    ...ctx,
    participantCount,
    showCount,
    tourName,
    edition,
  });
  const vars = { participantCount, showCount, tourName };
  const opening = (edition.openingParas || []).map((p) => interpolateTourRecapCopy(p, vars));
  const champion = podium?.rows?.[0];
  const places = tourRecapRankedPlaces(podium);
  const trophyPlaces = places ? places.filter((place) => Number(place.rank) <= 3) : [];
  const honorPlaces = places ? places.filter((place) => Number(place.rank) > 3) : [];

  const lines = [
    edition.headline,
    '',
    ...opening,
    '',
    '---',
    'THE PODIUM',
    '',
    ...(places
      ? [
          ...trophyPlaces.map((place) => formatTourRecapPlaceLine(place)),
          ...(honorPlaces.length
            ? ['', 'Honorable mentions:', ...honorPlaces.map((place) => formatTourRecapPlaceLine(place))]
            : []),
        ]
      : [
          champion
            ? `A massive congratulations to our champion, ${champion.handle}. Taking down ${champion.wins} nightly wins across ${showCount} shows to secure ${champion.points} total points is a dominant performance.`
            : '',
          '',
          'The race for the top was incredibly tight down the stretch:',
          '',
          ...(podium?.rows || []).map((row, i) => {
            const label = i === 0 ? '1st' : i === 1 ? '2nd' : '3rd';
            return `${label}: ${row.handle} (${row.points} Pts, ${row.wins} Wins)`;
          }),
          '',
          ...(podium?.honorableMentions?.length
            ? ['Honorable mentions:', ...podium.honorableMentions.map((h) => `- ${h.handle}: ${h.note}`)]
            : []),
        ]),
    '',
    '---',
    (edition.resultSectionLabel || 'YOUR FINAL RESULT').toUpperCase(),
    '',
    personal,
    '',
    '---',
    ...(edition.closingLines || []).map((p) => interpolateTourRecapCopy(p, vars)),
  ];

  return lines.join('\n');
}

/**
 * Short FCM-style notification (title + body). Keep under typical OS truncation.
 *
 * @param {{ rank: number, points: number, wins: number, edition?: object, tourName?: string }} ctx
 * @returns {{ title: string, body: string }}
 */
export function buildTourRecapPushPayload(ctx) {
  const edition = resolveTourRecapEdition(ctx.edition, ctx);
  const { rank, points, wins } = ctx;
  const title = edition.pushTitle || 'Tour recap is in';
  if (Number(rank) === 1) {
    return {
      title,
      body: `You took #1 with ${points} pts and ${wins} nightly wins. Open the app for the full wrap-up.`,
    };
  }
  return {
    title,
    body: `You finished #${rank} (${points} pts, ${wins} wins). Open the app for your personalized recap.`,
  };
}

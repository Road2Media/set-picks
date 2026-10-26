/**
 * Public marketing SEO route registry — Helmet pages + build-time prerender (#659).
 *
 * Post-build `scripts/prerender-seo.mjs` writes crawler-visible HTML into `dist/`.
 * Public tour-stats (#665 / #927 / #959): `/tour-stats` (+ Sphere + Summer 2026
 * static opt-in slugs). Additional `/tour-stats/{slug}` pages auto-expand at
 * prerender when `public_tour_stats` meets the thin-page gate — do not hand-edit
 * this registry for each new tour (`scripts/lib/tourStatsSeoAutoExpand.mjs`).
 *
 * Do not list `/dashboard/*`, `/invite/*`, or `/join/*`.
 *
 * Scoring point values mirror `SCORING_RULES` in `shared/utils/scoring.js` (kept as
 * literals here so Node verify/prerender scripts do not need Vite path resolution).
 */
import { SEO_CONFIG } from './seo.js';

const EXACT_SLOT = 10;
const ENCORE_EXACT = 15;
const IN_SETLIST = 5;
const WILDCARD_HIT = 10;
const BUSTOUT_BOOST = 20;
const BUSTOUT_MIN_GAP = 30;

const organizationId = `${SEO_CONFIG.siteUrl}/#organization`;

export const SEO_FAVICON_VERSION = '20260715';

export const LANDING_FAQ_MAIN_ENTITY = [
  {
    '@type': 'Question',
    name: "What is Setlist Pick 'Em?",
    acceptedAnswer: {
      '@type': 'Answer',
      text: SEO_CONFIG.defaultDescription,
    },
  },
  {
    '@type': 'Question',
    name: 'How does scoring work?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: `Picks earn points by how they match the official setlist. In setlist (song played, wrong slot): ${IN_SETLIST} points. Exact slot (set opener or closer you called): ${EXACT_SLOT} points. Wildcard (song played anywhere in the show): ${WILDCARD_HIT} points. Encore: ${ENCORE_EXACT} points. Bustout Boost adds ${BUSTOUT_BOOST} bonus points on top of the base score when the song had a gap of ${BUSTOUT_MIN_GAP} or more shows since it was last played.`,
    },
  },
  {
    '@type': 'Question',
    name: 'How do I play with friends?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Create a private pool and share your invite link, or compete on the global leaderboard alongside other fans.',
    },
  },
  {
    '@type': 'Question',
    name: "Is Setlist Pick 'Em free?",
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Yes. There is no charge to sign up and play.',
    },
  },
  {
    '@type': 'Question',
    name: 'Which bands does it support today?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: "We're live with Phish today, and Setlist Pick 'Em is built to grow into a home for more bands soon.",
    },
  },
  {
    '@type': 'Question',
    name: 'What is a Bustout Boost?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: `Correct picks on bustout songs (a ${BUSTOUT_MIN_GAP}+ show gap going into the show) earn ${BUSTOUT_BOOST} extra points on top of the base points, whether the outcome is in setlist, exact slot, wildcard, or encore.`,
    },
  },
];

function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SEO_CONFIG.publisherName,
        url: SEO_CONFIG.siteUrl,
      },
      {
        '@type': 'SoftwareApplication',
        name: "Setlist Pick'em",
        applicationCategory: 'GameApplication',
        operatingSystem: 'WebBrowser',
        description: SEO_CONFIG.defaultDescription,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': organizationId },
        provider: { '@id': organizationId },
      },
      {
        '@type': 'HowTo',
        name: "How to play Setlist Pick'em",
        step: [
          {
            '@type': 'HowToStep',
            name: 'Lock It In',
            text: 'Predict the openers, closers, encore, and a wildcard before the lights go down.',
          },
          {
            '@type': 'HowToStep',
            name: 'Watch It Unfold',
            text: 'Watch the setlist and your scores update live as songs are played.',
          },
          {
            '@type': 'HowToStep',
            name: 'Claim the Crown',
            text: 'Play in the global pool or join private pools to compete with your crew.',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: LANDING_FAQ_MAIN_ENTITY,
      },
    ],
  };
}

const HOW_IT_WORKS_TITLE = "How to Play Setlist Pick'Em | Show-Night Walkthrough";
const HOW_IT_WORKS_DESCRIPTION =
  "Lock picks before showtime, score live as the setlist unfolds, compete in pools or global standings, and unlock personal stats as you play. Free setlist prediction game—live with Phish today, more bands soon.";
const HOW_IT_WORKS_URL = `${SEO_CONFIG.siteUrl}/how-it-works`;

function buildHowItWorksJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': HOW_IT_WORKS_URL,
        url: HOW_IT_WORKS_URL,
        name: HOW_IT_WORKS_TITLE,
        description: HOW_IT_WORKS_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
      },
      {
        '@type': 'HowTo',
        name: "How to play Setlist Pick'Em",
        description: HOW_IT_WORKS_DESCRIPTION,
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Lock your setlist card',
            text: 'Before showtime, lock six calls: Set 1 opener and closer, Set 2 opener and closer, encore, and wildcard. Exact slot hits score more; rare songs can trigger a Bustout Boost.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Follow the show-night timeline',
            text: 'Before the show, lock picks and peek at tour stats. During the show, scores and standings update as songs land. After the show, final grades and tour standings post.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Compete in pools or global standings',
            text: 'Invite friends to private pools for crew-only standings, or compete with everyone on the global board for the show and the tour. Same six picks, two scoreboards.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Unlock personal stats as you play',
            text: 'Public tour trends are open to everyone. Your picking average, Bustout Boost hits, and pick heatmap start building the first night you play.',
          },
        ],
      },
    ],
  };
}

const HOW_SCORING_TITLE = "How Scoring Works | Setlist Pick'Em";
const HOW_SCORING_DESCRIPTION = `Setlist Pick'Em scoring guide: In setlist (${IN_SETLIST} pts), exact slot (${EXACT_SLOT} pts), wildcard (${WILDCARD_HIT} pts), encore (${ENCORE_EXACT} pts), plus a Bustout Boost of ${BUSTOUT_BOOST} points for songs with a ${BUSTOUT_MIN_GAP}+ show gap.`;
const HOW_SCORING_URL = `${SEO_CONFIG.siteUrl}/how-scoring-works`;

const TOUR_STATS_HUB_TITLE = "Phish Tour Statistics & Insights | Setlist Pick'Em";
const TOUR_STATS_HUB_DESCRIPTION =
  "Tour Insights: the latest Phish tour setlist statistics—most-played songs, bustouts by tour, and gap highlights. Updated every night the band plays live. Play Setlist Pick'Em to unlock personal stats.";
const TOUR_STATS_HUB_URL = `${SEO_CONFIG.siteUrl}/tour-stats`;

const TOUR_STATS_SPHERE_TITLE = "2026 Sphere Tour Statistics | Setlist Pick'Em";
const TOUR_STATS_SPHERE_DESCRIPTION =
  "2026 Sphere tour insights and setlist statistics—most-played songs, Sphere tour bustouts, and gap highlights from the inaugural Setlist Pick'Em tour. Updated after every live show night.";
const TOUR_STATS_SPHERE_URL = `${SEO_CONFIG.siteUrl}/tour-stats/2026-sphere`;

/** Live Firestore slug from calendar label "2026 Summer Tour" (#927/#928). */
const TOUR_STATS_SUMMER_TITLE =
  "2026 Summer Tour Statistics | Setlist Pick'Em";
const TOUR_STATS_SUMMER_DESCRIPTION =
  "2026 Summer Tour Phish setlist statistics—most-played songs, unique songs, summer tour bustouts, and gap highlights. Updated every night the band plays live. Play Setlist Pick'Em to unlock personal stats.";
const TOUR_STATS_SUMMER_URL = `${SEO_CONFIG.siteUrl}/tour-stats/2026-summer-tour`;

/** MSG milestone page (#1139). Not a tour slug. */
const MSG_GARDEN_TITLE =
  "Phish at MSG: 96 Shows by the Numbers | Setlist Pick'Em";
const MSG_GARDEN_DESCRIPTION =
  'Phish at Madison Square Garden by the numbers: 96 shows through July 29, 2026, most-played songs, debuts, gaps, and New Year\'s Eve facts. January 2, 2027 is the 100th show.';
const MSG_GARDEN_URL = `${SEO_CONFIG.siteUrl}/tour-stats/msg`;

/** Annual roll-up (#1141). Not a tour slug. */
const ANNUAL_2026_TITLE = "2026 Phish Tour Statistics | Setlist Pick'Em";
const ANNUAL_2026_DESCRIPTION =
  '2026 Phish tour setlist statistics across every tour that year: shows, unique songs, most-played songs, and bustouts. December 31 counts for 2026. January 1 counts for 2027.';
const ANNUAL_2026_URL = `${SEO_CONFIG.siteUrl}/tour-stats/2026`;
/**
 * Static opt-in slugs that always prerender facts (#928).
 * #959 auto-expand adds further slugs at build time without editing this list.
 */
export const TOUR_STATS_SEO_FACT_SLUGS = Object.freeze([
  '2026-sphere',
  '2026-summer-tour',
]);

function buildTourStatsHubJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': TOUR_STATS_HUB_URL,
        url: TOUR_STATS_HUB_URL,
        name: TOUR_STATS_HUB_TITLE,
        description: TOUR_STATS_HUB_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
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
            item: TOUR_STATS_HUB_URL,
          },
        ],
      },
    ],
  };
}

function buildTourStatsSphereJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': TOUR_STATS_SPHERE_URL,
        url: TOUR_STATS_SPHERE_URL,
        name: TOUR_STATS_SPHERE_TITLE,
        description: TOUR_STATS_SPHERE_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
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
            item: TOUR_STATS_HUB_URL,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: '2026 Sphere',
            item: TOUR_STATS_SPHERE_URL,
          },
        ],
      },
    ],
  };
}

function buildMsgGardenJsonLdShell() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': MSG_GARDEN_URL,
        url: MSG_GARDEN_URL,
        name: MSG_GARDEN_TITLE,
        description: MSG_GARDEN_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
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
            item: TOUR_STATS_HUB_URL,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Phish at MSG',
            item: MSG_GARDEN_URL,
          },
        ],
      },
    ],
  };
}

function buildAnnual2026JsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': ANNUAL_2026_URL,
        url: ANNUAL_2026_URL,
        name: ANNUAL_2026_TITLE,
        description: ANNUAL_2026_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
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
            item: TOUR_STATS_HUB_URL,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: '2026 tours',
            item: ANNUAL_2026_URL,
          },
        ],
      },
    ],
  };
}

function buildTourStatsSummerJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': TOUR_STATS_SUMMER_URL,
        url: TOUR_STATS_SUMMER_URL,
        name: TOUR_STATS_SUMMER_TITLE,
        description: TOUR_STATS_SUMMER_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
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
            item: TOUR_STATS_HUB_URL,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: '2026 Summer Tour',
            item: TOUR_STATS_SUMMER_URL,
          },
        ],
      },
    ],
  };
}

const KEYWORD_PAGE_PATH = '/phish-setlist-prediction-game';
/** #973: C6/C7 bridge — prediction + picks + game; tuned off "& Picks" (phishpicks.net). */
const KEYWORD_PAGE_TITLE =
  "Phish Setlist Prediction Game — Lock Your Picks | Setlist Pick'Em";
const KEYWORD_PAGE_DESCRIPTION =
  "Free Phish setlist prediction game: lock your setlist picks—openers, closers, encore, and a wildcard—before showtime, score live, and compete with friends. Built for jam bands; live with Phish today, more soon.";
const KEYWORD_PAGE_URL = `${SEO_CONFIG.siteUrl}${KEYWORD_PAGE_PATH}`;

const ABOUT_PATH = '/about';
const ABOUT_TITLE = "About Setlist Pick'Em | From Tour Ritual to Live Game";
const ABOUT_DESCRIPTION =
  "The origin of Setlist Pick'Em—a fan-made setlist prediction game that started on Phish tour in 2001 and grew from paper and spreadsheets into a live game for friends and crews. Phish first; more bands soon.";
const ABOUT_URL = `${SEO_CONFIG.siteUrl}${ABOUT_PATH}`;

const PRIVACY_TITLE = "Privacy Policy | Setlist Pick'Em";
const PRIVACY_DESCRIPTION =
  "Privacy Policy for Setlist Pick 'Em — what information we collect, why we collect it, and how you can manage it. Operated by Road2 Media, LLC.";
const PRIVACY_URL = `${SEO_CONFIG.siteUrl}/privacy`;

const TERMS_TITLE = "Terms of Service | Setlist Pick'Em";
const TERMS_DESCRIPTION =
  "Terms of Service for Setlist Pick 'Em — the free Phish setlist prediction game operated by Road2 Media, LLC. Entertainment only; no entry fees or cash prizes.";
const TERMS_URL = `${SEO_CONFIG.siteUrl}/terms`;

function buildLegalWebPageJsonLd({ url, title, description }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: title,
        description,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
      },
    ],
  };
}

function buildKeywordIntentPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': KEYWORD_PAGE_URL,
        url: KEYWORD_PAGE_URL,
        name: KEYWORD_PAGE_TITLE,
        description: KEYWORD_PAGE_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is a setlist prediction game?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "A setlist prediction game (some fans call it a fantasy setlist game) asks you to call which songs get played, and where they land, before the show starts. Then you compete in private pools and on the global leaderboard as scores update live. Setlist Pick'Em is free. Phish is up first, with more bands on the way.",
            },
          },
          {
            '@type': 'Question',
            name: 'What are Phish setlist picks?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Your Phish setlist picks are the six calls you lock before the lights go down: the Set 1 opener and closer, the Set 2 opener and closer, the encore, and one wildcard. That's the whole game. You're not writing out a full predicted setlist or following a tip sheet. When a song lands in one of your slots, you score, and your pool and the global leaderboard update in real time.",
            },
          },
          {
            '@type': 'Question',
            name: 'Is Setlist Pick\'Em a fantasy setlist game?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Yes, if you mean predicting setlists before the show and competing on points. Lock openers, closers, encore, and a wildcard, then score live as songs are played. No spreadsheet required.",
            },
          },
          {
            '@type': 'Question',
            name: "How is Setlist Pick'Em different from a setlist archive?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Archives look back at what was played. Setlist Pick'Em is about the night ahead: make your setlist picks before showtime, score as songs land, and build personal stats as you compete with other fans.",
            },
          },
          {
            '@type': 'Question',
            name: 'Is Setlist Pick\'Em free?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. There is no charge to sign up and play.',
            },
          },
        ],
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
            name: 'Phish setlist prediction game',
            item: KEYWORD_PAGE_URL,
          },
        ],
      },
    ],
  };
}

function buildHowScoringJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': HOW_SCORING_URL,
        url: HOW_SCORING_URL,
        name: HOW_SCORING_TITLE,
        description: HOW_SCORING_DESCRIPTION,
        isPartOf: { '@id': `${SEO_CONFIG.siteUrl}/#website` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How many points do I get for an in-setlist pick?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `If your pick is played anywhere in the setlist but not in the exact slot you chose, you earn ${IN_SETLIST} points.`,
            },
          },
          {
            '@type': 'Question',
            name: 'How many points for an exact slot pick?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `If your pick lands in the exact slot you selected (Set 1 opener/closer or Set 2 opener/closer), you earn ${EXACT_SLOT} points.`,
            },
          },
          {
            '@type': 'Question',
            name: 'How many points for the wildcard?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `If your wildcard pick is played anywhere in the show, you earn ${WILDCARD_HIT} points.`,
            },
          },
          {
            '@type': 'Question',
            name: 'How many points for an encore pick?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `If your pick is played during the encore, you earn ${ENCORE_EXACT} points, the highest base score because the encore is the toughest call.`,
            },
          },
          {
            '@type': 'Question',
            name: 'What is the Bustout Boost?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Correct picks on songs with a ${BUSTOUT_MIN_GAP}+ show gap earn a bonus ${BUSTOUT_BOOST} points on top of base points. That's the reward for digging past the heavy rotation.`,
            },
          },
        ],
      },
    ],
  };
}

/**
 * @typedef {object} SeoPrerenderRoute
 * @property {string} path - URL path (`/` or `/how-it-works`)
 * @property {string} title
 * @property {string} description
 * @property {string} canonicalUrl
 * @property {string} h1
 * @property {string[]} paragraphs - crawler-visible body copy
 * @property {() => object} buildJsonLd
 */

/** @type {SeoPrerenderRoute[]} */
export const PRERENDER_ROUTES = [
  {
    path: '/',
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    canonicalUrl: `${SEO_CONFIG.siteUrl}/`,
    h1: "Setlist Pick 'Em: the free Phish setlist prediction game (more bands soon)",
    paragraphs: [
      'The free Phish setlist prediction game. Live on tour.',
      "Make picks for tonight's show, watch scores update as songs are played, and compete with your tour crew for the top spot.",
      "Lock It In: predict openers, closers, encore, and a wildcard before the lights go down. Watch It Unfold as scores update live. Claim the Crown in the global pool or private pools with friends. Play and your personal stats build as you rack up points.",
    ],
    buildJsonLd: buildHomeJsonLd,
  },
  {
    path: '/how-it-works',
    title: HOW_IT_WORKS_TITLE,
    description: HOW_IT_WORKS_DESCRIPTION,
    canonicalUrl: HOW_IT_WORKS_URL,
    h1: "How to Play Setlist Pick'Em",
    paragraphs: [
      "Setlist Pick'Em is a free, live setlist prediction game for Phish fans, with more bands on the way. Here's the show-night walkthrough: what you lock, how scoring moves, and where your crew ranks.",
      'Before the lights go down, lock six calls: Set 1 opener and closer, Set 2 opener and closer, encore, and wildcard. Exact slot hits score more; rare songs can trigger a Bustout Boost.',
      'Before the show, lock picks and check tour stats. During the show, scores update live. After the show, final grades post and your personal stats pick up another show.',
      'Compete in private pools with friends or on global standings. Same six picks, two scoreboards. Your personal stats build as you earn points and climb the board.',
    ],
    buildJsonLd: buildHowItWorksJsonLd,
  },
  {
    path: '/how-scoring-works',
    title: HOW_SCORING_TITLE,
    description: HOW_SCORING_DESCRIPTION,
    canonicalUrl: HOW_SCORING_URL,
    h1: 'How Scoring Works',
    paragraphs: [
      'Picks earn points based on where they land in the setlist.',
      `In setlist: ${IN_SETLIST} points. Exact slot: ${EXACT_SLOT} points. Wildcard: ${WILDCARD_HIT} points. Encore: ${ENCORE_EXACT} points.`,
      `Bustout Boost: +${BUSTOUT_BOOST} points on top of base when the song had a ${BUSTOUT_MIN_GAP}+ show gap.`,
    ],
    buildJsonLd: buildHowScoringJsonLd,
  },
  {
    path: '/tour-stats',
    title: TOUR_STATS_HUB_TITLE,
    description: TOUR_STATS_HUB_DESCRIPTION,
    canonicalUrl: TOUR_STATS_HUB_URL,
    h1: 'Phish tour setlist statistics',
    paragraphs: [
      'Tour Insights tracks Phish tour setlist statistics: most-played songs, bustouts by tour, and gap highlights that help you make better picks.',
      'Statistics update every night the band plays. Play the game and your personal stats start counting as you rack up points against other setlist pickers.',
      'We\'re starting with Phish and building toward more bands soon. This page covers tour-wide song trends, not a full night-by-night setlist archive.',
    ],
    buildJsonLd: buildTourStatsHubJsonLd,
  },
  {
    path: '/tour-stats/2026-sphere',
    title: TOUR_STATS_SPHERE_TITLE,
    description: TOUR_STATS_SPHERE_DESCRIPTION,
    canonicalUrl: TOUR_STATS_SPHERE_URL,
    h1: '2026 Sphere tour statistics',
    tourStatsSeoSlug: '2026-sphere',
    paragraphs: [
      'Tour Insights for the 2026 Sphere run: setlist statistics, most-played songs, Sphere tour bustouts, and gap highlights from the inaugural Setlist Pick \'Em tour.',
      'Statistics update every night the band plays, so the picture keeps getting sharper as you make picks.',
      'Tour-wide song trends for fans. Play the game and your personal stats build as you compete.',
    ],
    buildJsonLd: buildTourStatsSphereJsonLd,
  },
  {
    path: '/tour-stats/2026-summer-tour',
    title: TOUR_STATS_SUMMER_TITLE,
    description: TOUR_STATS_SUMMER_DESCRIPTION,
    canonicalUrl: TOUR_STATS_SUMMER_URL,
    h1: '2026 Summer Tour setlist statistics',
    /** Build-time Firestore REST enrich (#928). */
    tourStatsSeoSlug: '2026-summer-tour',
    paragraphs: [
      'Tour Insights for Phish 2026 Summer Tour: setlist statistics, most-played songs, unique songs, summer tour bustouts, and gap highlights.',
      'Statistics update every night the band plays, so the picture keeps getting sharper as you make picks.',
      'Tour-wide song trends for fans. Play the game and your personal stats build as you compete.',
    ],
    buildJsonLd: buildTourStatsSummerJsonLd,
  },
  {
    path: '/tour-stats/msg',
    title: MSG_GARDEN_TITLE,
    description: MSG_GARDEN_DESCRIPTION,
    canonicalUrl: MSG_GARDEN_URL,
    h1: 'Phish at MSG, by the numbers',
    paragraphs: [
      'Phish at Madison Square Garden, counted from the shows Phish.net actually played. Canceled nights stay off the total.',
      'Aggregates only: most-played songs, songs debuted at the Garden, the longest stretches between visits, bustouts that landed here, New Year\'s Eve counts, and how often each song has opened a show. Frequencies, not a pick tip.',
      'Not a night-by-night setlist archive. The New Year\'s Run is the next reason to lock a card.',
    ],
    buildJsonLd: buildMsgGardenJsonLdShell,
  },
  {
    path: '/tour-stats/2026',
    title: ANNUAL_2026_TITLE,
    description: ANNUAL_2026_DESCRIPTION,
    canonicalUrl: ANNUAL_2026_URL,
    h1: '2026 Phish tour statistics',
    paragraphs: [
      'Every 2026 Phish tour on one page: shows played, unique songs, most-played songs, and bustouts.',
      'A show counts for the calendar year of its date. December 30 and December 31, 2026 count for 2026. January 1 and January 2, 2027 count for 2027.',
      'Show counts and song-row totals add the tour pages. A song played on two tours counts once among unique songs, and its plays add up. Not a night-by-night setlist archive.',
    ],
    buildJsonLd: buildAnnual2026JsonLd,
  },
  {
    path: KEYWORD_PAGE_PATH,
    title: KEYWORD_PAGE_TITLE,
    description: KEYWORD_PAGE_DESCRIPTION,
    canonicalUrl: KEYWORD_PAGE_URL,
    h1: 'The free Phish setlist prediction game',
    paragraphs: [
      "Setlist Pick'Em is a free, live game for fans who love calling the show. Lock six Phish setlist picks before showtime: openers, closers, encore, and a wildcard. Then watch your score move as the night unfolds. Phish is up first; more bands are on the way.",
      'A setlist prediction game (some fans call it a fantasy setlist game) asks you to call which songs get played, and where they land, before the show starts.',
      "Your Phish setlist picks are the six calls you lock before the lights go down: the Set 1 opener and closer, the Set 2 opener and closer, the encore, and one wildcard. That's the whole game. You're not writing out a full predicted setlist or following a tip sheet.",
      'Tour stats (song frequency, bustouts, gaps) update every night the band plays. Once you play, you get your own numbers too: picking average, Bustout Boost hits, and a heatmap of your most frequent picks.',
    ],
    buildJsonLd: buildKeywordIntentPageJsonLd,
  },
  {
    path: ABOUT_PATH,
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    canonicalUrl: ABOUT_URL,
    h1: "About Setlist Pick'Em",
    paragraphs: [
      'Born on Phish tour in 2001. Paper picks became a spreadsheet, and the spreadsheet became a live setlist prediction game for friends and crews.',
      'Ryan M (Beaver), Glu, and Andy F shaped the ritual on the road; Pat later moved it from paper to a spreadsheet, then into Setlist Pick\'Em.',
      'Live with Phish today, with more bands on the way. Read how it works or the Phish setlist prediction game definition.',
    ],
    buildJsonLd: () =>
      buildLegalWebPageJsonLd({
        url: ABOUT_URL,
        title: ABOUT_TITLE,
        description: ABOUT_DESCRIPTION,
      }),
  },
  {
    path: '/privacy',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    canonicalUrl: PRIVACY_URL,
    h1: 'Privacy Policy',
    paragraphs: [
      // Avoid early double-quotes — prerender HTML-escapes them to &quot; and
      // verify:seo-prerender checks the first 40 chars as a literal substring.
      "Setlist Pick 'Em privacy policy: operated by Road2 Media, LLC. This policy explains what information we collect, why we collect it, and how you can manage it.",
      'When you create an account we store the email address you sign up with (or that your Google account provides) and a display handle you choose.',
      'We retain your account and gameplay data for as long as your account is active. You can delete your account from your Profile page within the App.',
    ],
    buildJsonLd: () =>
      buildLegalWebPageJsonLd({
        url: PRIVACY_URL,
        title: PRIVACY_TITLE,
        description: PRIVACY_DESCRIPTION,
      }),
  },
  {
    path: '/terms',
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    canonicalUrl: TERMS_URL,
    h1: 'Terms of Service',
    paragraphs: [
      "These Terms of Service govern your use of Setlist Pick 'Em, operated by Road2 Media, LLC. By creating an account or using the App you agree to these Terms.",
      "Setlist Pick 'Em is an entertainment platform where players predict setlists for live Phish concerts. This is strictly an entertainment product. There are no entry fees, no cash prizes, and no wagering or gambling of any kind.",
      'You must create an account to play. You are responsible for keeping your sign-in credentials secure. Each person may maintain one account.',
    ],
    buildJsonLd: () =>
      buildLegalWebPageJsonLd({
        url: TERMS_URL,
        title: TERMS_TITLE,
        description: TERMS_DESCRIPTION,
      }),
  },
];

export function getPrerenderRoute(path) {
  return PRERENDER_ROUTES.find((r) => r.path === path) ?? null;
}

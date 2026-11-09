/**
 * Public surface for the New Year's Run page (#1144).
 * Kept off `index.js` so the Garden stats chunk does not load this copy.
 */
export {
  announcedNyeRunShows,
  buildNyeRunFactsHtml,
  buildNyeRunJsonLd,
} from './model/nyeRunShows.js';
export {
  NYE_POOL_NAME,
  NYE_RUN_LABEL,
  NYE_RUN_PATH,
  NYE_RUN_PHISH_URL,
  NYE_RUN_SLUG,
  nyePoolCreateHref,
} from './model/nyeRunContract.js';

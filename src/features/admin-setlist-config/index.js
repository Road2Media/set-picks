/**
 * Public surface for admin setlist automation (epic #42).
 * Prefer importing from here from pages or other features.
 */
export {
  fetchSetlistRaw,
  getProviderClient,
  isSetlistFetchFailure,
} from './api/phishApiClient.js';
export {
  parseSetlist,
  mapParsedSetlistToLegacySaveShape,
  normalizeSetlistApiSource,
  SetlistParseError,
} from './model/setlistParser.js';

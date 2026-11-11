/**
 * Live Phish coordinates the product already uses.
 * `BandConfig` for `phish` reads these so Phase 0 cannot drift from
 * the footer credit or the Storage object players already load.
 *
 * Footer text/href: `SplashPageShell.jsx` and `MarketingPageShell.jsx`
 * render this object. The catalog object string is the same path those
 * loaders already use (`songCatalogUrl.js`, `functions/phishnetSongCatalog.js`).
 * Phase 0 does not retarget those loaders.
 */

/** Storage object for the live song catalog (Phish, until per-band paths). */
export const PHISH_SONG_CATALOG_STORAGE_KEY = 'song-catalog.json';

/**
 * Splash and marketing footer credit. Rendered as the link label and href
 * inside "Song and setlist data provided by …".
 */
export const PHISH_NET_FOOTER_ATTRIBUTION = Object.freeze({
  text: 'The Mockingbird Foundation / Phish.Net',
  href: 'https://phish.net',
});

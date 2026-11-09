import { useEffect, useMemo, useState } from 'react';

import { fetchFirstOkJson } from '../../../shared/lib/fetchFirstOkJson.js';
import { catalogFallbackReason, trackSongCatalogFallback } from './songCatalogAnalytics.js';
import { selectCatalogSongs } from './selectCatalogSongs.js';
import {
  SONG_CATALOG_CACHE_KEY,
  SONG_CATALOG_CACHE_MAX_AGE_MS,
} from './songCatalogConstants.js';
import { resolveSongCatalogFetchUrls } from './songCatalogUrl.js';

/**
 * @typedef {{ fetchedAt: number, songs: { name: string, total?: string, gap?: string, last?: string, debut?: string }[], updatedAt?: string }} CatalogCacheV1
 */

/**
 * @param {unknown} body
 * @returns {{ name: string, total?: string, gap?: string, last?: string, debut?: string }[] | null}
 */
function songsFromResponseBody(body) {
  if (!body || typeof body !== 'object') return null;
  const songs = /** @type {Record<string, unknown>} */ (body).songs;
  if (!Array.isArray(songs) || songs.length === 0) return null;
  return /** @type {{ name: string, total?: string, gap?: string, last?: string, debut?: string }[]} */ (
    songs
  );
}

/**
 * @returns {CatalogCacheV1 | null}
 */
function readCatalogCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SONG_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.fetchedAt !== 'number' ||
      !Array.isArray(parsed.songs)
    ) {
      return null;
    }
    return /** @type {CatalogCacheV1} */ (parsed);
  } catch {
    return null;
  }
}

/**
 * @param {CatalogCacheV1} entry
 */
function writeCatalogCache(entry) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SONG_CATALOG_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota or private mode — ignore
  }
}

/**
 * Loads song catalog from public Storage JSON with a 6-hour localStorage cache (issue #158).
 * Falls back to bundled `PHISH_SONGS` when unavailable. A bundled result emits
 * one GA4 `song_catalog_fallback` per session (#168).
 *
 * @returns {{
 *   songs: { name: string, total?: string, gap?: string, last?: string, debut?: string }[],
 *   source: 'cdn' | 'fallback',
 *   loadError: Error | null,
 *   isLoading: boolean,
 *   loadedFromCache: boolean,
 * }}
 */
export function useSongCatalog() {
  const [remoteSongs, setRemoteSongs] = useState(/** @type {unknown} */ (null));
  const [loadError, setLoadError] = useState(/** @type {Error | null} */ (null));
  const [resolved, setResolved] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setLoadError(null);
      setLoadedFromCache(false);

      const now = Date.now();
      const cached = readCatalogCache();

      if (
        cached &&
        cached.songs.length > 0 &&
        now - cached.fetchedAt < SONG_CATALOG_CACHE_MAX_AGE_MS
      ) {
        if (!cancelled) {
          setRemoteSongs(cached.songs);
          setLoadedFromCache(true);
          setResolved(true);
        }
        return;
      }

      let urls;
      try {
        urls = await resolveSongCatalogFetchUrls();
      } catch (e) {
        if (ac.signal.aborted || cancelled) return;
        const stale = cached && cached.songs.length > 0 ? cached.songs : null;
        if (stale) {
          setRemoteSongs(stale);
          setResolved(true);
          return;
        }
        setRemoteSongs(null);
        setLoadError(
          e instanceof Error ? e : new Error(String(e)),
        );
        setResolved(true);
        return;
      }

      try {
        const body = await fetchFirstOkJson(urls, { signal: ac.signal });
        const songs = songsFromResponseBody(body);
        if (!songs) {
          throw new Error('Song catalog JSON missing songs array.');
        }

        const updatedAt =
          typeof body?.updatedAt === 'string' ? body.updatedAt : undefined;

        writeCatalogCache({
          fetchedAt: Date.now(),
          songs,
          updatedAt,
        });

        if (!cancelled) {
          setRemoteSongs(songs);
          setResolved(true);
        }
      } catch (e) {
        if (ac.signal.aborted || cancelled) return;

        const stale = cached && cached.songs.length > 0 ? cached.songs : null;
        if (stale) {
          setRemoteSongs(stale);
          setLoadError(null);
          setResolved(true);
          return;
        }

        setRemoteSongs(null);
        setLoadError(e instanceof Error ? e : new Error(String(e)));
        setResolved(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const { songs, source } = useMemo(
    () => selectCatalogSongs(remoteSongs),
    [remoteSongs],
  );

  useEffect(() => {
    const reason = catalogFallbackReason({ resolved, source, loadError });
    if (!reason) return;
    trackSongCatalogFallback({ reason });
  }, [resolved, source, loadError]);

  return {
    songs,
    source,
    loadError,
    isLoading: !resolved,
    loadedFromCache,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  fetchPublicTourStatsDoc,
  fetchPublicTourStatsIndex,
} from '../api/fetchPublicTourStats';
import {
  buildFinishedTourWrap,
  finishedTourWrapShareImageUrl,
} from './finishedTourWrap';
import {
  readCachedPublicTourStatsDoc,
  readCachedPublicTourStatsIndex,
  writeCachedPublicTourStatsDoc,
  writeCachedPublicTourStatsIndex,
} from './publicTourStatsCdn';
import {
  publicTourStatsPathForSlug,
  resolveDefaultPublicTourSlug,
  sortPublicTourIndex,
} from './publicTourIndex';
import { SEO_CONFIG } from '../../../shared/config/seo';

/**
 * Public tour-stats screen (#665 / #869) — aggregate docs only; no self overlay.
 * Seeds from session cache so chrome stays interactive and the skeleton is not
 * the first paint when last-good data exists. CDN JSON / REST revalidate
 * without App Check.
 */
export function usePublicTourStatsScreen() {
  const { tourSlug: routeSlug } = useParams();
  const navigate = useNavigate();
  const [indexLoading, setIndexLoading] = useState(
    () => !readCachedPublicTourStatsIndex(),
  );
  const [tours, setTours] = useState(() => {
    const cached = readCachedPublicTourStatsIndex();
    return cached
      ? sortPublicTourIndex(Array.isArray(cached.tours) ? cached.tours : [])
      : [];
  });
  const [defaultTourSlug, setDefaultTourSlug] = useState(() => {
    const cached = readCachedPublicTourStatsIndex();
    if (!cached) return '';
    return resolveDefaultPublicTourSlug(
      sortPublicTourIndex(Array.isArray(cached.tours) ? cached.tours : []),
      cached.defaultTourSlug,
    );
  });
  const trimmedRoute = (routeSlug || '').trim();
  const [doc, setDoc] = useState(() =>
    trimmedRoute ? readCachedPublicTourStatsDoc(trimmedRoute) : null,
  );
  const [statsLoading, setStatsLoading] = useState(() => {
    if (trimmedRoute && readCachedPublicTourStatsDoc(trimmedRoute)) return false;
    return true;
  });
  const [error, setError] = useState(null);
  // Wait for index before picking a default so we don't flash the wrong tour.
  const activeSlug =
    trimmedRoute || (indexLoading ? '' : defaultTourSlug);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!readCachedPublicTourStatsIndex()) setIndexLoading(true);
      try {
        const idx = await fetchPublicTourStatsIndex();
        if (cancelled) return;
        const list = sortPublicTourIndex(Array.isArray(idx.tours) ? idx.tours : []);
        setTours(list);
        setDefaultTourSlug(
          resolveDefaultPublicTourSlug(list, idx.defaultTourSlug),
        );
        writeCachedPublicTourStatsIndex(idx);
        void fetchPublicTourStatsIndex({ skipCdn: true }).then((fresh) => {
          if (cancelled || !fresh) return;
          const next = sortPublicTourIndex(
            Array.isArray(fresh.tours) ? fresh.tours : [],
          );
          setTours(next);
          setDefaultTourSlug(
            resolveDefaultPublicTourSlug(next, fresh.defaultTourSlug),
          );
          writeCachedPublicTourStatsIndex(fresh);
        });
      } catch (err) {
        if (!cancelled && !readCachedPublicTourStatsIndex()) setError(err);
      } finally {
        if (!cancelled) setIndexLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!activeSlug) {
      setStatsLoading(indexLoading);
      if (!indexLoading) setDoc(null);
      return undefined;
    }
    const cached = readCachedPublicTourStatsDoc(activeSlug);
    if (cached) {
      setDoc(cached);
      setStatsLoading(false);
    } else {
      setStatsLoading(true);
    }
    setError(null);
    (async () => {
      try {
        const data = await fetchPublicTourStatsDoc(activeSlug);
        if (cancelled) return;
        if (data) {
          setDoc(data);
          writeCachedPublicTourStatsDoc(activeSlug, data);
        } else if (!cached) {
          setDoc(null);
        }
        void fetchPublicTourStatsDoc(activeSlug, { skipCdn: true }).then(
          (fresh) => {
            if (cancelled || !fresh) return;
            if (fresh.writtenAt && data?.writtenAt === fresh.writtenAt) return;
            setDoc(fresh);
            writeCachedPublicTourStatsDoc(activeSlug, fresh);
          },
        );
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err);
          setDoc(null);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSlug, indexLoading]);

  const stats = useMemo(() => {
    if (!doc) {
      return {
        tourShowCount: 0,
        showsWithSetlist: 0,
        uniqueSongs: 0,
        totalSongPlays: 0,
        topSongs: [],
        bustouts: [],
        gapHighlights: [],
      };
    }
    return {
      tourShowCount: Number(doc.tourShowCount) || 0,
      showsWithSetlist: Number(doc.showsWithSetlist) || 0,
      uniqueSongs: Number(doc.uniqueSongs) || 0,
      totalSongPlays: Number(doc.totalSongPlays) || 0,
      topSongs: Array.isArray(doc.topSongs) ? doc.topSongs : [],
      bustouts: Array.isArray(doc.bustouts) ? doc.bustouts : [],
      gapHighlights: Array.isArray(doc.gapHighlights) ? doc.gapHighlights : [],
    };
  }, [doc]);

  const tourName =
    (doc && typeof doc.tourLabel === 'string' && doc.tourLabel) ||
    tours.find((t) => t.tourSlug === activeSlug)?.tourLabel ||
    activeSlug;

  const wrap = useMemo(
    () => buildFinishedTourWrap(doc, { slug: activeSlug }),
    [doc, activeSlug],
  );
  const shareImageUrl = wrap?.slug
    ? finishedTourWrapShareImageUrl(wrap.slug, {
        siteUrl: SEO_CONFIG.siteUrl,
        version: typeof doc?.writtenAt === 'string' ? doc.writtenAt : '',
      })
    : null;

  const selectTour = (slug) => {
    const next = String(slug ?? '').trim();
    if (!next) return;
    // Always slug URLs (#929) — default/current tour used to collapse to
    // `/tour-stats`, which hid the summer SEO page behind the hub.
    navigate(publicTourStatsPathForSlug(next), { replace: false });
  };

  return {
    activeSlug,
    routeHasSlug: Boolean(trimmedRoute),
    defaultTourSlug,
    tours,
    tourName,
    hasTour: Boolean(doc),
    indexLoading,
    statsLoading,
    error,
    stats,
    wrap,
    shareImageUrl,
    selectTour,
  };
}

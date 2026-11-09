import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../../shared/lib/firebase';
import { whenFirebaseReady } from '../../../shared/lib/firebaseAppCheck';
import { pickCountsTowardSeason } from '../../../shared/utils/showAggregation';
import { normalizeOfficialSetlistDocData } from '../../scoring';
import {
  aggregatePickSongStats,
  PROFILE_TOP_PICKS_N,
} from '../model/aggregatePickSongStats';

/**
 * Interim live-compute budget for self Profile heatmap (#553).
 * Caps graded shows (newest first) so profile views stay bounded.
 */
export const PROFILE_PICK_HEATMAP_MAX_SHOWS = 40;

/**
 * @typedef {Object} ProfilePickHeatmapResult
 * @property {import('../model/aggregatePickSongStats').PickSongStatRow[]} rows
 * @property {string[]} songTitles
 * @property {number} showsAggregated
 * @property {number} showsAvailable
 * @property {number} setlistReads
 * @property {'live'} source
 */

/**
 * @typedef {Object} ProfilePickHeatmapTelemetry
 * @property {number} shows_checked
 * @property {number} shows_played
 * @property {number} collection_queries
 * @property {number} setlist_reads
 * @property {'live'} source
 */

/**
 * Live-compute top pick frequency for a user (self Profile interim path).
 *
 * Read budget: 1 `picks where userId == uid` query + up to
 * `PROFILE_PICK_HEATMAP_MAX_SHOWS` `official_setlists/{date}` point reads.
 *
 * @param {string | undefined} uid
 * @param {{
 *   maxShows?: number,
 *   topN?: number,
 *   onTelemetry?: (t: ProfilePickHeatmapTelemetry) => void,
 * }} [options]
 * @returns {Promise<ProfilePickHeatmapResult>}
 */
export async function computeProfilePickHeatmap(uid, options = {}) {
  const maxShows =
    typeof options.maxShows === 'number' && options.maxShows > 0
      ? Math.trunc(options.maxShows)
      : PROFILE_PICK_HEATMAP_MAX_SHOWS;
  const topN =
    typeof options.topN === 'number' && options.topN > 0
      ? Math.trunc(options.topN)
      : PROFILE_TOP_PICKS_N;

  /** @type {ProfilePickHeatmapTelemetry} */
  const telemetry = {
    shows_checked: 0,
    shows_played: 0,
    collection_queries: 0,
    setlist_reads: 0,
    source: 'live',
  };
  const emit = () => {
    if (typeof options.onTelemetry === 'function') {
      try {
        options.onTelemetry(telemetry);
      } catch (err) {
        console.warn('computeProfilePickHeatmap telemetry failed:', err);
      }
    }
  };

  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) {
    emit();
    return {
      rows: [],
      songTitles: [],
      showsAggregated: 0,
      showsAvailable: 0,
      setlistReads: 0,
      source: 'live',
    };
  }

  await whenFirebaseReady();

  const picksSnap = await getDocs(
    query(collection(db, 'picks'), where('userId', '==', id))
  );
  telemetry.collection_queries = 1;
  telemetry.shows_checked = picksSnap.size;

  const graded = [];
  for (const pickDoc of picksSnap.docs) {
    const data = pickDoc.data() || {};
    if (!pickCountsTowardSeason(data)) continue;
    graded.push({
      showDate: typeof data.showDate === 'string' ? data.showDate : '',
      picks: data.picks && typeof data.picks === 'object' ? data.picks : {},
    });
  }
  graded.sort((a, b) => (a.showDate < b.showDate ? 1 : a.showDate > b.showDate ? -1 : 0));
  const capped = graded.slice(0, maxShows);
  telemetry.shows_played = capped.length;

  /** @type {Map<string, Record<string, unknown>>} */
  const setlistsByDate = new Map();
  const dates = [
    ...new Set(capped.map((p) => p.showDate).filter(Boolean)),
  ];
  const chunkSize = 12;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const slice = dates.slice(i, i + chunkSize);
    const snaps = await Promise.all(
      slice.map((date) => getDoc(doc(db, 'official_setlists', date)))
    );
    telemetry.setlist_reads += slice.length;
    for (let j = 0; j < slice.length; j += 1) {
      const snap = snaps[j];
      if (!snap.exists()) continue;
      const normalized = normalizeOfficialSetlistDocData(snap.data() || {}, slice[j]);
      if (normalized) setlistsByDate.set(slice[j], normalized);
    }
  }

  const aggregated = aggregatePickSongStats(capped, setlistsByDate, { topN });
  emit();
  return {
    ...aggregated,
    showsAvailable: graded.length,
    setlistReads: telemetry.setlist_reads,
    source: 'live',
  };
}

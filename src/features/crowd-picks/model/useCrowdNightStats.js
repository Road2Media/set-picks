import { useMemo } from 'react';

import { sanitizeSongGaps } from '../../../shared/utils/officialSetlistSanitize';
import { useSongCatalog } from '../../song-catalog';

import { aggregateCrowdNightCatalog } from './aggregateCrowdNightCatalog';
import {
  aggregateCrowdNightSongs,
  crowdNightCardSummary,
  enrichSongRowsWithCatalog,
  enrichTopMultiWithCatalog,
} from './aggregateCrowdNightSongs';
import {
  aggregateLeadersTonightPicks,
  LEADERS_TOP_K,
} from './aggregateLeadersTonightPicks';
import { buildOfficialPlayedTitleSet } from './buildOfficialPlayedTitleSet';
import { buildCrowdNightDeepDive } from './crowdNightDeepDive';

/** Visible teaser row count on Standings crowd pulse. */
export const CROWD_PULSE_TOP_N = 5;

/** Cap for “All multi-picker songs” in full stats. */
export const CROWD_PULSE_MULTI_FULL_N = 20;

/** Cap for leaders song list in full stats. */
export const CROWD_PULSE_LEADERS_SONGS_N = 12;

/**
 * Compose C1–C3 crowd night stats for a show date (#694 / Standings).
 *
 * @param {string} showDate
 * @param {Array<Record<string, unknown>> | null | undefined} pickDocs
 * @param {Array<{ uid: string, handle?: string, totalPoints?: number }> | null | undefined} tourLeaders
 * @param {{
 *   songGaps?: Record<string, number> | null,
 * } | null | undefined} [actualSetlist] — when present, frozen pre-show
 *   `songGaps` override live catalog gap (historical nights).
 */
export function useCrowdNightStats(
  showDate,
  pickDocs,
  tourLeaders,
  actualSetlist = null
) {
  const { songs: catalogSongs, isLoading: catalogLoading } = useSongCatalog();

  return useMemo(() => {
    if (!showDate) {
      return {
        ready: false,
        catalogLoading,
        card: null,
        night: null,
        catalog: null,
        leaders: null,
        playedTitles: null,
        deepDive: null,
      };
    }

    const frozenGaps = sanitizeSongGaps(actualSetlist?.songGaps);
    const enrichOpts = { frozenGaps };
    const playedTitles = buildOfficialPlayedTitleSet(actualSetlist);

    const night = aggregateCrowdNightSongs(showDate, pickDocs);
    const baseCard = crowdNightCardSummary(night, { topN: CROWD_PULSE_TOP_N });
    const card = {
      ...baseCard,
      topMulti: enrichTopMultiWithCatalog(
        baseCard.topMulti,
        catalogSongs,
        enrichOpts
      ),
    };

    const baseCatalog = aggregateCrowdNightCatalog(night, catalogSongs, {
      gapTopN: 10,
      frozenGaps,
    });
    /** @type {Map<string, number>} */
    const pctByKey = new Map(
      (night.songs || []).map((s) => [
        String(s.title || '')
          .trim()
          .toLowerCase(),
        s.pctOfPickers,
      ])
    );
    const catalog = {
      ...baseCatalog,
      highestGap: enrichSongRowsWithCatalog(
        (baseCatalog.highestGap || []).map((s) => ({
          title: s.title,
          cardCount: s.cardCount,
          gap: s.gap,
          pctOfPickers:
            pctByKey.get(
              String(s.title || '')
                .trim()
                .toLowerCase()
            ) ?? 0,
        })),
        catalogSongs,
        enrichOpts
      ),
    };

    const baseLeaders = aggregateLeadersTonightPicks(tourLeaders, pickDocs, {
      topK: LEADERS_TOP_K,
    });
    const leaders = {
      ...baseLeaders,
      songs: enrichSongRowsWithCatalog(
        (baseLeaders.songs || [])
          .slice(0, CROWD_PULSE_LEADERS_SONGS_N)
          .map((s) => ({
            title: s.title,
            cardCount: s.cardCount,
            subtitle:
              Array.isArray(s.amongLeaders) && s.amongLeaders.length
                ? s.amongLeaders.join(', ')
                : null,
          })),
        catalogSongs,
        enrichOpts
      ),
    };

    const multiPickerFull = enrichSongRowsWithCatalog(
      night.multiPickerSongs.slice(0, CROWD_PULSE_MULTI_FULL_N),
      catalogSongs,
      enrichOpts
    );

    const deepDive = buildCrowdNightDeepDive({
      songs: night.songs,
      pickers: night.pickers,
      submittedDocs: night.submittedDocs,
      actualSetlist,
    });

    return {
      ready: true,
      catalogLoading,
      card,
      night: {
        ...night,
        multiPickerFull,
      },
      catalog,
      leaders,
      playedTitles,
      deepDive,
    };
  }, [
    showDate,
    pickDocs,
    tourLeaders,
    actualSetlist,
    catalogSongs,
    catalogLoading,
  ]);
}

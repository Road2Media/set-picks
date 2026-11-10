import React from 'react';

import { Panel } from '../../../shared/ui/Card';
import InfoTooltip, {
  InfoTooltipProvider,
} from '../../../shared/ui/InfoTooltip';
import { useSongCatalog } from '../../song-catalog';
import {
  buildDebutYearBySongName,
  computeAvgCorrectPicksPerShow,
  computeAvgPointsPerShow,
  computeAvgSongVintage,
  formatAvgCorrectPicksPerShow,
  formatAvgPointsPerShow,
  formatAvgSongVintage,
} from '../model/profileAverages';
import { useProfilePickHeatmap } from '../model/useProfilePickHeatmap';
import { useUserSeasonStats } from '../model/useUserSeasonStats';
import TopPicksFrequencyStrip from './TopPicksFrequencyStrip';

/**
 * Self-Profile stats: season averages + top-picks frequency strip (#553 / #554).
 * Heatmap is self-only (live-compute); public profile stays on the lighter strip.
 *
 * @param {{ uid?: string, section?: 'all' | 'stats' | 'picks' }} props
 */
export default function ProfileSelfStatsPanel({ uid, section = 'all' }) {
  const { stats, loading: statsLoading } = useUserSeasonStats(uid);
  const heatmap = useProfilePickHeatmap(uid, { enabled: Boolean(uid) });
  const { songs } = useSongCatalog();

  const debutMap = buildDebutYearBySongName(songs);
  const vintage = computeAvgSongVintage(heatmap.songTitles, debutMap);

  const avgPoints = formatAvgPointsPerShow(computeAvgPointsPerShow(stats));
  const avgCorrect = formatAvgCorrectPicksPerShow(
    computeAvgCorrectPicksPerShow(stats)
  );
  const avgVintage = formatAvgSongVintage(vintage.avgYear);

  const vintageDefinition =
    vintage.datedCount > 0
      ? `Average debut year of songs in your recent top picks (${vintage.datedCount} of ${vintage.uniqueCount} have a debut year).`
      : 'Average debut year of songs in your recent top picks.';

  const columns = [
    {
      key: 'avgPts',
      label: 'Points per show',
      value: avgPoints,
      definition:
        'Like points per game in basketball: average points per scored show across your career.',
    },
    {
      key: 'avgCorrect',
      label: 'Picking average',
      value: avgCorrect,
      definition:
        'Like a batting average in baseball: lifetime correct picks divided by total picks across your scored shows. .500 means half your picks hit. The shows count updates after each scored night.',
    },
    {
      key: 'vintage',
      label: 'Avg vintage',
      value: avgVintage,
      definition: vintageDefinition,
    },
    {
      key: 'shows',
      label: 'Shows',
      value: typeof stats?.shows === 'number' ? stats.shows : 0,
      definition: 'Nights you played that have a score.',
    },
  ];

  if (!uid) return null;

  const showStats = section === 'all' || section === 'stats';
  const showPicks = section === 'all' || section === 'picks';

  return (
    <div className={section === 'all' ? 'mb-8' : undefined}>
      <Panel as="section" hidden={!showStats}>
        <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-content-secondary">
          Your stats
        </h2>
        <InfoTooltipProvider>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {columns.map(({ key, label, value, definition }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex flex-1 items-end justify-center gap-1 px-0.5">
                  <p className="text-[10px] font-black uppercase leading-snug tracking-wider text-content-secondary">
                    {label}
                  </p>
                  <InfoTooltip label={label} definition={definition} />
                </div>
                <div className="flex min-h-13 items-center justify-center rounded-2xl border border-border-subtle/50 bg-surface-field px-2 py-3">
                  <span className="text-2xl font-black tabular-nums leading-none tracking-tight text-brand-primary">
                    {statsLoading && key !== 'vintage' ? '…' : value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </InfoTooltipProvider>
      </Panel>

      <div hidden={!showPicks}>
        <TopPicksFrequencyStrip
          rows={heatmap.rows}
          loading={heatmap.loading}
          showsAggregated={heatmap.showsAggregated}
          showsAvailable={heatmap.showsAvailable}
          flushTop={section !== 'all'}
        />
      </div>
    </div>
  );
}

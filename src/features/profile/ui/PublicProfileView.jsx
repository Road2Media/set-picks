import React from 'react';
import { Loader2 } from 'lucide-react';

import { formatMonthYear } from '../../../shared';
import BackButton from '../../../shared/ui/BackButton';
import { Panel } from '../../../shared/ui/Card';
import InfoTooltip, {
  InfoTooltipProvider,
} from '../../../shared/ui/InfoTooltip';
import {
  computeAvgCorrectPicksPerShow,
  computeAvgPointsPerShow,
  formatAvgCorrectPicksPerShow,
  formatAvgPointsPerShow,
} from '../model/profileAverages';
import BadgeShelf from './BadgeShelf';
import ProfileAvatar from './ProfileAvatar';

function formatPlayingSince(createdAt) {
  const value = formatMonthYear(createdAt);
  return value || null;
}

/**
 * Read-only public profile: handle, favorite song, pools, and season stats.
 * Stats are the global cross-pool view (points from the user's own graded
 * picks, overall shows won, and shows played) — `wins` counts each night
 * once based on the global high score, not per-pool.
 */
export default function PublicProfileView({
  profile,
  userPools = [],
  stats,
  statsLoading = false,
}) {
  if (!profile) return null;

  const handle = profile.handle?.trim() || 'Anonymous';
  const playingSince = formatPlayingSince(profile.createdAt);
  const favoriteSong =
    profile.favoriteSong &&
    String(profile.favoriteSong).trim() !== '' &&
    profile.favoriteSong !== 'Unknown'
      ? profile.favoriteSong
      : null;

  const totalPoints =
    typeof stats?.totalPoints === 'number' ? stats.totalPoints : 0;
  const wins = typeof stats?.wins === 'number' ? stats.wins : 0;
  const shows = typeof stats?.shows === 'number' ? stats.shows : 0;
  const avgPointsDisplay = formatAvgPointsPerShow(
    computeAvgPointsPerShow(stats)
  );
  const avgCorrectDisplay = formatAvgCorrectPicksPerShow(
    computeAvgCorrectPicksPerShow(stats)
  );

  const statColumns = [
    {
      key: 'points',
      label: 'Total points',
      value: totalPoints,
      definition: 'Career points across every scored show.',
    },
    {
      key: 'avg',
      label: 'Points per show',
      value: avgPointsDisplay,
      definition:
        'Like points per game in basketball: average points per scored show.',
    },
    {
      key: 'avgCorrect',
      label: 'Picking average',
      value: avgCorrectDisplay,
      definition:
        'Like a batting average in baseball: lifetime correct picks divided by total picks across scored shows. .500 means half of your picks hit.',
    },
    {
      key: 'wins',
      label: 'Wins',
      value: wins,
      definition:
        'Nights with the overall top score across all players — not just within a single pool.',
    },
    {
      key: 'shows',
      label: 'Shows',
      value: shows,
      definition: 'Nights with a score.',
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="max-w-xl mx-auto px-4 py-10 pb-16">
        <BackButton className="mb-8" />

        <header className="mb-2 flex items-start gap-4">
          <ProfileAvatar
            avatarId={profile.avatarId}
            size="lg"
            alt={`${handle}'s avatar`}
          />
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-bold italic text-transparent bg-clip-text bg-linear-to-r from-red-500 to-blue-500">
              {handle}
            </h1>
            {playingSince && (
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-primary">
                Playing since {playingSince}
              </p>
            )}
          </div>
        </header>

        <Panel as="section" className="mt-8">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-content-secondary">
            Favorite song
          </h2>
          <p className="text-lg font-bold text-white">
            {favoriteSong || 'Not chosen yet'}
          </p>
        </Panel>

        <Panel as="section" className="mt-6">
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-content-secondary">
            Active pools
          </h2>
          {userPools.length === 0 ? (
            <p className="text-sm font-bold text-content-secondary">
              Not in any pools
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userPools.map((pool) => (
                <span
                  key={pool.id}
                  className="inline-flex items-center rounded-full border border-border-subtle/50 bg-surface-panel-strong/72 px-3 py-1 text-xs font-bold text-brand-primary"
                >
                  {pool.name || 'Unnamed pool'}
                </span>
              ))}
            </div>
          )}
        </Panel>

        <Panel as="section" className="mt-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-content-secondary">
            Stats
          </h2>
          <InfoTooltipProvider>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              {statColumns.map(({ key, label, value, definition }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex flex-1 items-end justify-center gap-1 px-0.5">
                    <p className="text-[10px] font-black uppercase leading-snug tracking-wider text-content-secondary">
                      {label}
                    </p>
                    <InfoTooltip label={label} definition={definition} />
                  </div>
                  <div className="flex min-h-13 items-center justify-center rounded-2xl border border-border-subtle/50 bg-surface-field px-2 py-3">
                    {statsLoading ? (
                      <Loader2
                        className="h-5 w-5 shrink-0 animate-spin text-brand-primary"
                        aria-label={`Loading ${label}`}
                      />
                    ) : (
                      <span className="text-2xl font-black tabular-nums leading-none tracking-tight text-brand-primary">
                        {value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </InfoTooltipProvider>
        </Panel>

        <BadgeShelf badges={profile.badges} surface="public_profile" />
      </div>
    </div>
  );
}

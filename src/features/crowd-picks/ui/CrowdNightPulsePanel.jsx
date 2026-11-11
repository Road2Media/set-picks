import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock, Radio } from 'lucide-react';

import { crowdNightStatsHref } from '../../../shared/config/dashboardRoutes';
import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_CHEVRON,
  DASHBOARD_CARD_EYEBROW,
  DASHBOARD_CARD_L2_MIN_H,
} from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import {
  trackCrowdPulseFullExpand,
  trackCrowdPulseTeaserExpand,
  trackCrowdPulseView,
} from '../model/crowdPulseAnalytics';
import CrowdPulseTopTable from './CrowdPulseTopTable';

/**
 * Crowd pulse summary on Standings (#694).
 * Collapsed by default. Expanding shows the top multi-picker table and a
 * link to the Stats night deep dive. Named chalk stays blurred pre-lock.
 * Presentational — data from `useCrowdNightStats`.
 *
 * @param {object} props
 * @param {string} [props.showDate]
 * @param {import('../model/aggregateCrowdNightSongs').CrowdNightSongStats | null} props.night
 * @param {{ pickers: number, uniqueSongs: number, topMulti: Array<{ title: string, cardCount: number, pctOfPickers: number, gap?: number | null, last?: string | null }> } | null} props.card
 * @param {boolean} [props.catalogLoading]
 * @param {boolean} [props.blurDeepStats] — true while picks still editable (NEXT)
 * @param {Set<string> | null} [props.playedTitles] — official setlist hits (LIVE + PAST)
 * @param {string} [props.className]
 */
export default function CrowdNightPulsePanel({
  showDate = '',
  night,
  card,
  catalogLoading = false,
  blurDeepStats = false,
  playedTitles = null,
  className = '',
}) {
  const pickers = card && night && night.pickers > 0 ? card.pickers : 0;

  useCrowdPulseViewTelemetry(showDate, blurDeepStats, pickers);

  if (!card || !night || night.pickers === 0) {
    return (
      <DashboardJobShell
        as="section"
        tone="teal"
        pad="label"
        className={`flex ${DASHBOARD_CARD_L2_MIN_H} flex-col justify-center ${className}`}
        aria-label="Crowd pulse"
      >
        <p
          className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
        >
          <Radio className={DASHBOARD_JOB_ICON} aria-hidden />
          Crowd pulse
        </p>
        <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
          No submitted picks for this show yet.
        </p>
      </DashboardJobShell>
    );
  }

  const showPlayedLegend =
    playedTitles instanceof Set && playedTitles.size > 0;
  const topSong = card.topMulti[0] || null;
  const statsHref = crowdNightStatsHref(showDate);

  const onPanelToggle = (event) => {
    if (event.currentTarget.open) {
      trackCrowdPulseTeaserExpand({
        show_date: showDate || '',
        deep_stats: blurDeepStats ? 'locked' : 'open',
        via: 'summary',
      });
    }
  };

  const onFullStatsClick = () => {
    if (blurDeepStats) {
      trackCrowdPulseTeaserExpand({
        show_date: showDate || '',
        deep_stats: 'locked',
        via: 'full_link',
      });
      return;
    }
    trackCrowdPulseFullExpand({
      show_date: showDate || '',
      deep_stats: 'open',
    });
  };

  return (
    <DashboardJobShell
      as="section"
      tone="teal"
      pad="label"
      className={`flex ${DASHBOARD_CARD_L2_MIN_H} flex-col justify-center ${className}`}
      aria-label="Crowd pulse"
    >
      <details className="group/pulse" onToggle={onPanelToggle}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`inline-flex shrink-0 items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
            >
              <Radio className={DASHBOARD_JOB_ICON} aria-hidden />
              Crowd pulse
            </p>
            <p className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-content-secondary">
              {card.pickers} pickers · {card.uniqueSongs} songs
              <ChevronDown
                className={`${DASHBOARD_CARD_CHEVRON} group-open/pulse:rotate-180`}
                aria-hidden
              />
            </p>
          </div>
          {topSong ? (
            <p className={`mt-0.5 truncate ${DASHBOARD_CARD_BODY}`}>
              <BlurredSongTitle
                title={topSong.title}
                blur={blurDeepStats}
                tone="blue"
              />{' '}
              leads on {topSong.cardCount} cards
            </p>
          ) : (
            <p className={`mt-0.5 truncate ${DASHBOARD_CARD_BODY}`}>
              No multi-picker songs yet (everyone unique).
            </p>
          )}
        </summary>

        {showPlayedLegend ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-content-secondary">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs bg-brand-primary/80"
              aria-hidden
            />
            Highlight = played in setlist
          </p>
        ) : null}

        {card.topMulti.length > 0 ? (
          <CrowdPulseTopTable
            rows={card.topMulti}
            playedTitles={playedTitles}
            catalogLoading={catalogLoading}
            blurSongTitles={blurDeepStats}
          />
        ) : (
          <p className="mt-2 text-[11px] text-content-secondary">
            No multi-picker songs yet (everyone unique).
          </p>
        )}

        <Link
          to={statsHref}
          onClick={onFullStatsClick}
          className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle/50 pt-2 text-[10px] font-black uppercase tracking-widest text-brand-primary"
        >
          <span className="inline-flex items-center gap-1.5">
            Full crowd stats
            {blurDeepStats ? (
              <Lock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            ) : null}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
        {blurDeepStats ? (
          <p className="mt-1 text-[10px] font-medium text-content-secondary">
            Names, vintage, and tour leaders unlock at showtime
          </p>
        ) : null}
      </details>
    </DashboardJobShell>
  );
}

/**
 * @param {string} showDate
 * @param {boolean} blurDeepStats
 * @param {number} pickers
 */
function useCrowdPulseViewTelemetry(showDate, blurDeepStats, pickers) {
  const viewLoggedRef = useRef('');
  useEffect(() => {
    if (!showDate) return;
    const deep_stats = blurDeepStats ? 'locked' : 'open';
    const sig = `${showDate}|${deep_stats}|${pickers}`;
    if (viewLoggedRef.current === sig) return;
    viewLoggedRef.current = sig;
    trackCrowdPulseView({
      show_date: showDate,
      deep_stats,
      pickers,
      surface: 'standings',
    });
  }, [showDate, blurDeepStats, pickers]);
}

/**
 * @param {{ title: string, blur?: boolean, tone?: 'red' | 'blue' }} props
 */
function BlurredSongTitle({ title, blur = false, tone = 'red' }) {
  const toneClass = tone === 'blue' ? 'text-brand-accent-blue' : 'text-white';
  return (
    <>
      <span
        className={`${toneClass} ${
          blur ? 'inline select-none blur-[5px]' : 'inline'
        }`}
        aria-hidden={blur || undefined}
      >
        “{title}”
      </span>
      {blur ? (
        <span className="sr-only">Song title hidden until showtime</span>
      ) : null}
    </>
  );
}

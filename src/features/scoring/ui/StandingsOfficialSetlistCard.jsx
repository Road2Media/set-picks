import React, { useEffect, useRef } from 'react';
import { ChevronDown, ExternalLink, ListMusic } from 'lucide-react';

import {
  FeatureNewBadge,
  useFeatureSpotlight,
} from '../../feature-discovery';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import { SCORING_RULES } from '../../../shared/utils/scoring';
import { buildPhishNetSetlistUrl } from '../model/buildPhishNetSetlistUrl';
import {
  buildBustoutTitleSet,
  buildSongGapMap,
  getOfficialSetlistGap,
  groupOfficialSetlistBySet,
  isOfficialSetlistBustout,
} from '../model/groupOfficialSetlistBySet';
import {
  resolveLiveSetlistStatus,
  trackLiveSetlistView,
} from '../model/standingsAnalytics';
import OfficialPickSlotsGrid from './OfficialPickSlotsGrid';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_BOX_CHEVRON,
  STANDINGS_BOX_EYEBROW,
  STANDINGS_BOX_L2_MIN_H,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

const { BUSTOUT_MIN_GAP } = SCORING_RULES;

/** Invisible 4-col grid per row: # | title | gap | bustout — fixed tracks keep columns aligned. */
const SETLIST_ROW_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_4.75rem_4.5rem] items-center gap-x-2 min-h-7';

function SetSongList({ label, songs, bustoutTitleSet, gapMap }) {
  if (!songs.length) return null;
  return (
    <div>
      <p className={`mb-1.5 ${STANDINGS_BOX_EYEBROW} text-brand-primary`}>
        {label}
      </p>
      <div
        className={`${SETLIST_ROW_GRID} mb-0.5 border-b border-border-subtle/60 pb-1 ${STANDINGS_BOX_EYEBROW} text-content-secondary`}
        aria-hidden
      >
        <span className="tabular-nums">#</span>
        <span>Song</span>
        <span className="justify-self-end">Gap</span>
        <span
          className="justify-self-end"
          title={`Pre-show gap ≥ ${BUSTOUT_MIN_GAP} shows — Bustout Boost eligible`}
        >
          Bustout
        </span>
      </div>
      <ol className={`space-y-0.5 ${STANDINGS_BOX_BODY} text-slate-100`}>
        {songs.map((title, idx) => {
          const isBustout = isOfficialSetlistBustout(title, bustoutTitleSet);
          const gap = getOfficialSetlistGap(title, gapMap);
          return (
            <li
              key={`${label}-${idx}-${title}`}
              className={SETLIST_ROW_GRID}
            >
              <span className="tabular-nums text-content-secondary">
                {idx + 1}
              </span>
              <span className="min-w-0 truncate">{title}</span>
              <span
                className="justify-self-end tabular-nums text-[11px] font-semibold text-content-secondary"
                title={
                  gap != null
                    ? `${gap} shows since last played (pre-show gap)`
                    : undefined
                }
              >
                {gap != null ? gap : '\u00a0'}
              </span>
              <span className="justify-self-end">
                {isBustout ? (
                  <span
                    className="inline-block rounded-full border border-orange-300/40 bg-orange-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-100"
                    title="Bustout Boost eligibility"
                  >
                    Bustout
                  </span>
                ) : (
                  '\u00a0'
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Collapsible live / official setlist + official pick-slot board for Standings (#552).
 * Presentational only — consumes `actualSetlist` already loaded by `useStandings`.
 *
 * @param {object} props
 * @param {object} props.actualSetlist
 * @param {string} [props.showDate] — YYYY-MM-DD for Phish.net setlist link
 * @param {string} [props.showLabel]
 * @param {string} [props.showStatus] — NEXT | LIVE | PAST | FUTURE
 * @param {string} [props.className]
 */
export default function StandingsOfficialSetlistCard({
  actualSetlist,
  showDate = '',
  showLabel = '',
  showStatus = '',
  className = '',
}) {
  const grouped = groupOfficialSetlistBySet(actualSetlist);
  const bustoutTitleSet = buildBustoutTitleSet(actualSetlist);
  const gapMap = buildSongGapMap(actualSetlist);
  const viewLoggedRef = useRef('');
  const setlistSpotlight = useFeatureSpotlight('live-setlist');

  const hasContent =
    Boolean(actualSetlist) &&
    (grouped.hasSongs || grouped.hasOfficialSlots);
  const isLive = showStatus === 'LIVE';

  useEffect(() => {
    if (!hasContent) return;
    const setlistStatus = resolveLiveSetlistStatus(showStatus);
    const sig = `${showDate}|${setlistStatus}`;
    if (viewLoggedRef.current === sig) return;
    viewLoggedRef.current = sig;
    trackLiveSetlistView({
      show_date: showDate || '',
      setlist_status: setlistStatus,
    });
  }, [hasContent, showDate, showStatus]);

  if (!hasContent) {
    return null;
  }

  const statusLabel = isLive ? 'Live' : showStatus === 'PAST' ? 'Final' : 'Official';
  const phishNetHref = buildPhishNetSetlistUrl(showDate);

  const onDetailsToggle = () => {
    if (setlistSpotlight.active) {
      setlistSpotlight.markSeen();
    }
  };

  return (
    <DashboardJobShell
      as="section"
      tone="teal"
      pad="label"
      className={`mb-3 flex ${STANDINGS_BOX_L2_MIN_H} flex-col justify-center ${className}`.trim()}
    >
      <details
        className="group"
        defaultOpen={isLive}
        onToggle={onDetailsToggle}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ListMusic
                className={`${DASHBOARD_JOB_ICON} text-brand-primary`}
                aria-hidden
              />
              <p className={`${STANDINGS_BOX_EYEBROW} text-brand-primary`}>
                Setlist
              </p>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  isLive
                    ? 'border-brand-primary/40 bg-brand-primary/15 text-brand-primary'
                    : 'border-border-subtle/50 bg-surface-inset/72 text-content-secondary'
                }`}
              >
                {statusLabel}
              </span>
              {setlistSpotlight.active ? (
                <FeatureNewBadge title="New: live official setlist" />
              ) : null}
            </div>
            {showLabel ? (
              <p className={`truncate ${STANDINGS_BOX_TITLE}`}>{showLabel}</p>
            ) : (
              <p className={STANDINGS_BOX_TITLE}>Official setlist</p>
            )}
          </div>
          <ChevronDown
            className={`mt-0.5 ${STANDINGS_BOX_CHEVRON} group-open:rotate-180`}
            aria-hidden
          />
        </summary>

        <div className="mt-4 space-y-5 border-t border-border-subtle/50 pt-4">
          {grouped.hasSongs ? (
            <div className="space-y-4">
              <SetSongList
                label="Set 1"
                songs={grouped.set1}
                bustoutTitleSet={bustoutTitleSet}
                gapMap={gapMap}
              />
              <SetSongList
                label="Set 2"
                songs={grouped.set2}
                bustoutTitleSet={bustoutTitleSet}
                gapMap={gapMap}
              />
              <SetSongList
                label="Encore"
                songs={grouped.encore}
                bustoutTitleSet={bustoutTitleSet}
                gapMap={gapMap}
              />
              <p className="text-[11px] font-semibold leading-relaxed text-content-secondary">
                Gap = shows since last played before this night. Bustout = gap ≥{' '}
                {BUSTOUT_MIN_GAP} (Bustout Boost eligible).
              </p>
            </div>
          ) : (
            <p className={STANDINGS_BOX_BODY}>
              Slot picks are in — full song order lands as the setlist builds.
            </p>
          )}

          <div>
            <p className={`mb-2 ${STANDINGS_BOX_EYEBROW} text-content-secondary`}>
              Official pick slots
            </p>
            <OfficialPickSlotsGrid actualSetlist={actualSetlist} />
          </div>

          <p className="text-xs font-semibold leading-relaxed text-content-secondary">
            Setlist data courtesy of Phish.net.{' '}
            <a
              href={phishNetHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-white hover:decoration-teal-300"
            >
              See more show details on Phish.net
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </div>
      </details>
    </DashboardJobShell>
  );
}

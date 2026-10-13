import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import Card from '../../../shared/ui/Card';
import InfoTooltip, {
  InfoTooltipProvider,
} from '../../../shared/ui/InfoTooltip';
import {
  formatAvgCorrectPicksPerShow,
  PROFILE_SLOTS_PER_SHOW,
} from '../../profile/averages';
import { formatFanShowDate, formatFanShowMonthDay } from '../../../shared/utils/dateUtils';
import { SCORING_RULES } from '../../../shared/utils/scoring';
import {
  DASHBOARD_CARD_EYEBROW as STANDINGS_BOX_EYEBROW,
  DASHBOARD_CARD_SHELL as STANDINGS_CARD_SHELL,
} from '../../../shared/ui/dashboardCardClasses';
import {
  TOUR_STATS_GAP_HIGHLIGHT_MIN,
  TOUR_STATS_TOP_N,
} from '../model/aggregateTourSetlistStats';

const { BUSTOUT_MIN_GAP } = SCORING_RULES;

/**
 * Fixed meta tracks (not `auto`) so the header grid and each data row share
 * the same column widths — independent `auto` grids were shifting Date/Gap/Last
 * headers left of their cells. `whitespace-nowrap` keeps MM/DD / MM/DD/YY on
 * one line at 11px. Slashes are the same character count as the old hyphens,
 * so the 2.75rem and 4.75rem tracks still hold.
 */
const TOP_SONGS_ROW_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_2.5rem] items-center gap-x-2 min-h-[1.75rem]';

/**
 * Bustouts / High gaps: Song | Date (MM/DD) | Gap | Last (MM/DD/YY).
 * Always shown (— when missing) so the column is discoverable even before
 * enrichment lands or when some history lookups 429.
 */
const GAP_ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_2.75rem_2.25rem_4.75rem] items-center gap-x-2 min-h-[1.75rem]';

/** Right-rail numeric cells — nowrap + slightly smaller type on narrow widths. */
const META_CELL =
  'justify-self-end whitespace-nowrap tabular-nums text-[11px] leading-none tracking-tight';

const LAST_PLAYED_BEFORE_NIGHT_TITLE =
  'Last played before that night (phish.net song history)';

const LAST_PLAYED_THIS_TOUR_TITLE =
  'Most recent date this song was played on the selected tour';

/**
 * Prior-play Last column. Non-dates stay trimmed.
 * @param {unknown} iso
 * @returns {string}
 */
function formatLastPlayed(iso) {
  if (typeof iso !== 'string') return '';
  const formatted = formatFanShowDate(iso);
  if (typeof formatted === 'string' && /^\d{2}\/\d{2}\/\d{2}$/.test(formatted)) return formatted;
  return iso.trim();
}

/**
 * Latest YYYY-MM-DD from a song's tour play dates (Tour Frequency "Last" col).
 * @param {{ showDates?: unknown, lastPlayed?: unknown }} row
 * @returns {string}
 */
function lastPlayedDisplayForTopSong(row) {
  if (typeof row?.lastPlayed === 'string' && row.lastPlayed.trim()) {
    return row.lastPlayed.trim();
  }
  const dates = Array.isArray(row?.showDates)
    ? row.showDates
        .map((d) => String(d ?? '').trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
  if (dates.length === 0) return '';
  return dates.reduce((a, b) => (a > b ? a : b));
}

const COL_HEADER =
  'mb-0.5 border-b border-brand-primary/20 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-300';

const TOUR_FREQUENCY_DEF =
  'All songs this tour, ranked by number of times played. Ties break by total # of times played all-time.';

const HIGH_GAPS_DEF = `Gap = shows since last played before that night. Listed when gap ≥ ${TOUR_STATS_GAP_HIGHLIGHT_MIN} and below the bustout threshold.`;

const TILE_DEFS = {
  unique: {
    label: 'Unique songs',
    long: 'Distinct song titles across scored tour dates.',
  },
  played: {
    label: 'Songs played',
    long: 'Total number of songs played in this tour, including repeats.',
  },
  ratio: {
    label: 'Unique ratio',
    long: 'Unique songs ÷ songs played. Higher means more variety relative to volume.',
  },
  bustouts: {
    label: 'Bustouts',
    long: `Songs with a pre-show gap ≥ ${BUSTOUT_MIN_GAP} (Bustout Boost eligible).`,
  },
};

/**
 * @param {{
 *   tourName: string,
 *   hasTour: boolean,
 *   calendarLoading: boolean,
 *   setlistLoading: boolean,
 *   setlistError: unknown,
 *   stats: import('../model/aggregateTourSetlistStats').TourSetlistStats,
 *   setlistReads: number,
 *   overlay: null | {
 *     showsPicked: number,
 *     slotsFilled: number,
 *     slotsCorrect: number,
 *     bustoutHits: number,
 *     topSongOverlap: number,
 *   },
 *   overlayLoading: boolean,
 *   onOpenScoringRules?: () => void,
 *   surface?: 'dashboard' | 'public',
 *   showSelfOverlay?: boolean,
 * }} props
 */
export default function TourStatsView({
  tourName,
  hasTour,
  calendarLoading,
  setlistLoading,
  setlistError,
  stats,
  overlay,
  overlayLoading,
  onOpenScoringRules,
  surface = 'dashboard',
  showSelfOverlay = true,
}) {
  const isPublic = surface === 'public';
  const renderSelfOverlay = !isPublic && showSelfOverlay;
  const uniqueTileLabel = isPublic
    ? 'Unique songs this tour'
    : TILE_DEFS.unique.label;
  const frequencyTitle = isPublic ? 'Song frequency' : 'Tour Frequency';
  const bustoutsTitle = isPublic
    ? `Bustouts (${BUSTOUT_MIN_GAP}+ show gap)`
    : 'Bustouts';
  const sectionHeading = isPublic ? 'h2' : 'p';

  // #827: keep interactive chrome structure (tiles / sections) instead of a
  // blank centered spinner — marketing header already painted above this.
  if (calendarLoading || setlistLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-10 animate-pulse rounded-xl border border-border-subtle/40 bg-surface-panel-strong/50" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] animate-pulse rounded-xl border border-border-subtle/40 bg-surface-panel-strong/50"
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-content-secondary">
          <Loader2
            className="h-5 w-5 animate-spin text-brand-primary"
            aria-hidden
          />
          <span>Loading tour stats…</span>
        </div>
        <div className="h-36 animate-pulse rounded-xl border border-border-subtle/40 bg-surface-panel-strong/50" />
        <div className="h-36 animate-pulse rounded-xl border border-border-subtle/40 bg-surface-panel-strong/50" />
      </div>
    );
  }

  if (!hasTour) {
    return (
      <Card variant="frosted" padding="none" className={STANDINGS_CARD_SHELL}>
        <p className="text-sm font-semibold text-content-secondary">
          No tour is available yet. Tour stats appear once a post-launch tour
          has shows on or before today.
        </p>
      </Card>
    );
  }

  if (setlistError) {
    return (
      <Card variant="danger" padding="none" className={STANDINGS_CARD_SHELL}>
        <p className="text-sm font-semibold text-red-300">
          Couldn’t load tour setlists. Try again in a moment.
        </p>
      </Card>
    );
  }

  return (
    <InfoTooltipProvider>
      <div className="space-y-4">
        <p className="rounded-xl border border-border-subtle/50 bg-surface-panel-strong/60 px-3.5 py-2 text-sm font-bold text-white shadow-inset-glass">
          {tourName ? (
            <>
              <span className="text-brand-primary">{tourName}</span>
              <span className="text-content-secondary"> · </span>
            </>
          ) : null}
          <span className="tabular-nums">
            {stats.showsWithSetlist} of {stats.tourShowCount} tour dates
          </span>
        </p>

        {isPublic ? (
          <p className="text-sm leading-relaxed text-slate-300">
            <strong className="font-semibold text-white">Unique songs</strong>{' '}
            count distinct titles played this tour.{' '}
            <strong className="font-semibold text-white">Bustouts</strong> are
            songs that returned after a {BUSTOUT_MIN_GAP}+ show gap — the same
            threshold that can trigger a Bustout Boost™ when you call them in
            picks.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={uniqueTileLabel}
            value={stats.uniqueSongs}
            definition={TILE_DEFS.unique.long}
          />
          <StatTile
            label={TILE_DEFS.played.label}
            value={stats.totalSongPlays}
            definition={TILE_DEFS.played.long}
          />
          <StatTile
            label={TILE_DEFS.ratio.label}
            value={formatUniqueRatio(stats.uniqueSongs, stats.totalSongPlays)}
            definition={TILE_DEFS.ratio.long}
          />
          <StatTile
            label={TILE_DEFS.bustouts.label}
            value={stats.bustouts.length}
            definition={TILE_DEFS.bustouts.long}
            accent="bustout"
          />
        </div>

        {renderSelfOverlay ? (
          <TourStatsSelfOverlay
            overlay={overlay}
            overlayLoading={overlayLoading}
          />
        ) : null}

        <TourStatsSectionCard
          title={frequencyTitle}
          titleAs={sectionHeading}
          definition={TOUR_FREQUENCY_DEF}
        >
          {isPublic ? (
            <p className="mb-3 text-sm leading-relaxed text-content-secondary">
              Song frequency ranks how often each title shows up on this tour —
              useful when you&apos;re locking openers, closers, and wildcards.
            </p>
          ) : null}
          {stats.topSongs.length === 0 ? (
            <p className="text-sm text-content-secondary">No setlist songs yet.</p>
          ) : (
            <PagedRows
              rows={stats.topSongs}
              label="song frequency"
              listAs="ol"
              header={
                <div className={`${TOP_SONGS_ROW_GRID} ${COL_HEADER}`} aria-hidden>
                  <span className="tabular-nums">#</span>
                  <span>Song</span>
                  <span
                    className={META_CELL}
                    title={LAST_PLAYED_THIS_TOUR_TITLE}
                  >
                    Last
                  </span>
                  <span className={META_CELL}>Plays</span>
                </div>
              }
              renderRow={(row, absoluteIdx) => {
                const lastIso = lastPlayedDisplayForTopSong(row);
                return (
                  <li key={row.title} className={TOP_SONGS_ROW_GRID}>
                    <span className="tabular-nums text-brand-primary/80">
                      {absoluteIdx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{row.title}</span>
                      <SongEnrichmentLine row={row} />
                    </span>
                    <span
                      className={`${META_CELL} text-content-secondary`}
                      title={
                        lastIso
                          ? `${LAST_PLAYED_THIS_TOUR_TITLE}: ${lastIso}`
                          : LAST_PLAYED_THIS_TOUR_TITLE
                      }
                    >
                      {lastIso ? formatFanShowMonthDay(lastIso) : '—'}
                    </span>
                    <span className={`${META_CELL} text-brand-primary`}>
                      {row.timesPlayed}
                    </span>
                  </li>
                );
              }}
            />
          )}
        </TourStatsSectionCard>

        <TourStatsSectionCard
          title={bustoutsTitle}
          titleAs={sectionHeading}
          // Match dashboard Bustouts tile tooltip (`TILE_DEFS.bustouts.long`).
          // Public body paragraph below stays — #929 fan-language SEO copy.
          definition={TILE_DEFS.bustouts.long}
          headerTone="bustout"
        >
          {isPublic ? (
            <p className="mb-3 text-sm leading-relaxed text-content-secondary">
              Bustouts ({BUSTOUT_MIN_GAP}+ show gap) are the rare returns fans
              hunt — the same gap band that can stack a Bustout Boost™ on a
              correct pick.
            </p>
          ) : null}
          {stats.bustouts.length === 0 ? (
            <p className="text-sm text-content-secondary">No bustouts frozen yet.</p>
          ) : (
            <GapPagedRows
              rows={stats.bustouts}
              label="bustouts"
              gapClassName={`${META_CELL} font-bold text-amber-200`}
            />
          )}
          <p className="mt-3 border-t border-border-subtle/40 pt-3 text-[11px] font-semibold leading-relaxed text-content-secondary">
            Gap = shows since last played before that night. Bustout = gap ≥{' '}
            {BUSTOUT_MIN_GAP} (Bustout Boost eligible).
            {typeof onOpenScoringRules === 'function' ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onOpenScoringRules}
                  className="text-teal-300 underline decoration-teal-500/50 underline-offset-2 hover:text-white hover:decoration-teal-300"
                >
                  What is a bustout?
                </button>
              </>
            ) : null}
          </p>
        </TourStatsSectionCard>

        {stats.gapHighlights.length > 0 ? (
          <TourStatsSectionCard
            title="High gaps (non-bustout)"
            titleAs={sectionHeading}
            definition={HIGH_GAPS_DEF}
            headerTone="muted"
          >
            <GapPagedRows
              rows={stats.gapHighlights}
              label="high gaps"
              gapClassName={`${META_CELL} text-slate-300`}
            />
          </TourStatsSectionCard>
        ) : null}
      </div>
    </InfoTooltipProvider>
  );
}

/**
 * Lifetime context from phish.net enrichment (#666) — present only on
 * `public_tour_stats` rows written by an enriched refresh. Dashboard rows
 * (client-side aggregation) never carry these fields, so the private
 * explorer renders unchanged.
 *
 * @param {{ row: { debutYear?: number | null, lifetimePlays?: number | null } }} props
 */
function SongEnrichmentLine({ row }) {
  const bits = [];
  if (typeof row.debutYear === 'number') bits.push(`Debut ${row.debutYear}`);
  if (typeof row.lifetimePlays === 'number') {
    bits.push(`All Time - ${row.lifetimePlays.toLocaleString()}`);
  }
  if (bits.length === 0) return null;
  return (
    <span className="block truncate text-[10px] font-medium leading-snug text-content-secondary">
      {bits.join(' · ')}
    </span>
  );
}

/**
 * Bustouts / High-gaps list body: Song | Date (mm-dd) | Gap | Last (mm-dd-yy).
 * Full ISO dates stay on `title` for hover / assistive context.
 *
 * @param {{
 *   rows: Array<{ title: string, showDate: string, gap: number | null, lastPlayed?: string }>,
 *   label: string,
 *   gapClassName: string,
 * }} props
 */
function GapPagedRows({ rows, label, gapClassName }) {
  return (
    <PagedRows
      rows={rows}
      label={label}
      header={
        <div className={`${GAP_ROW_GRID} ${COL_HEADER}`} aria-hidden>
          <span>Song</span>
          <span className={META_CELL}>Date</span>
          <span className={META_CELL}>Gap</span>
          <span className={META_CELL} title={LAST_PLAYED_BEFORE_NIGHT_TITLE}>
            Last
          </span>
        </div>
      }
      renderRow={(row) => {
        const lastIso =
          typeof row.lastPlayed === 'string' && row.lastPlayed.trim()
            ? row.lastPlayed.trim()
            : '';
        return (
          <li key={`${row.showDate}-${row.title}`} className={GAP_ROW_GRID}>
            <span className="min-w-0">
              <span className="block truncate">{row.title}</span>
              <SongEnrichmentLine row={row} />
            </span>
            <span
              className={`${META_CELL} text-content-secondary`}
              title={
                typeof row.showDate === 'string' && row.showDate
                  ? row.showDate
                  : undefined
              }
            >
              {formatFanShowMonthDay(row.showDate) || '—'}
            </span>
            <span
              className={gapClassName}
              title={
                row.gap != null
                  ? `${row.gap} shows since last played (pre-show gap)`
                  : undefined
              }
            >
              {row.gap != null ? row.gap : '—'}
            </span>
            <span
              className={`${META_CELL} text-content-secondary`}
              title={
                lastIso
                  ? `${LAST_PLAYED_BEFORE_NIGHT_TITLE}: ${lastIso}`
                  : LAST_PLAYED_BEFORE_NIGHT_TITLE
              }
            >
              {lastIso ? formatLastPlayed(lastIso) : '—'}
            </span>
          </li>
        );
      }}
    />
  );
}

const PAGER_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle/50 text-slate-200 transition-colors hover:border-brand-primary/50 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border-subtle/50 disabled:hover:text-slate-200';

/**
 * Client-side pager for the tour-stats list cards (#709). Lists are
 * unbounded; this renders TOUR_STATS_TOP_N rows per page with back/forward
 * arrows and a `16–30 of 87` range indicator. Controls are hidden entirely
 * when the list fits on one page, and the current page self-clamps when the
 * data shrinks (e.g. tour filter change) so a stale index never renders an
 * empty page.
 *
 * @param {{
 *   rows: Array<object>,
 *   label: string,
 *   header: React.ReactNode,
 *   renderRow: (row: object, absoluteIdx: number) => React.ReactNode,
 *   listAs?: 'ul' | 'ol',
 * }} props
 */
function PagedRows({ rows, label, header, renderRow, listAs: ListTag = 'ul' }) {
  const [page, setPage] = useState(0);
  const total = rows.length;
  const maxPage = Math.max(0, Math.ceil(total / TOUR_STATS_TOP_N) - 1);
  const current = Math.min(page, maxPage);
  const start = current * TOUR_STATS_TOP_N;
  const end = Math.min(start + TOUR_STATS_TOP_N, total);

  return (
    <div>
      {header}
      <ListTag className="space-y-0.5 text-sm font-semibold text-slate-100">
        {rows.slice(start, end).map((row, i) => renderRow(row, start + i))}
      </ListTag>
      {total > TOUR_STATS_TOP_N ? (
        <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-border-subtle/40 pt-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label={`Previous ${label} page`}
            className={PAGER_BUTTON}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[6.5rem] text-center text-[11px] font-semibold tabular-nums text-content-secondary">
            {start + 1}–{end} of {total}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(maxPage, current + 1))}
            disabled={current === maxPage}
            aria-label={`Next ${label} page`}
            className={PAGER_BUTTON}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatUniqueRatio(uniqueSongs, songsPlayed) {
  if (!songsPlayed || songsPlayed <= 0) return '—';
  const pct = Math.round((uniqueSongs / songsPlayed) * 100);
  return `${pct}%`;
}

const HEADER_TONE = {
  default: {
    bar: 'border-brand-primary/35 bg-brand-primary/10',
    text: 'text-brand-primary',
  },
  bustout: {
    bar: 'border-amber-500/35 bg-amber-500/10',
    text: 'text-amber-200',
  },
  muted: {
    bar: 'border-brand-accent-blue/30 bg-brand-accent-blue/10',
    text: 'text-blue-200',
  },
};

/**
 * @param {{
 *   title: string,
 *   definition?: string,
 *   headerTone?: keyof typeof HEADER_TONE,
 *   children: React.ReactNode,
 * }} props
 */
function TourStatsSectionCard({
  title,
  titleAs = 'p',
  definition,
  headerTone = 'default',
  children,
}) {
  const tone = HEADER_TONE[headerTone] ?? HEADER_TONE.default;
  const TitleTag = titleAs === 'h2' ? 'h2' : 'p';

  return (
    <Card variant="frosted" padding="none" className={STANDINGS_CARD_SHELL}>
      <div className={`-mx-3.5 -mt-3.5 mb-3 rounded-t-xl border-b px-3.5 py-2.5 md:-mx-4 md:-mt-4 md:px-4 ${tone.bar}`}>
        <div className="flex items-center gap-1">
          <TitleTag className={`${STANDINGS_BOX_EYEBROW} ${tone.text}`}>
            {title}
          </TitleTag>
          {definition ? (
            <InfoTooltip label={title} definition={definition} />
          ) : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

const TILE_ACCENT = {
  /** Tour-wide row — brand teal. */
  default: {
    band: 'border-brand-primary/30 bg-brand-primary/10',
    label: 'text-brand-primary',
    value: 'text-brand-primary',
    tooltip: 'text-brand-primary/85 hover:text-brand-primary',
  },
  /** Bustout gold (tour-wide Bustouts tile). */
  bustout: {
    band: 'border-amber-500/30 bg-amber-500/10',
    label: 'text-amber-200',
    value: 'text-amber-200',
    tooltip: 'text-amber-200/85 hover:text-amber-200',
  },
  /**
   * "Your picks this tour" tiles — band matches the muted section header
   * blue; numbers stay brand teal so values read consistently across rows.
   */
  personal: {
    band: 'border-brand-accent-blue/30 bg-brand-accent-blue/10',
    label: 'text-blue-200',
    value: 'text-brand-primary',
    tooltip: 'text-blue-200/85 hover:text-blue-200',
  },
  /**
   * Personal Bustout Boost — gold+blue hybrid (light green) band; label,
   * number, and tooltip keep bustout gold so "amber = bustout" still reads.
   */
  personalBustout: {
    band: 'border-emerald-400/30 bg-emerald-400/10',
    label: 'text-amber-200',
    value: 'text-amber-200',
    tooltip: 'text-amber-200/85 hover:text-amber-200',
  },
};

/**
 * @param {{
 *   label: string,
 *   value: React.ReactNode,
 *   definition: string,
 *   accent?: keyof typeof TILE_ACCENT,
 *   sub?: React.ReactNode,
 * }} props
 */
function StatTile({ label, value, definition, accent = 'default', sub = null }) {
  const tone = TILE_ACCENT[accent] ?? TILE_ACCENT.default;

  return (
    <Card
      variant="frosted"
      padding="none"
      className={`${STANDINGS_CARD_SHELL} relative flex flex-col gap-1 text-center`}
    >
      <div
        className={`-mx-3.5 -mt-3.5 mb-1 rounded-t-xl border-b px-2 py-2 md:-mx-4 md:-mt-4 ${tone.band}`}
      >
        {/* min-h fits a two-line label so one-line tiles (Bustouts) keep the
            same header band height as wrapping ones at desktop width */}
        <div className="flex min-h-[1.875rem] items-center justify-center gap-1">
          <p className={`min-w-0 ${STANDINGS_BOX_EYEBROW} ${tone.label}`}>
            {label}
          </p>
          <InfoTooltip
            label={label}
            definition={definition}
            triggerClassName={tone.tooltip}
          />
        </div>
      </div>
      <p
        className={`flex flex-1 items-center justify-center px-2 pb-1 pt-0.5 text-2xl font-black tabular-nums ${tone.value}`}
      >
        {value}
      </p>
      {/* Pinned to the tile bottom (out of flow) so the big number stays
          vertically aligned with sub-less sibling tiles in the same row */}
      {sub ? (
        <p className="absolute inset-x-0 bottom-1 text-[10px] font-semibold tabular-nums text-content-secondary">
          {sub}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Personal tour rollup — “Your picks this tour” (#1004).
 * Used on Personal Stats; Band hides this via `showSelfOverlay={false}`.
 *
 * @param {{
 *   overlay: null | {
 *     showsPicked: number,
 *     slotsFilled: number,
 *     slotsCorrect: number,
 *     bustoutHits: number,
 *     topSongOverlap: number,
 *   },
 *   overlayLoading: boolean,
 *   calendarLoading?: boolean,
 *   setlistLoading?: boolean,
 *   hasTour?: boolean,
 *   setlistError?: unknown,
 *   showEmpty?: boolean,
 * }} props
 */
export function TourStatsSelfOverlay({
  overlay,
  overlayLoading,
  calendarLoading = false,
  setlistLoading = false,
  hasTour = true,
  setlistError = null,
  showEmpty = false,
}) {
  if (calendarLoading || setlistLoading || overlayLoading) {
    return (
      <Card
        variant="frosted"
        padding="none"
        className={`${STANDINGS_CARD_SHELL} flex items-center gap-2`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-brand-primary" aria-hidden />
        <span className="text-sm font-semibold text-content-secondary">
          Stacking your picks…
        </span>
      </Card>
    );
  }

  if (!hasTour) {
    return (
      <Card variant="frosted" padding="none" className={STANDINGS_CARD_SHELL}>
        <p className="text-sm font-semibold text-content-secondary">
          No tour is available yet. Your tour picks appear once a post-launch
          tour has shows on or before today.
        </p>
      </Card>
    );
  }

  if (setlistError) {
    return (
      <Card variant="danger" padding="none" className={STANDINGS_CARD_SHELL}>
        <p className="text-sm font-semibold text-red-300">
          Couldn’t load tour setlists. Try again in a moment.
        </p>
      </Card>
    );
  }

  if (!overlay) {
    if (!showEmpty) return null;
    return (
      <Card variant="frosted" padding="none" className={STANDINGS_CARD_SHELL}>
        <p className="text-sm font-semibold text-content-secondary">
          Your tour picks appear here after you lock a show this tour.
        </p>
      </Card>
    );
  }

  return (
    <TourStatsSectionCard title="Your picks this tour" headerTone="muted">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Shows"
          value={overlay.showsPicked}
          accent="personal"
          definition="Tour shows where you submitted picks."
        />
        <StatTile
          label="Picking average"
          value={formatAvgCorrectPicksPerShow(
            overlay.showsPicked > 0
              ? overlay.slotsCorrect /
                  (overlay.showsPicked * PROFILE_SLOTS_PER_SHOW)
              : null,
          )}
          sub={
            overlay.showsPicked > 0
              ? `${overlay.slotsCorrect}/${
                  overlay.showsPicked * PROFILE_SLOTS_PER_SHOW
                } correct`
              : null
          }
          accent="personal"
          definition={`Like a batting average in baseball — correct picks ÷ total picks (${PROFILE_SLOTS_PER_SHOW} per show) across your tour shows (.500 means half your picks hit).`}
        />
        <StatTile
          label="Bustout Boost"
          value={overlay.bustoutHits}
          accent="personalBustout"
          definition={`Picks that earned the Bustout Boost — a hit on a song with a pre-show gap ≥ ${BUSTOUT_MIN_GAP}.`}
        />
        <StatTile
          label="In most played"
          value={overlay.topSongOverlap}
          accent="personal"
          definition={`How many of this tour's top ${TOUR_STATS_TOP_N} most-played songs you've picked.`}
        />
      </div>
    </TourStatsSectionCard>
  );
}

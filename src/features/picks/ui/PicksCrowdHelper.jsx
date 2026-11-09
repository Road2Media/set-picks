import React from 'react';
import { Link } from 'react-router-dom';
import { History, Loader2, Radio } from 'lucide-react';

import {
  formatCrowdShare,
  selectLiveConsensusChips,
  useCrowdNightStats,
} from '../../crowd-picks';
import { useShowCalendar } from '../../show-calendar';
import { useSongCatalog } from '../../song-catalog';
import { useStandings, useTourCrowdChalk } from '../../scoring';
import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_EYEBROW,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import InfoTooltip, { InfoTooltipProvider } from '../../../shared/ui/InfoTooltip';
import {
  PICKS_CROWD_CHALK_EMPTY,
  PICKS_CROWD_CHALK_HINT,
  PICKS_CROWD_CHALK_NO_PICKS,
  PICKS_CROWD_CHALK_QUIET,
  PICKS_CROWD_CHALK_TITLE,
  PICKS_CROWD_HELPER_EYEBROW,
  PICKS_CROWD_LEAN_EMPTY,
  PICKS_CROWD_LEAN_HINT,
  PICKS_CROWD_LEAN_QUIET,
  PICKS_CROWD_LEAN_TITLE,
  PICKS_CROWD_LOAD_ERROR,
  PICKS_CROWD_SECTION_CONSENSUS,
  PICKS_CROWD_SECTION_GAPS,
  PICKS_CROWD_SECTION_SLOTS,
  PICKS_CROWD_STATS_LINK,
  crowdStatsHref,
  catalogChalkSongs,
  findOpenSlotForTitle,
  resolvePicksHelperMode,
  tourChalkMeta,
  tourChalkOddsLabel,
} from '../model/picksCrowdHelper';

/**
 * Make Picks crowd helper (#694 P2).
 * Before showtime: historical tour chalk only.
 * After picks lock at showtime: live consensus chips from the night aggregates.
 *
 * @param {object} props
 * @param {string} [props.selectedDate]
 * @param {string | null} [props.showStatus]
 * @param {boolean} [props.isLocked]
 * @param {Record<string, string>} [props.formData]
 * @param {(fieldId: string, value: string) => void} [props.onChange]
 * @param {object | null} [props.pickRecommendationsArtifact]
 */
export default function PicksCrowdHelper({
  selectedDate = '',
  showStatus = null,
  isLocked = false,
  formData = {},
  onChange,
  pickRecommendationsArtifact = null,
}) {
  if (!selectedDate || !showStatus) return null;
  if (resolvePicksHelperMode(showStatus) === 'consensus') {
    return (
      <PicksCrowdLean selectedDate={selectedDate} />
    );
  }
  return (
    <PicksCrowdChalk
      selectedDate={selectedDate}
      isLocked={isLocked}
      formData={formData}
      onChange={onChange}
      pickRecommendationsArtifact={pickRecommendationsArtifact}
    />
  );
}

function PicksCrowdChalk({
  selectedDate,
  isLocked,
  formData,
  onChange,
  pickRecommendationsArtifact,
}) {
  const tour = useTourCrowdChalk(selectedDate);
  const { songs: catalogSongs, isLoading: catalogLoading } = useSongCatalog();
  const songs = catalogChalkSongs(tour.chalk?.songs, catalogSongs);
  const waitingOnCatalog =
    tour.hasPriorShows && catalogLoading && songs.length === 0;

  const onUse = (title) => {
    if (isLocked || typeof onChange !== 'function') return;
    const open = findOpenSlotForTitle(formData, title);
    if (open.state !== 'open' || !open.slotId) return;
    onChange(open.slotId, title);
  };

  let status = '';
  if (!tour.loading && !waitingOnCatalog && !tour.error) {
    if (!tour.hasPriorShows) status = PICKS_CROWD_CHALK_EMPTY;
    else if (!tour.chalk || tour.chalk.nightsCounted === 0) status = PICKS_CROWD_CHALK_NO_PICKS;
    else if (songs.length === 0) status = PICKS_CROWD_CHALK_QUIET;
  }

  return (
    <HelperShell
      mode="chalk"
      showDate={selectedDate}
      loading={tour.loading || waitingOnCatalog}
      error={tour.error}
      hint={PICKS_CROWD_CHALK_HINT}
      title={PICKS_CROWD_CHALK_TITLE}
      status={status}
    >
      {songs.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {songs.map((song) => {
            const open = findOpenSlotForTitle(formData, song.title);
            const onCard = open.state === 'on_card';
            const canUse = !isLocked && open.state === 'open';
            const odds = tourChalkOddsLabel(
              pickRecommendationsArtifact,
              selectedDate,
              song.title
            );
            const action = onCard ? 'On card' : canUse ? 'Use' : isLocked ? '' : 'Card full';
            return (
              <li key={song.title}>
                <ChalkChip
                  title={song.title}
                  meta={tourChalkMeta(song)}
                  odds={odds}
                  action={action}
                  pressed={onCard}
                  disabled={!canUse}
                  onUse={canUse ? () => onUse(song.title) : null}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </HelperShell>
  );
}

function PicksCrowdLean({ selectedDate }) {
  const { showDates } = useShowCalendar();
  const standings = useStandings(selectedDate, showDates);
  const stats = useCrowdNightStats(
    selectedDate,
    standings.picks,
    null,
    standings.actualSetlist
  );
  const chips = selectLiveConsensusChips(stats.deepDive, stats.catalog?.highestGap);
  const pickers = stats.card?.pickers ?? 0;
  const hasChips = chips.songs.length + chips.slots.length + chips.gaps.length > 0;

  let status = '';
  if (!standings.loading && !standings.error) {
    if (pickers === 0) status = PICKS_CROWD_LEAN_EMPTY;
    else if (!hasChips) status = PICKS_CROWD_LEAN_QUIET;
  }

  return (
    <HelperShell
      mode="consensus"
      showDate={selectedDate}
      loading={standings.loading}
      error={standings.error}
      hint={PICKS_CROWD_LEAN_HINT}
      title={PICKS_CROWD_LEAN_TITLE}
      status={status}
    >
      {chips.songs.length ? (
        <ChipGroup label={PICKS_CROWD_SECTION_CONSENSUS}>
          {chips.songs.map((song) => (
            <ReadChip key={song.title}>
              <span className="truncate">{song.title}</span>
              <span className="shrink-0 font-medium text-content-secondary">
                {song.cardCount} · {formatCrowdShare(song.pctOfPickers)}
              </span>
            </ReadChip>
          ))}
        </ChipGroup>
      ) : null}
      {chips.slots.length ? (
        <ChipGroup label={PICKS_CROWD_SECTION_SLOTS}>
          {chips.slots.map((slot) => (
            <ReadChip key={slot.slotId || slot.label}>
              <span className="shrink-0 uppercase tracking-widest text-content-secondary">
                {slot.label}
              </span>
              <span className="truncate">{slot.title}</span>
            </ReadChip>
          ))}
        </ChipGroup>
      ) : null}
      {chips.gaps.length ? (
        <ChipGroup label={PICKS_CROWD_SECTION_GAPS}>
          {chips.gaps.map((row) => (
            <ReadChip key={row.title}>
              <span className="truncate">{row.title}</span>
              <span className="shrink-0 font-medium text-content-secondary">
                gap {row.gap}
              </span>
            </ReadChip>
          ))}
        </ChipGroup>
      ) : null}
    </HelperShell>
  );
}

function HelperShell({
  mode,
  showDate,
  loading,
  error,
  hint,
  title,
  status,
  children,
}) {
  const Icon = mode === 'consensus' ? Radio : History;
  return (
    <InfoTooltipProvider>
      <DashboardJobShell
        as="section"
        tone="teal"
        pad="label"
        className="mb-4"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
          >
            <Icon className={DASHBOARD_JOB_ICON} aria-hidden />
            {PICKS_CROWD_HELPER_EYEBROW}
            <InfoTooltip label={title} definition={hint} />
          </div>
          <Link
            to={crowdStatsHref(showDate)}
            className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-brand-primary"
          >
            {PICKS_CROWD_STATS_LINK}
          </Link>
        </div>
        <p className={`mt-1 ${DASHBOARD_CARD_TITLE}`}>{title}</p>
        {loading ? (
          <p className={`mt-2 inline-flex items-center gap-2 ${DASHBOARD_CARD_BODY}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : error ? (
          <p className={`mt-2 ${DASHBOARD_CARD_BODY}`} role="status">
            {PICKS_CROWD_LOAD_ERROR}
          </p>
        ) : (
          <>
            {status ? (
              <p className={`mt-2 ${DASHBOARD_CARD_BODY}`} role="status">
                {status}
              </p>
            ) : null}
            {children ? <div className="mt-2.5 space-y-2.5">{children}</div> : null}
          </>
        )}
      </DashboardJobShell>
    </InfoTooltipProvider>
  );
}

function ChipGroup({ label, children }) {
  return (
    <div>
      <p className={`mb-1.5 ${DASHBOARD_CARD_EYEBROW} text-content-secondary`}>{label}</p>
      <ul className="flex flex-wrap gap-1.5">{children}</ul>
    </div>
  );
}

function ReadChip({ children }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-surface-elevated/40 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-border-subtle/80">
      {children}
    </li>
  );
}

function ChalkChip({ title, meta, odds, action, pressed, disabled, onUse }) {
  const className = `inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-left text-[11px] font-bold ring-1 ${
    pressed
      ? 'bg-brand-primary/20 text-brand-primary ring-brand-primary/40'
      : 'bg-surface-elevated/40 text-white ring-border-subtle/80'
  } ${disabled ? '' : 'hover:bg-brand-primary/15'}`;
  const body = (
    <>
      <span className="truncate">{title}</span>
      <span className={`shrink-0 font-medium ${pressed ? 'text-brand-primary/80' : 'text-content-secondary'}`}>
        {meta}
        {odds ? ` · ${odds}` : ''}
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </>
  );
  if (!onUse) {
    return <span className={className}>{body}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onUse}
      aria-label={`Use ${title} in the first open slot`}
    >
      {body}
    </button>
  );
}

import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Radio } from 'lucide-react';

import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_EYEBROW,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import DashboardTileShell from '../../../shared/ui/DashboardTileShell';
import InfoTooltip, { InfoTooltipProvider } from '../../../shared/ui/InfoTooltip';
import { crowdSlotSurpriseCopy } from '../model/crowdNightDeepDive';
import { trackCrowdPulseView } from '../model/crowdPulseAnalytics';
import CrowdPulseTopTable from './CrowdPulseTopTable';
import FrequencyMeterRow from './FrequencyMeterRow';

/**
 * Stats deep dive for one show (#694 P1).
 * Reuses the night card and the stat tile. Aggregates only — no setlist.
 *
 * @param {object} props
 * @param {string} [props.showDate]
 * @param {string} [props.showLabel]
 * @param {string} [props.showStatus]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.leadersLoading]
 * @param {Error | null} [props.leadersError]
 * @param {boolean} [props.hasPriorTourShows]
 * @param {Error | null} [props.error]
 * @param {{ pickers: number, uniqueSongs: number } | null} [props.card]
 * @param {{ multiPickerFull?: Array<{ title: string, cardCount: number, pctOfPickers?: number, gap?: number | null, last?: string | null }> } | null} [props.night]
 * @param {{ highestGap?: Array<{ title: string, cardCount: number, pctOfPickers?: number, gap?: number | null, last?: string | null }>, vintage?: { avgYear: number | null, medianYear: number | null, coveragePct: number, datedSlots: number, totalSlots: number } } | null} [props.catalog]
 * @param {{ lockedInLabel?: string, songs?: Array<{ title: string, cardCount: number, subtitle?: string | null, gap?: number | null, last?: string | null }> } | null} [props.leaders]
 * @param {{ consensus: Array<{ title: string, cardCount: number, pctOfPickers?: number }>, bySlot: Array<{ slotId: string, label: string, title: string | null, count: number, pctOfPickers: number }>, slotHit: { hits: number, compared: number, pending: number, hitPct: number, rows: Array<{ slotId: string, label: string, crowdTitle: string, hit: boolean }> } } | null} [props.deepDive]
 * @param {boolean} [props.catalogLoading]
 * @param {boolean} [props.blurDeepStats]
 * @param {Set<string> | null} [props.playedTitles]
 * @param {string} [props.phishNetUrl]
 * @param {string} [props.standingsHref]
 */
export default function CrowdNightStatsPanel({
  showDate = '',
  showLabel = '',
  showStatus = '',
  loading = false,
  leadersLoading = false,
  leadersError = null,
  hasPriorTourShows = false,
  error = null,
  card = null,
  night = null,
  catalog = null,
  leaders = null,
  deepDive = null,
  catalogLoading = false,
  blurDeepStats = false,
  playedTitles = null,
  phishNetUrl = 'https://phish.net',
  standingsHref = '/dashboard/standings',
}) {
  const pickers = card?.pickers ?? 0;
  useStatsNightView(showDate, blurDeepStats, pickers);

  return (
    <InfoTooltipProvider>
      <div className="space-y-3">
        <DashboardJobShell
          as="section"
          tone="teal"
          pad="label"
          aria-label="Crowd night"
        >
          <div className="flex items-start justify-between gap-3">
            <p
              className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
            >
              <Radio className={DASHBOARD_JOB_ICON} aria-hidden />
              Crowd night
            </p>
            <Link
              to={standingsHref}
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-brand-primary"
            >
              Standings
            </Link>
          </div>
          <p className={`mt-1 ${DASHBOARD_CARD_TITLE}`}>
            {showLabel || 'This show'}
          </p>
          <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
            Songs the room locked in. Counts and slot calls only — not the
            night&apos;s setlist.
          </p>
        </DashboardJobShell>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-brand-primary">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading crowd stats…
          </div>
        ) : error ? (
          <DashboardJobShell tone="none" pad="label" aria-label="Crowd stats error">
            <p className={DASHBOARD_CARD_BODY}>
              Crowd stats didn&apos;t load. Try this show again.
            </p>
          </DashboardJobShell>
        ) : showStatus === 'FUTURE' ? (
          <DashboardJobShell tone="none" pad="label" aria-label="Crowd stats not open">
            <p className={DASHBOARD_CARD_BODY}>
              Crowd stats open once this show is the next one on the board.
            </p>
          </DashboardJobShell>
        ) : !card || pickers === 0 ? (
          <DashboardJobShell tone="teal" pad="label" aria-label="No crowd picks">
            <p className={DASHBOARD_CARD_BODY}>
              No submitted picks for this show yet.
            </p>
          </DashboardJobShell>
        ) : (
          <CrowdNightBody
            card={card}
            night={night}
            catalog={catalog}
            leaders={leaders}
            deepDive={deepDive}
            catalogLoading={catalogLoading}
            blurDeepStats={blurDeepStats}
            playedTitles={playedTitles}
            leadersLoading={leadersLoading}
            leadersError={leadersError}
            hasPriorTourShows={hasPriorTourShows}
            phishNetUrl={phishNetUrl}
          />
        )}
      </div>
    </InfoTooltipProvider>
  );
}

function CrowdNightBody({
  card,
  night,
  catalog,
  leaders,
  deepDive,
  catalogLoading,
  blurDeepStats,
  playedTitles,
  leadersLoading,
  leadersError,
  hasPriorTourShows,
  phishNetUrl,
}) {
  const vintage = catalog?.vintage;
  const vintageLabel =
    vintage?.avgYear != null
      ? `~${Math.round(vintage.avgYear)}`
      : catalogLoading
        ? '…'
        : '—';
  const slotHit = deepDive?.slotHit;
  const showSlotHit = !blurDeepStats && slotHit && slotHit.compared > 0;
  const surprise = showSlotHit ? crowdSlotSurpriseCopy(slotHit) : '';
  const showPlayedLegend =
    playedTitles instanceof Set && playedTitles.size > 0;
  const consensus = deepDive?.consensus || [];
  const consensusMax = consensus.reduce(
    (max, row) => Math.max(max, row.cardCount || 0),
    0
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="Pickers"
          value={card.pickers}
          tone="teal"
          definition="Submitted cards for this show."
        />
        <MetricTile
          label="Songs"
          value={card.uniqueSongs}
          tone="blue"
          definition="Different titles across every slot on those cards."
        />
      </div>

      {blurDeepStats ? (
        <DashboardJobShell tone="teal" pad="label" role="status" aria-label="Crowd stats locked">
          <p className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}>
            <Lock className={DASHBOARD_JOB_ICON} aria-hidden />
            Unlocks at showtime
          </p>
          <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
            Song names, slot favorites, vintage, and tour leaders stay
            private until picks lock.
          </p>
        </DashboardJobShell>
      ) : null}

      <div
        className={`space-y-3 ${
          blurDeepStats ? 'pointer-events-none select-none blur-xs' : ''
        }`}
        aria-hidden={blurDeepStats || undefined}
      >
          <Section
            title="Consensus"
            definition="A song on at least 25% of cards, or on at least 3 cards."
          >
            {consensus.length ? (
              <ul className="space-y-2.5">
                {consensus.map((row) => (
                  <FrequencyMeterRow
                    key={row.title}
                    title={row.title}
                    count={row.cardCount}
                    maxCount={consensusMax}
                    meta={
                      typeof row.pctOfPickers === 'number'
                        ? `${row.cardCount} · ${row.pctOfPickers}%`
                        : String(row.cardCount)
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={DASHBOARD_CARD_BODY}>
                No song is on a quarter of the cards, or on 3 cards, yet.
              </p>
            )}
          </Section>

          <Section
            title="Slot favorites"
            definition="The title locked most often in that slot. Wildcard is a pick slot. It is not compared with the show."
          >
            <ul className="space-y-2">
              {(deepDive?.bySlot || []).map((row) => (
                <li
                  key={row.slotId}
                  className="flex items-baseline justify-between gap-3 text-[12px] md:text-sm"
                >
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-content-secondary">
                    {row.label}
                  </span>
                  <span className="min-w-0 truncate text-right font-semibold text-white">
                    {row.title ? (
                      <>
                        {row.title}
                        <span className="ml-1.5 font-medium tabular-nums text-content-secondary">
                          {row.count}
                          {row.pctOfPickers ? ` · ${row.pctOfPickers}%` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-content-secondary">
                        No call
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {showSlotHit ? (
            <Section
              title="Slot surprise"
              definition="How often the room's favorite call for a slot matched the show. A miss does not name what played. Wildcard is left out."
            >
              <p className="text-[12px] font-semibold text-white md:text-sm">
                {surprise}
              </p>
              <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
                {slotHit.hits} of {slotHit.compared} slots
                {slotHit.hitPct ? ` · ${slotHit.hitPct}%` : ''}
              </p>
              <ul className="mt-2 space-y-1.5">
                {slotHit.rows.map((row) => (
                  <li
                    key={row.slotId}
                    className="flex items-baseline justify-between gap-3 text-[12px]"
                  >
                    <span className="min-w-0 truncate text-content-secondary">
                      <span className="font-bold uppercase tracking-wide">
                        {row.label}
                      </span>
                      {row.crowdTitle ? ` · ${row.crowdTitle}` : ' · no call'}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${
                        row.hit ? 'text-brand-primary' : 'text-content-secondary'
                      }`}
                    >
                      {row.hit ? 'Matched' : 'Surprise'}
                    </span>
                  </li>
                ))}
              </ul>
              {slotHit.pending > 0 ? (
                <p className={`mt-2 ${DASHBOARD_CARD_BODY}`}>
                  Still waiting on the rest of the show.
                </p>
              ) : null}
            </Section>
          ) : null}

          <Section
            title="Multi-picker songs"
            definition="Every song on 2 or more cards for this show."
          >
            {showPlayedLegend ? <PlayedLegend /> : null}
            <CrowdPulseTopTable
              rows={night?.multiPickerFull || []}
              playedTitles={playedTitles}
              catalogLoading={catalogLoading}
              className=""
              emptyLabel="No multi-picker songs yet."
            />
          </Section>

          <Section
            title="Highest gaps"
            definition="Top 10 picks by pre-show gap. A missing catalog gap is left off."
          >
            <CrowdPulseTopTable
              rows={catalog?.highestGap || []}
              playedTitles={playedTitles}
              catalogLoading={catalogLoading}
              className=""
              emptyLabel={catalogLoading ? 'Loading catalog…' : 'No gapped picks yet.'}
            />
          </Section>

          <Section
            title="Crowd vintage"
            definition="Mean debut year across filled slots. Unknown debuts are left out of the average."
          >
            <p className="text-[12px] font-semibold text-white md:text-sm">
              Mean debut {vintageLabel}
              {vintage?.medianYear != null
                ? ` · median ${Math.round(vintage.medianYear)}`
                : ''}
            </p>
            <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>
              Coverage {vintage?.coveragePct ?? 0}% ({vintage?.datedSlots ?? 0}/
              {vintage?.totalSlots ?? 0} slots)
            </p>
          </Section>

          <Section
            title="Tour leaders this show"
            definition="Songs the current tour top 5 locked in for this show, counted among those who submitted."
          >
            {leaders?.lockedInLabel ? (
              <p className={`mb-2 ${DASHBOARD_CARD_BODY}`}>
                {leaders.lockedInLabel} locked in
              </p>
            ) : null}
            {leadersError ? (
              <p className={DASHBOARD_CARD_BODY}>Tour leaders didn&apos;t load.</p>
            ) : leadersLoading && !(leaders?.songs || []).length ? (
              <p className={DASHBOARD_CARD_BODY}>Loading tour leaders…</p>
            ) : !hasPriorTourShows ? (
              <p className={DASHBOARD_CARD_BODY}>
                This is the first night of the tour, so there is no earlier
                tour board.
              </p>
            ) : (
              <CrowdPulseTopTable
                rows={leaders?.songs || []}
                playedTitles={playedTitles}
                catalogLoading={catalogLoading}
                countHeader="Among"
                className=""
                emptyLabel="None of the tour top 5 have locked in yet."
              />
            )}
          </Section>
      </div>

      <p className={DASHBOARD_CARD_BODY}>
        Gap, last played, and slot results courtesy of{' '}
        <a
          href={phishNetUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand-primary underline-offset-2 hover:underline"
        >
          Phish.net
        </a>
        . This page does not list the night&apos;s setlist.
      </p>
    </>
  );
}

function Section({ title, definition, children }) {
  return (
    <DashboardTileShell
      as="section"
      tone="teal"
      pad="section"
      aria-label={title}
      header={
        <div className="flex items-center gap-1">
          <h2 className={`${DASHBOARD_CARD_EYEBROW} text-brand-primary`}>
            {title}
          </h2>
          <InfoTooltip label={title} definition={definition} />
        </div>
      }
    >
      {children}
    </DashboardTileShell>
  );
}

function MetricTile({ label, value, definition, tone }) {
  const labelClass =
    tone === 'blue' ? 'text-blue-200' : 'text-brand-primary';
  return (
    <DashboardTileShell
      tone={tone}
      pad="tile"
      className="h-full text-center"
      header={
        <div className="flex min-h-7.5 items-center justify-center gap-1">
          <p className={`${DASHBOARD_CARD_EYEBROW} ${labelClass}`}>{label}</p>
          <InfoTooltip label={label} definition={definition} />
        </div>
      }
    >
      <p className="flex flex-1 items-center justify-center text-2xl font-black tabular-nums text-brand-primary">
        {value}
      </p>
    </DashboardTileShell>
  );
}

function PlayedLegend() {
  return (
    <p className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-content-secondary">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs bg-brand-primary/80"
        aria-hidden
      />
      Highlight = that crowd song was played
    </p>
  );
}

function useStatsNightView(showDate, blurDeepStats, pickers) {
  const viewLoggedRef = useRef('');
  useEffect(() => {
    if (!showDate) return;
    const deep_stats = blurDeepStats ? 'locked' : 'open';
    const sig = `${showDate}|${deep_stats}|${pickers}|stats_night`;
    if (viewLoggedRef.current === sig) return;
    viewLoggedRef.current = sig;
    trackCrowdPulseView({
      show_date: showDate,
      deep_stats,
      pickers,
      surface: 'stats_night',
    });
  }, [showDate, blurDeepStats, pickers]);
}

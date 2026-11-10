import React from 'react';
import { Check, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HundredthShowCardMark } from '../../hundredth-show';
import { StatsRatesDidYouKnow } from '../../feature-discovery';
import { PICKS_SELF_RECAP_STANDINGS_LINK } from '../../../shared/config/dashboardVocabulary';
import InfoTooltip, { InfoTooltipProvider } from '../../../shared/ui/InfoTooltip';
import { SCORE_BREAKDOWN_KIND_LABEL } from '../../../shared/utils/scoring';
import { formatOverlapLabel } from '../model/computeScorecardOverlap';
import { scorecardHitChromeSpec } from '../model/mapScorecardSlotGrade';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import {
  SCORECARD_BODY,
  SCORECARD_EYEBROW,
  SCORECARD_EYEBROW_ICON,
  SCORECARD_METRIC,
  SCORECARD_SLOT_CHECK,
  SCORECARD_SLOT_ITEM,
  SCORECARD_SLOT_LABEL,
  SCORECARD_SLOT_RING,
  SCORECARD_SLOT_TITLE_TONE,
  SCORECARD_TITLE,
} from './picksScorecardClasses';

export const SCORECARD_EMPTY_TITLE = 'No picks for this show';
export const SCORECARD_EMPTY_BODY =
  'Lock a card on Make Picks to see your Scorecard for the selected night.';
export const SCORECARD_HINT =
  'After showtime, each slot can show the share of locked cards that include that song, and how many other players picked it in that slot. Hide crowd pulse turns those lines off. View Standings for the full leaderboard, live setlist, and crowd pulse.';
export const SCORECARD_LOCKED_UNGRADED_COPY =
  'Picks are locked. Rank and points land when the official setlist is posted.';
export const SCORECARD_GRADED_COPY = 'Show results for the selected night.';
export const SCORECARD_LOADING_LABEL = 'Loading scorecard';
export const SCORECARD_RANK_PENDING = 'Rank updates after the setlist is posted.';
export const SCORECARD_CROWD_LABEL = 'Crowd';
export const SCORECARD_AUDIENCE_LABEL = 'Compare';

/**
 * @param {string} [audienceName]
 */
export function scorecardPoolExcludedCopy(audienceName) {
  const name = typeof audienceName === 'string' ? audienceName.trim() : '';
  if (!name) return 'This night does not count for this pool.';
  return `This night does not count for ${name}.`;
}

function stateCopy(state) {
  if (state === 'empty') return SCORECARD_EMPTY_BODY;
  if (state === 'locked_ungraded') return SCORECARD_LOCKED_UNGRADED_COPY;
  if (state === 'graded') return SCORECARD_GRADED_COPY;
  return '';
}

function slotItemClass(chrome) {
  const ring = chrome.ringTone ? SCORECARD_SLOT_RING[chrome.ringTone] : '';
  return [SCORECARD_SLOT_ITEM, ring].filter(Boolean).join(' ');
}

function slotTitleClass(chrome) {
  const base = 'text-sm font-bold leading-snug md:text-base';
  if (chrome.titleTone === 'default') return `${base} text-white`;
  const tone = SCORECARD_SLOT_TITLE_TONE[chrome.titleTone];
  return tone ? `${base} ${tone}` : `${base} text-white`;
}

function hitStatusLabel(grade) {
  if (!grade?.hit) return '';
  const kindLabel = SCORE_BREAKDOWN_KIND_LABEL[grade.kind] || 'Hit';
  return grade.bustoutBoost ? `${kindLabel}, Bustout Boost` : kindLabel;
}

/**
 * Show-scoped Scorecard (#767 / #1043). Presentational — data from
 * {@link usePicksScorecard}. Audience is everyone or one pool. Crowd %
 * replaces model odds.
 *
 * @param {{
 *   isLoading?: boolean,
 *   state: 'empty' | 'pre_lock' | 'locked_ungraded' | 'graded',
 *   showLabel?: string,
 *   slots?: Array<{
 *     fieldId: string,
 *     label: string,
 *     song: string,
 *     alsoPickedCount: number | null,
 *     crowdShareLabel?: string | null,
 *     grade?: {
 *       kind: string,
 *       points: number,
 *       bustoutBoost: boolean,
 *       hit: boolean,
 *     } | null,
 *   }>,
 *   showOverlap?: boolean,
 *   showCrowd?: boolean,
 *   showRank?: boolean,
 *   recap?: {
 *     displayRank: number | null,
 *     totalPlayers: number,
 *     totalScore: number | null,
 *   } | null,
 *   audienceId?: string,
 *   audienceName?: string,
 *   audienceOptions?: Array<{ id: string, name: string }>,
 *   onAudienceChange?: (id: string) => void,
 *   poolExcludesNight?: boolean,
 *   standingsTo?: string,
 *   makePicksTo?: string,
 *   className?: string,
 * }} props
 */
export default function PicksScorecardCard({
  isLoading = false,
  state,
  showDate = '',
  showLabel = '',
  slots = [],
  showOverlap = false,
  showCrowd = false,
  showRank = false,
  recap = null,
  audienceId = 'global',
  audienceName = '',
  audienceOptions = [],
  onAudienceChange,
  poolExcludesNight = false,
  standingsTo = '/dashboard/standings',
  makePicksTo = '/dashboard',
  className = '',
}) {
  const copy = stateCopy(state);
  const playerWord = recap?.totalPlayers === 1 ? 'player' : 'players';
  const showAudience = audienceOptions.length > 1;
  const rankAudience = audienceId !== 'global' && audienceName ? audienceName : '';

  return (
    <InfoTooltipProvider>
      <DashboardJobShell
        as="section"
        tone="amber"
        pad="label"
        className={`flex flex-col ${className}`}
        aria-label="Scorecard"
        aria-busy={isLoading || undefined}
      >
      <div className="flex items-start justify-between gap-2">
        <p className={`inline-flex items-center gap-1.5 ${SCORECARD_EYEBROW}`}>
          <ClipboardList className={SCORECARD_EYEBROW_ICON} aria-hidden />
          Scorecard
        </p>
        <InfoTooltip
          label="Scorecard"
          definition={SCORECARD_HINT}
          triggerClassName="text-content-secondary hover:text-white"
        />
      </div>
      <HundredthShowCardMark showDate={showDate} />

      {showAudience ? (
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className={SCORECARD_SLOT_LABEL}>{SCORECARD_AUDIENCE_LABEL}</span>
          <select
            aria-label="Scorecard audience"
            value={audienceId}
            onChange={(event) => onAudienceChange?.(event.target.value)}
            className="min-w-0 max-w-[14rem] rounded-lg border border-border-subtle bg-surface-panel px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {audienceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {isLoading ? (
        <p className={`mt-2 ${SCORECARD_BODY}`}>{SCORECARD_LOADING_LABEL}…</p>
      ) : null}

      {!isLoading && state === 'empty' ? (
        <div className="mt-1">
          <p className={SCORECARD_TITLE}>{SCORECARD_EMPTY_TITLE}</p>
          <p className={`mt-1 ${SCORECARD_BODY}`}>{SCORECARD_EMPTY_BODY}</p>
          <Link
            to={makePicksTo}
            className="mt-3 inline-flex text-sm font-bold text-brand-primary underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            Go to Make Picks
          </Link>
        </div>
      ) : null}

      {!isLoading && state !== 'empty' ? (
        <>
          {showLabel ? (
            <p className={`mt-1 ${SCORECARD_BODY}`}>{showLabel}</p>
          ) : null}

          {showRank ? (
            <div className="mt-3 border-t border-border-subtle/35 pt-3">
              {poolExcludesNight ? (
                <p className={SCORECARD_BODY}>{scorecardPoolExcludedCopy(audienceName)}</p>
              ) : recap?.displayRank != null ? (
                <p
                  className={SCORECARD_TITLE}
                  aria-label={`Rank ${recap.displayRank} of ${recap.totalPlayers} ${playerWord}${
                    rankAudience ? ` in ${rankAudience}` : ''
                  }${recap.totalScore != null ? `, ${recap.totalScore} points` : ''}`}
                >
                  <span className="tabular-nums">#{recap.displayRank}</span>
                  <span className="font-bold text-content-secondary"> of </span>
                  <span className="tabular-nums">{recap.totalPlayers}</span>
                  <span className="font-bold text-content-secondary"> {playerWord}</span>
                  {rankAudience ? (
                    <span className="font-bold text-content-secondary"> in {rankAudience}</span>
                  ) : null}
                  <span className="mx-1.5 text-content-secondary">·</span>
                  <span className="tabular-nums text-brand-primary">
                    {recap.totalScore != null ? recap.totalScore : '—'}
                  </span>
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-content-secondary">
                    pts
                  </span>
                </p>
              ) : (
                <p className={SCORECARD_BODY}>{SCORECARD_RANK_PENDING}</p>
              )}
              <Link
                to={standingsTo}
                className="mt-1.5 inline-flex text-xs font-bold text-brand-primary underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
              >
                {PICKS_SELF_RECAP_STANDINGS_LINK}
              </Link>
            </div>
          ) : null}

          <StatsRatesDidYouKnow className="mt-3" />

          <ul className="mt-3 space-y-2.5">
            {slots.map((slot) => {
              const crowd = showCrowd ? slot.crowdShareLabel : null;
              const grade = state === 'graded' ? slot.grade : null;
              const chrome = scorecardHitChromeSpec(grade);
              const statusLabel = hitStatusLabel(grade);
              return (
                <li
                  key={slot.fieldId}
                  className={slotItemClass(chrome)}
                  data-scorecard-hit={grade ? String(Boolean(grade.hit)) : undefined}
                  data-scorecard-kind={grade?.kind}
                >
                  <p className={SCORECARD_SLOT_LABEL}>{slot.label}</p>
                  <p className={`mt-0.5 flex min-w-0 items-start gap-1.5 ${slotTitleClass(chrome)}`}>
                    {chrome.showCheck ? (
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 self-center ${SCORECARD_SLOT_CHECK[chrome.checkTone] || ''}`}
                        strokeWidth={2.75}
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 break-words">{slot.song}</span>
                    {statusLabel ? <span className="sr-only">{statusLabel}</span> : null}
                  </p>
                  {showOverlap ? (
                    <p className={`mt-1 ${SCORECARD_METRIC}`}>
                      {formatOverlapLabel(slot.alsoPickedCount ?? 0)}
                    </p>
                  ) : null}
                  {crowd ? (
                    <p className={`mt-1 ${SCORECARD_METRIC}`}>
                      <span className="text-content-secondary/80">{SCORECARD_CROWD_LABEL}</span>
                      {' '}
                      <span className="tabular-nums text-brand-primary">{crowd}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {copy ? <p className={`mt-3 ${SCORECARD_BODY}`}>{copy}</p> : null}
        </>
      ) : null}
    </DashboardJobShell>
    </InfoTooltipProvider>
  );
}

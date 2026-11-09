import React from 'react';
import { Link } from 'react-router-dom';

import {
  MARKETING_EDITORIAL_TYPE_BODY,
  MARKETING_EDITORIAL_TYPE_META,
} from '../../../shared/ui/marketingEditorialChrome.js';
import { LINK_ON_LIGHT } from '../../../shared/ui/surfaceLinkStyles.js';
import {
  SCORING_LADDER_V2_TOUR_NAME,
  formatScoringLadderEffectiveDate,
  scoringLadderComparisonRows,
} from '../../../shared/utils/scoring.js';

/**
 * Backtest in the #1086 addendum (439 graded cards, 34 shows, 2026-04-16
 * through 2026-10-06). Counts only. No player names.
 */
const SCORE_BUCKETS = [
  { label: '0', before: 111, after: 111 },
  { label: '1-5', before: 104, after: 126 },
  { label: '6-10', before: 63, after: 69 },
  { label: '11-20', before: 86, after: 78 },
  { label: '21-35', before: 49, after: 32 },
  { label: '36+', before: 26, after: 23 },
];

const BUCKET_MAX = Math.max(...SCORE_BUCKETS.flatMap((row) => [row.before, row.after]));

const H2 = 'mb-3 mt-10 text-xl font-bold tracking-tight text-slate-900';
const BODY = `font-semibold leading-relaxed text-slate-600 ${MARKETING_EDITORIAL_TYPE_BODY}`;

function pointsLabel(row) {
  const prefix = row.prefix || '';
  return `${prefix}${row.after}`;
}

function wasLabel(row) {
  const prefix = row.prefix || '';
  if (row.before === row.after && !row.beforeNote) return 'unchanged';
  if (row.beforeNote) return `was ${prefix}${row.before} for ${row.beforeNote}`;
  return `was ${prefix}${row.before}`;
}

/**
 * Scoring section of `/how-scoring-changed` (#1086).
 * Ranking and tie-breaks stay on #1172 / #1218 and are not on this page.
 */
export default function HowScoringChangedContent() {
  const effectiveLabel = formatScoringLadderEffectiveDate();
  const rows = scoringLadderComparisonRows();

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm ring-1 ring-slate-900/5 md:p-8">
      <p className={BODY}>
        If you&apos;ve been playing Setlist Pick&apos;em, how some picks are scored is changing.
      </p>
      <p className={`mt-4 ${BODY}`}>
        Nights you&apos;ve already played keep the rules that were live that night. We are not
        going back to change those scores.
      </p>

      <h2 className={H2}>Why</h2>
      <p className={BODY}>
        Calling the slot is the skill. A song that simply got played was paying like you&apos;d
        nailed the slot, so consistent presence hits were stacking up the way exacts should. A
        played song still scores. It just scores less.
      </p>

      <h2 className={H2}>Scoring, starting {effectiveLabel}</h2>
      <p className={BODY}>
        The new ladder starts with {SCORING_LADDER_V2_TOUR_NAME}. Here&apos;s what a pick is worth:
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-4 border-b border-[#e2e8f0] pb-3">
            <span className={`min-w-0 ${BODY}`}>{row.label}</span>
            <span className="shrink-0 text-right">
              <span className="text-lg font-black tabular-nums text-slate-900">{pointsLabel(row)}</span>
              <span className={`mt-0.5 block ${MARKETING_EDITORIAL_TYPE_META} font-semibold text-slate-500`}>
                {wasLabel(row)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-4 ${BODY}`}>
        Your encore pick is worth 15 if it is the first song of the encore. If it shows up later
        in the encore, it is worth 10. If it was played but not in the encore, it is still 5.
      </p>
      <p className={`mt-4 ${BODY}`}>
        A wildcard that gets played is now 5, same as any other song that appeared somewhere in
        the show. It still scores. It just doesn&apos;t pay like an exact.
      </p>
      <p className={`mt-4 ${BODY}`}>
        Bustout Boost is the same: +20 on top of whatever the pick already earned, for a song
        with a 30-show gap or more.
      </p>

      <h2 className={H2}>How a night can look</h2>
      <p className={BODY}>Same card, old rules vs new:</p>
      <ul className={`mt-3 list-disc space-y-2 pl-5 ${BODY}`}>
        <li>Wildcard only: 10 to 5</li>
        <li>Later encore song: 15 to 10</li>
        <li>Both on one card: down 10</li>
      </ul>
      <p className={`mt-4 ${BODY}`}>
        First encore, exact slots, and in-setlist 5s do not move. The +20 bustout does not move,
        except where the base under it changed: a bustout wildcard goes from 30 to 25, and a
        bustout later-encore goes from 35 to 30.
      </p>

      <h2 className={H2}>What a recent run would have looked like</h2>
      <p className={BODY}>
        On a recent run we checked against this ladder, most cards stayed the same. About one
        card in four dropped by 5. Nobody who scored fell to zero. The season lead held.
      </p>
      <p className={`mt-4 ${BODY}`}>
        439 graded cards across 34 shows, from April 16 through October 6, 2026. 324 cards
        unchanged. 113 dropped by 5. 2 dropped by 10. The mean moved from 12.2 to 10.8, and the
        median from 10 to 5, because many nights were exactly one wildcard hit. Zeros stayed at
        111. Those nights were not re-scored.
      </p>
      <div className="mt-6" aria-label="Cards in each score bucket, then and on this ladder">
        <div className={`mb-2 flex justify-end gap-4 ${MARKETING_EDITORIAL_TYPE_META} font-semibold text-slate-500`}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-slate-400" aria-hidden="true" />
            Then
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-teal-700" aria-hidden="true" />
            This ladder
          </span>
        </div>
        <ul className="space-y-3">
          {SCORE_BUCKETS.map((bucket) => (
            <li key={bucket.label}>
              <div className={`mb-1 flex justify-between ${MARKETING_EDITORIAL_TYPE_META} font-semibold text-slate-700`}>
                <span>{bucket.label} points</span>
                <span className="tabular-nums">
                  {bucket.before} then, {bucket.after} on this ladder
                </span>
              </div>
              <div className="space-y-1" aria-hidden="true">
                <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${(bucket.before / BUCKET_MAX) * 100}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className="h-full rounded-full bg-teal-700"
                    style={{ width: `${(bucket.after / BUCKET_MAX) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <h2 className={H2}>What does not change</h2>
      <p className={BODY}>
        Your past nights keep the scores they already have. Bustout Boost stays a flat +20 for a
        30-show gap or more. Exact openers and closers stay at 10. The first encore song stays
        at 15.
      </p>
      <p className={`mt-6 ${MARKETING_EDITORIAL_TYPE_META} font-semibold text-slate-600`}>
        The live rules are on{' '}
        <Link to="/how-scoring-works" className={LINK_ON_LIGHT}>
          how scoring works
        </Link>
        .
      </p>
    </div>
  );
}

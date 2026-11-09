import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import PlayerHandleLink from '../../../shared/ui/PlayerHandleLink';
import {
  GLOBAL_LEADERBOARD_PAGE_SIZE,
  formatBoardValue,
  leaderboardPageWindow,
} from '../model/globalLeaderboardRanking';

const PAGER_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle/50 text-slate-200 transition-colors hover:border-brand-primary/50 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border-subtle/50 disabled:hover:text-slate-200';

const rankBadgeClass = (rank, outsideTop) => {
  if (outsideTop) return 'bg-surface-inset text-content-secondary ring-1 ring-border-muted';
  if (rank === 1) return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40';
  if (rank === 2)
    return 'bg-brand-accent-blue/15 text-blue-200 ring-1 ring-brand-accent-blue/35';
  if (rank === 3) return 'bg-orange-900/40 text-orange-200 ring-1 ring-orange-700/40';
  return 'bg-surface-inset text-slate-300 ring-1 ring-border-muted';
};

/**
 * @param {{
 *   title: string,
 *   boardKey: 'pointsPerShow' | 'pickingAverage' | 'sluggingPercentage' | 'averageVintage' | 'bustoutBoosts',
 *   rows: Array<{
 *     uid: string,
 *     handle: string,
 *     value: number | null,
 *     shows: number,
 *     rank: number | null,
 *     isSelf?: boolean,
 *     outsideTop?: boolean,
 *     belowMinimum?: boolean,
 *     belowMinimumReason?: 'shows' | 'value',
 *   }>,
 * }} props
 */
export default function GlobalLeaderboardBoard({ title, boardKey, rows }) {
  const list = Array.isArray(rows) ? rows : [];
  const ranked = list.filter((row) => !row.outsideTop);
  const youOutside = list.find((row) => row.outsideTop) ?? null;
  const [page, setPage] = useState(0);
  const total = ranked.length;
  const { current, maxPage, start, end } = leaderboardPageWindow(total, page);
  const pageRows = ranked.slice(start, end);
  const selfOnPage = pageRows.some((row) => row.isSelf);
  const pinnedSelf =
    !selfOnPage && !youOutside
      ? ranked.find((row) => row.isSelf) ?? null
      : null;

  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
        {title}
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-content-secondary">
          No ranked players yet. Boards refresh after each score rollup.
        </p>
      ) : (
        <>
          <ol className="space-y-1.5">
            {pageRows.map((row) => (
              <LeaderboardRow key={row.uid} row={row} boardKey={boardKey} />
            ))}
          </ol>
          {total > GLOBAL_LEADERBOARD_PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-1.5 border-t border-border-subtle/40 pt-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, current - 1))}
                disabled={current === 0}
                aria-label={`Previous ${title} page`}
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
                aria-label={`Next ${title} page`}
                className={PAGER_BUTTON}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
          {pinnedSelf || youOutside ? (
            <ol className="space-y-1.5 border-t border-border-subtle/40 pt-2">
              <LeaderboardRow
                key={`${(pinnedSelf || youOutside).uid}-you`}
                row={pinnedSelf || youOutside}
                boardKey={boardKey}
              />
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}

function LeaderboardRow({ row, boardKey }) {
  const rankLabel = row.belowMinimum
    ? '—'
    : row.outsideTop
      ? '50+'
      : row.rank != null
        ? String(row.rank)
        : '—';

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
        row.isSelf
          ? 'border-brand-primary/45 bg-brand-primary/10'
          : 'border-border-subtle/30 bg-surface-panel/80'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums ${rankBadgeClass(
            row.rank,
            row.outsideTop,
          )}`}
          aria-label={
            row.belowMinimum
              ? row.belowMinimumReason === 'value'
                ? 'Not ranked'
                : 'Not enough shows to rank'
              : row.outsideTop
                ? 'Outside top 50'
                : `Rank ${rankLabel}`
          }
        >
          {rankLabel}
        </span>
        <PlayerHandleLink
          userId={row.uid}
          handle={row.handle}
          className="truncate text-sm"
        />
        {row.isSelf ? (
          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-brand-primary">
            You
          </span>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-white">
          {formatBoardValue(boardKey, row.value)}
        </p>
        {boardKey !== 'shows' ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-content-secondary">
            {row.shows} {row.shows === 1 ? 'show' : 'shows'}
          </p>
        ) : null}
      </div>
    </li>
  );
}

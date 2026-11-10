import React from 'react';
import { Link } from 'react-router-dom';

import { NYE_RUN_PATH } from '../../msg-stats/nye';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import {
  DRY_RUN_SAMPLE_ROWS,
  HUNDREDTH_DRY_RUN_COPY,
  HUNDREDTH_EMPTY_BOARD_COPY,
  HUNDREDTH_SHOW_VENUE,
  projectPublicNightBoard,
  resolveHundredthShowDate,
} from '../model/hundredthShow';

/**
 * Public board for the 100th MSG show. Presentational.
 * Rows are projected again here so a caller cannot pass an email through.
 *
 * @param {{
 *   mode?: string,
 *   search?: string,
 *   rows?: unknown,
 *   loaded?: boolean,
 * }} props
 */
export default function HundredthShowBoardView({
  mode = 'production',
  search = '',
  rows = [],
  loaded = true,
}) {
  const resolved = resolveHundredthShowDate({ mode, search });
  const projected = projectPublicNightBoard(rows);
  const sample = resolved.dryRun && projected.length === 0;
  const board = sample ? projectPublicNightBoard(DRY_RUN_SAMPLE_ROWS) : projected;
  const nightLabel = resolved.dryRun ? resolved.date : 'January 2, 2027';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 min-w-0 space-y-3 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          The 100th
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Pick the 100th
        </h1>
        <p className="text-base leading-snug text-slate-300">
          {nightLabel} at {HUNDREDTH_SHOW_VENUE}. Same slots, same scoring.
          The public board lists handles only.
        </p>
      </header>

      {resolved.dryRun ? (
        <p className="mb-6 break-words text-sm leading-snug text-teal-200" role="status">
          {HUNDREDTH_DRY_RUN_COPY} This preview uses {resolved.date}.
          {sample ? ' The handles below are a sample, not that night.' : ''}
        </p>
      ) : null}

      <section className="mb-8 min-w-0">
        <h2 className="mb-3 font-display text-xl font-bold text-white">Public board</h2>
        {board.length ? (
          <ol className="min-w-0 divide-y divide-white/10">
            {board.map((row) => (
              <li
                key={`${row.rank}-${row.handle}`}
                className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 py-2.5 text-sm"
              >
                <span className="tabular-nums text-slate-400">{row.rank}</span>
                <span className="min-w-0 break-words font-semibold text-white">{row.handle}</span>
                <span className="col-start-2 text-slate-400">
                  {row.points} points · {row.exactSlots} exact slots
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-snug text-slate-300">
            {loaded ? HUNDREDTH_EMPTY_BOARD_COPY : 'Loading the public board.'}
          </p>
        )}
        <p className="mt-3 text-sm leading-snug text-slate-400">
          Handles, rank, points, and exact slots. No email addresses.
        </p>
      </section>

      <p className="text-sm leading-snug text-slate-400">
        <Link to="/phish-at-msg" className={LINK_ON_DARK}>
          Phish at MSG
        </Link>
        {' · '}
        <Link to={NYE_RUN_PATH} className={LINK_ON_DARK}>
          New Year&apos;s Run
        </Link>
      </p>
    </div>
  );
}

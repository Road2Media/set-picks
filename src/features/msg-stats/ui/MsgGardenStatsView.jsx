import React from 'react';
import { Link } from 'react-router-dom';

import { HUNDREDTH_SHOW_PATH } from '../../hundredth-show/public';
import { NYE_RUN_PATH } from '../model/nyeRunContract';
import { AppDocumentAuthLink } from '../../landing';
import { StatsEmbedShareRow } from '../../stats-embed';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import {
  formatCount,
  formatFanDate,
  MSG_SONG_COLUMN,
  MSG_TIMES_OPENED_COLUMN,
  MSG_TIMES_PLAYED_COLUMN,
  msgGardenSummarySentences,
} from '../model/msgGardenFacts';

/** Public MSG milestone stats (#1139). Presentational only. */
export default function MsgGardenStatsView({ stats, heading }) {
  const summary = msgGardenSummarySentences(stats);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          The Garden
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {heading || 'Phish at MSG'}
        </h1>
        <div className="space-y-2 text-base leading-snug text-slate-300">
          {summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="text-sm leading-snug text-slate-400">
          {formatCount(stats.uniqueSongs)} different songs across{' '}
          {formatCount(stats.showCount)} shows at the Garden.
          {' '}
          <Link to="/tour-stats" className={LINK_ON_DARK}>
            One tour at a time
          </Link>
          .
        </p>
      </header>

      <section className="mb-8">
        <h2 id="msg-most-played" className="mb-3 font-display text-xl font-bold text-white">
          Most-played songs at MSG
        </h2>
        <CountTable
          labelledBy="msg-most-played"
          countHeader={MSG_TIMES_PLAYED_COLUMN}
          rows={stats.topSongs}
        />
      </section>

      <section className="mb-8">
        <h2 id="msg-show-openers" className="mb-2 font-display text-xl font-bold text-white">
          Show openers at MSG
        </h2>
        <p className="mb-3 text-sm leading-snug text-slate-300">
          Songs that have opened a show at the Garden, and how many times, across{' '}
          {formatCount(stats.openerShowCount || stats.showCount)} shows.
        </p>
        <CountTable
          labelledBy="msg-show-openers"
          countHeader={MSG_TIMES_OPENED_COLUMN}
          rows={stats.openers}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold text-white">
          Songs debuted at MSG
        </h2>
        <ol className="space-y-1.5 text-sm text-slate-200">
          {stats.debuts.map((row) => (
            <li key={`${row.showDate}-${row.title}`}>
              <span className="font-semibold text-white">{row.title}</span>
              <span className="text-slate-400"> · {formatFanDate(row.showDate)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold text-white">
          Longest stretches between MSG shows
        </h2>
        <ol className="space-y-1.5 text-sm text-slate-200">
          {stats.longestVisitGaps.map((row) => (
            <li key={`${row.fromDate}-${row.toDate}`}>
              <span className="font-semibold text-white">{formatCount(row.days)} days</span>
              <span className="text-slate-400">
                {' '}
                · {formatFanDate(row.fromDate)} to {formatFanDate(row.toDate)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold text-white">
          Longest gaps that landed at MSG
        </h2>
        <ol className="space-y-1.5 text-sm text-slate-200">
          {stats.longestBustouts.map((row) => (
            <li key={`${row.showDate}-${row.title}`}>
              <span className="font-semibold text-white">{row.title}</span>
              <span className="text-slate-400">
                {' '}
                · {formatCount(row.gap)}-show gap on {formatFanDate(row.showDate)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-xl font-bold text-white">
          New Year&apos;s Eve at the Garden
        </h2>
        <p className="text-sm leading-snug text-slate-300">
          Phish has played New Year&apos;s Eve at the Garden{' '}
          {formatCount(stats.nyeShowCount)} times.
          {stats.nyeOpeners.length ? (
            <>
              {' '}
              Those nights opened most often with{' '}
              {stats.nyeOpeners
                .map((row) => `${row.title} (${formatCount(row.timesPlayed)})`)
                .join(', ')}
              .
            </>
          ) : null}
        </p>
      </section>

      <p className="text-sm leading-snug text-slate-400">
        Data courtesy of{' '}
        <a
          href="https://phish.net"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_ON_DARK}
        >
          Phish.net
        </a>{' '}
        / The Mockingbird Foundation.
      </p>

      <StatsEmbedShareRow />

      <div className="mt-6 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          The{' '}
          <Link to={NYE_RUN_PATH} className={LINK_ON_DARK}>
            New Year&apos;s Run
          </Link>{' '}
          is December 30, December 31, January 1, and January 2.
          January 2 is{' '}
          <Link to={HUNDREDTH_SHOW_PATH} className={LINK_ON_DARK}>
            the 100th
          </Link>
          . Lock a card before the lights go down.
        </p>
        <AppDocumentAuthLink
          signup
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-linear-to-r from-teal-400 to-teal-500 px-8 py-3.5 text-base font-black text-slate-900 shadow-glow-brand transition-all hover:-translate-y-0.5 hover:shadow-glow-brand-lg active:translate-y-0 active:scale-[0.98]"
        >
          Lock New Year&apos;s Run picks
        </AppDocumentAuthLink>
      </div>
    </div>
  );
}

function CountTable({ labelledBy, countHeader, rows }) {
  return (
    <table
      aria-labelledby={labelledBy}
      className="w-max max-w-full text-sm"
    >
      <thead>
        <tr className="text-xs text-slate-500">
          <th scope="col" className="pb-2 pr-8 text-left font-semibold">
            {MSG_SONG_COLUMN}
          </th>
          <th scope="col" className="whitespace-nowrap pb-2 text-right font-semibold">
            {countHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.title}>
            <td className="py-1 pr-8 font-semibold text-white">{row.title}</td>
            <td className="whitespace-nowrap py-1 text-right tabular-nums text-slate-300">
              {formatCount(row.timesPlayed)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

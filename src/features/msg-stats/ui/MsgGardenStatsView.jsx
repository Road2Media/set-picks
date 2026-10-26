import React from 'react';
import { Link } from 'react-router-dom';

import { AppDocumentAuthLink } from '../../landing';
import { StatsEmbedShareRow } from '../../stats-embed';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import {
  formatCount,
  formatFanDate,
  msgGardenSummarySentences,
} from '../model/msgGardenFacts';

/** Public MSG milestone stats (#1139). Presentational only. */
export default function MsgGardenStatsView({ stats, heading }) {
  const summary = msgGardenSummarySentences(stats);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          Tour Insights
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {heading || 'Phish at MSG, by the numbers'}
        </h1>
        <div className="space-y-2 text-base leading-snug text-slate-300">
          {summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="text-sm leading-snug text-slate-400">
          <Link to="/tour-stats" className={LINK_ON_DARK}>
            Tour Insights
          </Link>
          {' · '}
          {formatCount(stats.uniqueSongs)} different songs in {formatCount(stats.showCount)}{' '}
          shows. Aggregates only, not a night-by-night archive.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold text-white">
          Most-played songs at MSG
        </h2>
        <RankedList
          rows={stats.topSongs}
          label={(row) => `${formatCount(row.timesPlayed)} plays`}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-xl font-bold text-white">
          How MSG shows have opened
        </h2>
        <p className="mb-3 text-sm leading-snug text-slate-300">
          These are how often each song has opened a Phish show at MSG, across{' '}
          {formatCount(stats.openerShowCount || stats.showCount)} shows. Frequencies, not
          a pick tip.
        </p>
        <RankedList
          rows={stats.openers}
          label={(row) => `opened ${formatCount(row.timesPlayed)}`}
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
          New Year&apos;s Eve shows in this count: {formatCount(stats.nyeShowCount)}.
          {stats.nyeOpeners.length ? (
            <>
              {' '}
              Most frequent NYE openers:{' '}
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
          The New Year&apos;s Run is December 30, December 31, January 1, and January 2.
          Lock a card before the lights go down.
        </p>
        <AppDocumentAuthLink
          signup
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 px-8 py-3.5 text-base font-black text-slate-900 shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(45,212,191,0.7)] active:translate-y-0 active:scale-[0.98]"
        >
          Lock New Year&apos;s Run picks
        </AppDocumentAuthLink>
      </div>
    </div>
  );
}

function RankedList({ rows, label }) {
  return (
    <ol className="space-y-1.5 text-sm text-slate-200">
      {rows.map((row, index) => (
        <li key={row.title} className="flex items-baseline justify-between gap-4">
          <span>
            <span className="mr-2 text-slate-500">{index + 1}.</span>
            <span className="font-semibold text-white">{row.title}</span>
          </span>
          <span className="shrink-0 text-slate-400">{label(row)}</span>
        </li>
      ))}
    </ol>
  );
}

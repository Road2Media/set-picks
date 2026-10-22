import React from 'react';
import { Link } from 'react-router-dom';

import { AppDocumentAuthLink } from '../../landing';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import {
  ANNUAL_BUSTOUT_LIMIT,
  ANNUAL_TOP_SONG_LIMIT,
  annualSummarySentences,
  formatAnnualCount,
  formatAnnualFanDate,
} from '../model/annualTourStatsFacts';
import { ANNUAL_STANDINGS_PATH } from '../model/rollUpAnnualTourStats';

/** Public `/tour-stats/2026` (#1141). Presentational only. */
export default function AnnualTourStatsView({ stats, heading, status }) {
  const year = stats?.year || 2026;
  const summary = stats ? annualSummarySentences(stats) : [];
  const topSongs = stats?.topSongs?.slice(0, ANNUAL_TOP_SONG_LIMIT) || [];
  const bustouts = stats?.bustouts?.slice(0, ANNUAL_BUSTOUT_LIMIT) || [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          Tour Insights
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {heading || `${year} Phish tour statistics`}
        </h1>
        {status === 'loading' ? (
          <p className="text-base leading-snug text-slate-300">
            Adding up the {year} tour pages.
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="text-base leading-snug text-slate-300">
            The {year} totals could not be loaded. The tour pages are still on Tour Insights.
          </p>
        ) : null}
        {stats ? (
          <div className="space-y-2 text-base leading-snug text-slate-300">
            {summary.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </header>

      {stats ? (
        <>
          <section className="mb-8">
            <h2 className="mb-3 font-display text-xl font-bold text-white">
              Most-played songs in {year}
            </h2>
            <ol className="space-y-1.5 text-sm text-slate-200">
              {topSongs.length ? (
                topSongs.map((row, index) => (
                  <li key={row.title} className="flex items-baseline justify-between gap-4">
                    <span>
                      <span className="mr-2 text-slate-500">{index + 1}.</span>
                      <span className="font-semibold text-white">{row.title}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {formatAnnualCount(row.showAppearances)} nights
                      {row.timesPlayed > row.showAppearances
                        ? ` (${formatAnnualCount(row.timesPlayed)} song rows)`
                        : ''}
                    </span>
                  </li>
                ))
              ) : (
                <li>None in this count.</li>
              )}
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 font-display text-xl font-bold text-white">
              Bustouts in {year}
            </h2>
            <ol className="space-y-1.5 text-sm text-slate-200">
              {bustouts.length ? (
                bustouts.map((row) => (
                  <li key={`${row.showDate}-${row.title}`}>
                    <span className="font-semibold text-white">{row.title}</span>
                    <span className="text-slate-400">
                      {' '}
                      · {formatAnnualCount(row.gap)}-show gap on {formatAnnualFanDate(row.showDate)}
                    </span>
                  </li>
                ))
              ) : (
                <li>None in this count.</li>
              )}
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 font-display text-xl font-bold text-white">
              Tours in this total
            </h2>
            <ul className="space-y-1.5 text-sm text-slate-200">
              {stats.tours.map((tour) => (
                <li key={tour.tourSlug}>
                  <Link
                    to={`/tour-stats/${encodeURIComponent(tour.tourSlug)}`}
                    className={LINK_ON_DARK}
                  >
                    {tour.tourLabel}
                  </Link>
                  <span className="text-slate-400">
                    {' '}
                    · {formatAnnualCount(tour.showsWithSetlist)} shows ·{' '}
                    {formatAnnualCount(tour.uniqueSongs)} unique songs
                  </span>
                </li>
              ))}
            </ul>
            {stats.unsplitTours.length ? (
              <div className="mt-4 space-y-1.5 text-sm text-slate-300">
                <h3 className="font-semibold text-white">Not in the totals yet</h3>
                <ul className="space-y-1.5">
                  {stats.unsplitTours.map((tour) => (
                    <li key={tour.tourSlug}>
                      <Link
                        to={`/tour-stats/${encodeURIComponent(tour.tourSlug)}`}
                        className={LINK_ON_DARK}
                      >
                        {tour.tourLabel}
                      </Link>
                      <span className="text-slate-400">
                        {' '}
                        · {tour.showDatesInYear.join(', ')} stay in {year}. The tour page
                        also includes {tour.showDatesOutsideYear.join(', ')}.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <p className="text-sm leading-snug text-slate-400">
        Song and setlist data provided by{' '}
        <a
          href="https://phish.net"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_ON_DARK}
        >
          Phish.net
        </a>
        .
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          The annual podium is the standings board for {year}.{' '}
          <a href={ANNUAL_STANDINGS_PATH} className={LINK_ON_DARK}>
            {year} annual standings
          </a>
        </p>
        <AppDocumentAuthLink
          signup
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 px-8 py-3.5 text-base font-black text-slate-900 shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(45,212,191,0.7)] active:translate-y-0 active:scale-[0.98]"
        >
          Play the next show
        </AppDocumentAuthLink>
      </div>
    </div>
  );
}

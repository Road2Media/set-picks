import React from 'react';
import { Link } from 'react-router-dom';

import { HUNDREDTH_SHOW_PATH } from '../../hundredth-show/public';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

/**
 * Announced New Year's Run (#1144). Presentational.
 * Aggregates only when a tour doc exists. Never a night setlist.
 */
export default function NyeRunStatsView({
  shows,
  heading,
  poolHref,
  onPoolClick,
  stats = null,
}) {
  const nights = Array.isArray(shows) ? shows : [];
  const topSongs =
    stats && Array.isArray(stats.topSongs) && Number(stats.showsWithSetlist) > 0
      ? stats.topSongs.slice(0, 8)
      : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          Tour Insights
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {heading || "New Year's Run at MSG"}
        </h1>
        <p className="text-base leading-snug text-slate-300">
          Four nights at Madison Square Garden. January 2, 2027 is the 100th
          performance at the Garden. Call the slot you want before the lights go
          down.{' '}
          <Link to={HUNDREDTH_SHOW_PATH} className={LINK_ON_DARK}>
            Pick the 100th
          </Link>
          .
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold text-white">The four shows</h2>
        <ul className="space-y-2 text-sm text-slate-200">
          {nights.map((show) => (
            <li key={show.date}>
              <span className="font-semibold text-white">{show.fanDate}</span>
              <span className="text-slate-400">
                {' '}
                · {show.venueName}, {show.address}
                {show.hundredth ? ' · 100th performance' : ''}
              </span>
              {' · '}
              <a
                href={show.url}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_ON_DARK}
              >
                phish.com
              </a>
            </li>
          ))}
        </ul>
      </section>

      {topSongs.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-bold text-white">
            Most-played songs on this run
          </h2>
          <ol className="space-y-1.5 text-sm text-slate-200">
            {topSongs.map((row, index) => (
              <li key={row.title}>
                <span className="mr-2 text-slate-500">{index + 1}.</span>
                <span className="font-semibold text-white">{row.title}</span>
                <span className="text-slate-400">
                  {' '}
                  · {row.timesPlayed} plays
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-slate-400">
            Totals only. Not a night&apos;s setlist. Data courtesy of{' '}
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
        </section>
      ) : (
        <p className="mb-8 text-sm leading-snug text-slate-400">
          Song totals go up after the nights are played. This page lists the
          shows, not a setlist. Data courtesy of{' '}
          <a
            href="https://phish.net"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_ON_DARK}
          >
            Phish.net
          </a>
          {' / The Mockingbird Foundation. '}
          <Link to="/phish-at-msg" className={LINK_ON_DARK}>
            Phish at MSG
          </Link>{' '}
          has the Garden totals.
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          <Link to="/tour-stats" className={LINK_ON_DARK}>
            Tour Insights
          </Link>
        </p>
        <a
          href={poolHref}
          onClick={onPoolClick}
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 px-8 py-3.5 text-base font-black text-slate-900 shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(45,212,191,0.7)] active:translate-y-0 active:scale-[0.98]"
        >
          Create a NYE pool
        </a>
      </div>
    </div>
  );
}

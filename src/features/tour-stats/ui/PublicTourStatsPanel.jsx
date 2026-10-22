import React from 'react';
import { Link } from 'react-router-dom';

import { AppDocumentAuthLink } from '../../landing';
import TourStatsView from '../ui/TourStatsView';
import TourWrapBlock from './TourWrapBlock';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

const LIVE_TOUR_LEDE =
  'Phish tour setlist statistics: most-played songs, song frequency, bustouts by tour, and gap highlights that keep you sharp between shows. Updated every night the band plays.';

const FINISHED_TOUR_LEDE =
  'Phish tour setlist statistics for a finished run: most-played songs, song frequency, bustouts by tour, and gap highlights.';

/** Live SEO slug for the current summer run (#927 / #929). */
const SUMMER_TOUR_SEO_PATH = '/tour-stats/2026-summer-tour';
const SPHERE_TOUR_SEO_PATH = '/tour-stats/2026-sphere';

/**
 * Public marketing chrome around tour stats (#665 / #929).
 */
export default function PublicTourStatsPanel({
  tours,
  activeSlug,
  tourName,
  heading,
  hasTour,
  indexLoading,
  statsLoading,
  error,
  stats,
  onSelectTour,
  routeHasSlug = false,
  defaultTourSlug = '',
  wrap = null,
}) {
  const h1 =
    heading ||
    (hasTour && tourName
      ? `${tourName} setlist statistics`
      : 'Phish tour setlist statistics');

  const isHub = !routeHasSlug;
  const currentSlug = (defaultTourSlug || activeSlug || '').trim();
  const currentTourLabel =
    tours.find((t) => t.tourSlug === currentSlug)?.tourLabel ||
    (currentSlug === '2026-summer-tour' ? '2026 Summer Tour' : '') ||
    'the current tour';
  const currentTourPath = currentSlug
    ? `/tour-stats/${encodeURIComponent(currentSlug)}`
    : SUMMER_TOUR_SEO_PATH;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-5 space-y-2 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          Tour Insights
        </p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {h1}
        </h1>
        <p className="text-base leading-snug text-slate-300">
          {wrap ? FINISHED_TOUR_LEDE : LIVE_TOUR_LEDE}
        </p>
        {isHub ? (
          <p className="text-sm leading-snug text-slate-400">
            <strong className="font-semibold text-slate-300">Current:</strong>{' '}
            <Link to={currentTourPath} className={LINK_ON_DARK}>
              {currentTourLabel} setlist statistics
            </Link>
            {' · '}
            <strong className="font-semibold text-slate-300">Archive:</strong>{' '}
            <Link to={SPHERE_TOUR_SEO_PATH} className={LINK_ON_DARK}>
              2026 Sphere
            </Link>
            {' · '}
            <Link to="/tour-stats/2026" className={LINK_ON_DARK}>
              2026 tours
            </Link>
            {' · '}
            <Link to="/tour-stats/msg" className={LINK_ON_DARK}>
              Phish at MSG
            </Link>
          </p>
        ) : null}
      </header>

      <TourWrapBlock wrap={wrap} />

      {tours.length > 0 ? (
        <label className="mb-6 flex flex-col gap-2 sm:max-w-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Tour filter
          </span>
          {/*
            Teal chrome via border (not ring): Safari often drops box-shadow rings
            on native <select>; appearance-none + border matches Chrome (#927).
          */}
          <div className="relative">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border-2 border-teal-400 bg-brand-bg-deep py-2.5 pl-3 pr-10 text-sm font-semibold text-white outline-none transition-colors focus-visible:border-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              value={activeSlug}
              onChange={(e) => onSelectTour(e.target.value)}
              disabled={indexLoading}
            >
              {tours.map((t) => (
                <option key={t.tourSlug} value={t.tourSlug}>
                  {t.tourLabel}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-teal-300"
              aria-hidden
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </label>
      ) : indexLoading ? (
        <div
          className="mb-6 h-[4.25rem] animate-pulse rounded-xl border border-white/10 bg-white/5 sm:max-w-xs"
          aria-hidden
        />
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Could not load public tour stats. Try again later.
        </p>
      ) : null}

      <TourStatsView
        tourName={tourName}
        hasTour={hasTour}
        calendarLoading={indexLoading}
        setlistLoading={statsLoading}
        setlistError={error}
        stats={stats}
        setlistReads={0}
        overlay={null}
        overlayLoading={false}
        showSelfOverlay={false}
        surface="public"
      />

      <p className="mt-8 text-center text-sm leading-snug text-slate-400 sm:text-left">
        Tour-wide trends only, not a night-by-night archive. Play and your
        personal stats start counting.{' '}
        <Link to="/how-it-works" className={LINK_ON_DARK}>
          How it works
        </Link>
        {' · '}
        <Link to="/phish-setlist-prediction-game" className={LINK_ON_DARK}>
          Phish setlist prediction game
        </Link>
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Ready to compete on the next show? Or skim{' '}
          <Link to="/how-scoring-works" className={LINK_ON_DARK}>
            how scoring works
          </Link>{' '}
          first.
        </p>
        <AppDocumentAuthLink
          signup
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 px-8 py-3.5 text-base font-black text-slate-900 shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(45,212,191,0.7)] active:translate-y-0 active:scale-[0.98]"
        >
          Make picks for this tour
        </AppDocumentAuthLink>
      </div>
    </div>
  );
}

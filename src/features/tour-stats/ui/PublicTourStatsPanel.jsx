import React from 'react';
import { Link } from 'react-router-dom';

import { NYE_RUN_PATH } from '../../msg-stats/nye';
import { AppDocumentAuthLink } from '../../landing';
import { StatsEmbedShareRow } from '../../stats-embed';
import TourStatsView from '../ui/TourStatsView';
import TourWrapBlock from './TourWrapBlock';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

const LIVE_TOUR_LEDE =
  'The songs Phish keeps playing, the bustouts, and the long gaps. Updated after every show.';

const FINISHED_TOUR_LEDE =
  'This run is done. The songs Phish played most, the bustouts, and the long gaps.';

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
      : 'What Phish is playing this tour');

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
    <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-3 space-y-1.5 text-center sm:space-y-2 sm:text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          Tour stats
        </p>
        <h1 className="font-display text-xl font-bold leading-tight text-white sm:text-4xl">
          {h1}
        </h1>
        <p
          className={`text-sm leading-snug text-slate-300 sm:text-base ${wrap ? 'hidden sm:block' : ''}`}
        >
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
            <Link to={NYE_RUN_PATH} className={LINK_ON_DARK}>
              New Year&apos;s Run
            </Link>
          </p>
        ) : null}
      </header>

      <div className="mb-3 flex items-end justify-between gap-3">
        {tours.length > 0 ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Tour filter
          </span>
          {/*
            Teal chrome via border (not ring): Safari often drops box-shadow rings
            on native <select>; appearance-none + border matches Chrome (#927).
          */}
          <div className="relative">
            <select
              id="tour-stats-filter"
              className="w-full cursor-pointer appearance-none rounded-xl border-2 border-teal-400 bg-brand-bg-deep py-2 pl-3 pr-10 text-sm font-semibold text-white outline-none transition-colors focus-visible:border-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="h-14 flex-1 animate-pulse rounded-xl border border-white/10 bg-white/5 sm:max-w-xs"
            aria-hidden
          />
        ) : (
          <span />
        )}
        <a
          href="#tour-stats-start"
          className={`${LINK_ON_DARK} mb-2 shrink-0 text-sm font-semibold`}
        >
          Stats
        </a>
      </div>

      <TourWrapBlock wrap={wrap} />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Could not load public tour stats. Try again later.
        </p>
      ) : null}

      <div id="tour-stats-start" className="scroll-mt-28">
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
      </div>

      <StatsEmbedShareRow tourSlug={activeSlug} />

      <p className="mt-8 text-center text-sm leading-snug text-slate-400 sm:text-left">
        The songs that shaped the tour. Lock a card for the next show.{' '}
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

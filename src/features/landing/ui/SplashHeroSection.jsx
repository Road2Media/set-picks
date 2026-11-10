import React from 'react';
import { Link } from 'react-router-dom';

import Button from '../../../shared/ui/Button';
import SplashHeroWordmark from './SplashHeroWordmark';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

/**
 * Splash hero — primary CTA → `/login?mode=signup`; secondary links are real
 * marketing routes for crawlable internal linking (#663).
 *
 * #837 spacing:
 * - Mobile: full-viewport hero + 50/50 flex spacers around the CTA.
 * - sm+: fill the viewport so the next section doesn’t peek above the fold;
 *   leftover height sits *below* the CTA (dark band), not between header and brand.
 */
export default function SplashHeroSection({ onPlayNowClick, onAuthCtaIntent }) {
  return (
    <section className="relative flex min-h-svh w-full flex-col bg-transparent pt-[5.35rem] pb-6 sm:min-h-[calc(100svh+2px)] sm:pt-18 sm:pb-10 lg:pt-20 lg:pb-12">
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pt-1 text-center sm:px-6 sm:pt-0 lg:px-8">
        <h1
          className="relative left-1/2 w-screen max-w-[100vw] shrink-0 -translate-x-1/2 overflow-visible leading-none sm:left-0 sm:w-full sm:max-w-none sm:translate-x-0"
          aria-label={"Setlist Pick 'Em"}
        >
          <SplashHeroWordmark />
          <span className="sr-only">
            Setlist Pick &apos;Em: the free Phish setlist prediction game
          </span>
        </h1>

        <div className="mx-auto mt-6 max-w-2xl shrink-0 sm:mt-2 md:mt-3">
          <p className="mb-3 text-lg font-bold tracking-wide text-teal-400 drop-shadow-[0_0_12px_rgba(45,212,191,0.5)] sm:mb-4 md:text-xl">
            The free Phish setlist prediction game. Live on tour.
          </p>

          <p className="text-base font-normal leading-relaxed text-slate-300 md:text-lg md:leading-relaxed">
            Make picks for tonight&apos;s show, watch scores update as songs are played, and
            compete with your tour crew for the top spot.
          </p>

          <p className="mt-4 text-base font-normal leading-relaxed text-slate-300 sm:mt-5 md:text-lg md:leading-relaxed">
            What started as a game on paper 25 years ago is now a live setlist game you can play
            from the venue or from couch tour. Invite your friends and keep an eye on{' '}
            <Link to="/tour-stats" className={LINK_ON_DARK}>
              tour stats
            </Link>
            . New here? See{' '}
            <Link to="/how-it-works" className={LINK_ON_DARK}>
              how it works
            </Link>
            .
          </p>
        </div>

        {/* Mobile: split leftover viewport 50/50 above vs below CTA. Hidden sm+. */}
        <div className="min-h-2 flex-1 sm:hidden" aria-hidden />

        <div className="mx-auto flex w-full max-w-md shrink-0 flex-col items-center gap-5 sm:mt-8 sm:gap-5 md:mt-9">
          <Button
            variant="primary"
            type="button"
            onClick={onPlayNowClick}
            onPointerEnter={onAuthCtaIntent}
            onFocus={onAuthCtaIntent}
            onPointerDown={onAuthCtaIntent}
            aria-label="Jump on Tour: create an account"
            className="w-full min-w-48 sm:w-auto"
          >
            Jump on Tour
          </Button>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:gap-x-8"
            aria-label="Learn more"
          >
            <Link to="/how-it-works" className={LINK_ON_DARK}>
              How it works
            </Link>
            <Link to="/tour-stats" className={LINK_ON_DARK}>
              Tour stats
            </Link>
            <Link to="/phish-setlist-prediction-game" className={LINK_ON_DARK}>
              What is this game?
            </Link>
          </nav>
        </div>

        {/* Mobile: lower flex spacer. sm+: absorb leftover height under CTA for a clean fold. */}
        <div className="min-h-2 flex-1" aria-hidden />
      </div>
    </section>
  );
}

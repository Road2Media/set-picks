import React from 'react';
import { Link } from 'react-router-dom';

import Button from '../../../shared/ui/Button';
import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

/** Shared type for splash bottom peer links (#947). */
const SPLASH_BOTTOM_LINK = `text-sm ${LINK_ON_DARK}`;

export default function SplashAboutSection({
  sectionRef,
  headingRef,
  onGetStartedClick,
  onAuthCtaIntent,
}) {
  return (
    <section
      ref={sectionRef}
      className="relative z-10 w-full bg-transparent py-20 md:py-24 lg:py-32"
    >
      <div className={`mx-auto w-full max-w-5xl ${MARKETING_PAGE_GUTTER_X}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-16 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-[6.5vw] sm:text-4xl md:text-5xl lg:text-6xl font-bold italic text-transparent bg-clip-text bg-linear-to-r from-red-500 to-blue-500 mb-2 lg:mb-8 outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400 rounded-md leading-tight whitespace-nowrap sm:whitespace-normal"
            >
              About Setlist Pick &apos;Em
            </h2>

            <div className="hidden lg:block mt-12">
              <p className="text-xl text-slate-300 italic border-l-4 border-teal-400/50 pl-6 leading-relaxed">
                &quot;Lock your picks, ride the scores, run with your crew—one show at a time.&quot;
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 text-slate-300 font-normal leading-relaxed space-y-6 text-base md:text-lg">
            <p>
              Born on Phish tour in 2001. Paper picks became a spreadsheet, and the spreadsheet
              became a live setlist prediction game for friends and crews. Phish first; more bands
              soon.
            </p>
            <p>
              <Link to="/about" className={LINK_ON_DARK}>
                Read the full story
              </Link>
            </p>

            <div className="block lg:hidden mt-10">
              <p className="text-lg text-slate-300 italic border-l-4 border-teal-400/50 pl-5 leading-relaxed">
                &quot;Lock your picks, ride the scores, run with your crew—one show at a time.&quot;
              </p>
            </div>
          </div>
        </div>

        <nav
          className="mt-16 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-slate-800 pt-8 lg:justify-end"
          aria-label="Jump to How it works, tour stats, or create an account"
        >
          <Link to="/how-it-works" className={SPLASH_BOTTOM_LINK}>
            How it works
          </Link>
          <span className="select-none text-sm text-slate-600" aria-hidden>
            ·
          </span>
          <Link to="/tour-stats" className={SPLASH_BOTTOM_LINK}>
            Tour stats
          </Link>
          <span className="select-none text-sm text-slate-600" aria-hidden>
            ·
          </span>
          <Button
            variant="link"
            size="none"
            type="button"
            onClick={onGetStartedClick}
            onPointerEnter={onAuthCtaIntent}
            onFocus={onAuthCtaIntent}
            onPointerDown={onAuthCtaIntent}
            className={SPLASH_BOTTOM_LINK}
          >
            Get started
          </Button>
        </nav>
      </div>
    </section>
  );
}

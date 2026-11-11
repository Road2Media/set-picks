import React from 'react';
import { Link } from 'react-router-dom';

import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

export default function SplashAboutSection({
  sectionRef,
  headingRef,
}) {
  return (
    <section
      ref={sectionRef}
      className="relative z-10 w-full bg-transparent pt-20 pb-6 md:pt-24 md:pb-8 lg:pt-32 lg:pb-10"
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
      </div>
    </section>
  );
}

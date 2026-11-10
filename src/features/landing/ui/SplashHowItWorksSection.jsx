import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import Button from '../../../shared/ui/Button';
import {
  MARKETING_EDITORIAL_CARD,
  MARKETING_EDITORIAL_CARD_ACTION,
  MARKETING_EDITORIAL_CARD_TRACK,
  MARKETING_EDITORIAL_TYPE_BODY,
  MARKETING_PAGE_GUTTER_X,
} from '../../../shared/ui/marketingEditorialChrome';
import {
  CARD_LINK_ON_LIGHT,
  LINK_ON_LIGHT,
} from '../../../shared/ui/surfaceLinkStyles';

export default function SplashHowItWorksSection({
  sectionRef,
  headingRef,
  onCreateAccountClick,
  onAuthCtaIntent,
}) {
  return (
    <section
      ref={sectionRef}
      className="relative z-10 w-full bg-slate-50 py-20 md:py-24 lg:py-32"
    >
      <div className={`mx-auto w-full max-w-5xl ${MARKETING_PAGE_GUTTER_X}`}>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-4 rounded-md text-center font-display text-display-lg font-bold text-slate-900 outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue md:text-display-lg-lg"
        >
          Game Format
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-base leading-relaxed text-slate-600">
          Lock in picks, track live setlists and scores, and watch the real-time
          leaderboard. Prefer the full walkthrough? See{' '}
          <Link to="/how-it-works" className={LINK_ON_LIGHT}>
            how it works
          </Link>
          , or peek at{' '}
          <Link to="/tour-stats" className={LINK_ON_LIGHT}>
            tour stats
          </Link>{' '}
          before you lock picks.
        </p>

        <div className={MARKETING_EDITORIAL_CARD_TRACK}>
          <div className={MARKETING_EDITORIAL_CARD}>
            <div className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-black text-emerald-600">
              1
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-900">Lock It In</h3>
            <p className={`${MARKETING_EDITORIAL_TYPE_BODY} leading-relaxed text-slate-600`}>
              Pick openers, closers, encore, and wildcard before showtime. Correct picks earn points, exact slots earn more, and a Bustout Boost™ pays out when you call a longshot.
            </p>
            <Link
              to="/how-scoring-works"
              className={`${MARKETING_EDITORIAL_CARD_ACTION} ${CARD_LINK_ON_LIGHT}`}
            >
              Learn how scoring works
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className={MARKETING_EDITORIAL_CARD}>
            <div className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-black text-blue-600">
              2
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-900">Watch It Unfold</h3>
            <p className={`${MARKETING_EDITORIAL_TYPE_BODY} leading-relaxed text-slate-600`}>
              Live scores and standings update as songs are played. Watch your picks and your friends&apos; picks light up the leaderboard.
            </p>
          </div>

          <div className={MARKETING_EDITORIAL_CARD}>
            <div className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xl font-black text-purple-600">
              3
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-900">Claim the Crown</h3>
            <p className={`${MARKETING_EDITORIAL_TYPE_BODY} leading-relaxed text-slate-600`}>
              Challenge friends in private pools and compete in global standings. Your personal stats grow with every show you play.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4">
          <Button
            variant="primary"
            type="button"
            onClick={onCreateAccountClick}
            onPointerEnter={onAuthCtaIntent}
            onFocus={onAuthCtaIntent}
            onPointerDown={onAuthCtaIntent}
            className="w-full sm:w-auto px-10 shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_30px_-15px_rgba(16,185,129,0.6)]"
          >
            Create Account
          </Button>
          <p className="text-center text-sm text-slate-500">
            Or read the full{' '}
            <Link to="/how-it-works" className={LINK_ON_LIGHT}>
              how to play
            </Link>{' '}
            guide.
          </p>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

import {
  MARKETING_EDITORIAL_ARTICLE,
  MARKETING_EDITORIAL_BODY,
  MARKETING_EDITORIAL_COLUMN,
  MARKETING_EDITORIAL_H1,
  MARKETING_EDITORIAL_TYPE_LEDE,
} from '../../../shared/ui/marketingEditorialChrome';
import { LINK_ON_LIGHT } from '../../../shared/ui/surfaceLinkStyles';
import AppDocumentAuthLink from './AppDocumentAuthLink';

/**
 * Crawlable About / origin story for `/about` (#941).
 * Copy source: `content/marketing/942-content-ia-drafts.md`.
 * Chrome tokens: #944 / `marketingEditorialChrome`.
 */
export default function AboutPageContent() {
  return (
    <article className={MARKETING_EDITORIAL_ARTICLE}>
      <div className={MARKETING_EDITORIAL_COLUMN}>
        <h1 className={MARKETING_EDITORIAL_H1}>
          About Setlist Pick&apos;Em
        </h1>

        <blockquote className={`${MARKETING_EDITORIAL_TYPE_LEDE} mb-10 border-l-4 border-teal-500/60 pl-5 italic leading-relaxed text-slate-600`}>
          “Lock your picks, ride the scores, run with your crew—one show at a time.”
        </blockquote>

        <div className={`space-y-6 ${MARKETING_EDITORIAL_BODY}`}>
          <p>
            On <strong className="font-semibold text-slate-900">Phish summer tour</strong> in{' '}
            <strong className="font-semibold text-slate-900">2001</strong>,{' '}
            <strong className="font-semibold text-slate-900">Ryan M</strong> (
            <strong className="font-semibold text-teal-700">Beaver</strong> to his friends) cooked
            up a game to pass the miles between shows.{' '}
            <strong className="font-semibold text-slate-900">Glu</strong> and{' '}
            <strong className="font-semibold text-slate-900">Andy F</strong> rolled with him on the
            road, and over those years the three of them shaped the ritual: debating picks,
            refining the format, and keeping the crew laughing until the lights went down.
          </p>
          <p>
            The format was simple and addictive: pick a{' '}
            <strong className="font-semibold text-slate-900">first-set opener and closer</strong>, a{' '}
            <strong className="font-semibold text-slate-900">second-set opener and closer</strong>,
            plus <strong className="font-semibold text-slate-900">encore</strong> and a{' '}
            <strong className="font-semibold text-slate-900">wildcard</strong>. Suddenly every
            placement mattered. Friendly competition, a little glory, and a reason to care where the
            next song might land.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">Pat</strong> and Ryan met in{' '}
            <strong className="font-semibold text-slate-900">kindergarten</strong> and grew up
            together; Pat was a fan of the game from the start. In the{' '}
            <strong className="font-semibold text-slate-900">2010s</strong>, Pat moved it from{' '}
            <strong className="font-semibold text-slate-900">paper to a spreadsheet</strong> so
            friends could play from different shows and cities. Portable, easy to update, and a
            little more dynamic on the road.
          </p>
          <p>
            Pat had always wished it could be{' '}
            <strong className="font-semibold text-slate-900">more automated</strong> and{' '}
            <strong className="font-semibold text-slate-900">more interesting</strong>.{' '}
            <strong className="font-semibold text-slate-900">Setlist Pick&apos;Em</strong> is that
            vision taken to its logical conclusion: an interactive home for passionate fans who
            crave competition,{' '}
            <Link to="/tour-stats" className={LINK_ON_LIGHT}>
              tour stats
            </Link>
            , and fun with friends. Live with Phish today, with more bands on the way.
          </p>
          <p>
            New here? Start with{' '}
            <Link to="/how-it-works" className={LINK_ON_LIGHT}>
              how it works
            </Link>
            . Want a brief explainer? See what makes this a{' '}
            <Link to="/phish-setlist-prediction-game" className={LINK_ON_LIGHT}>
              Phish setlist prediction game
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 flex justify-center border-t border-slate-200 pt-10">
          <AppDocumentAuthLink
            signup
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-10 py-3.5 text-base font-bold text-white shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] transition-all hover:bg-brand-primary-hover hover:shadow-[0_15px_30px_-15px_rgba(16,185,129,0.6)] active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
          >
            Get started
          </AppDocumentAuthLink>
        </div>
      </div>
    </article>
  );
}

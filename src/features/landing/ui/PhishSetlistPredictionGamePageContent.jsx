import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import {
  MARKETING_EDITORIAL_ARTICLE,
  MARKETING_EDITORIAL_BODY,
  MARKETING_EDITORIAL_COLUMN,
  MARKETING_EDITORIAL_EYEBROW,
  MARKETING_EDITORIAL_H1,
  MARKETING_EDITORIAL_H2,
  MARKETING_EDITORIAL_LEDE,
} from '../../../shared/ui/marketingEditorialChrome';
import { LINK_ON_LIGHT } from '../../../shared/ui/surfaceLinkStyles';
import AppDocumentAuthLink from './AppDocumentAuthLink';
import MarketingIphoneFigure from './MarketingIphoneFigure';

const STANDINGS_SAMPLE_SRC =
  '/images/marketing/standings-leaderboard-iphone-sample.png';

/**
 * Keyword-intent educational page for `/phish-setlist-prediction-game` (#660 / #940 / #973).
 * Copy source: `content/marketing/973-c6-c7-keyword-bridge.md` (C6/C7) on top of
 * `content/marketing/942-content-ia-drafts.md` (#940 definition).
 * Chrome tokens: #944 / `marketingEditorialChrome`.
 */
export default function PhishSetlistPredictionGamePageContent() {
  return (
    <article className={MARKETING_EDITORIAL_ARTICLE}>
      <div className={MARKETING_EDITORIAL_COLUMN}>
        <p className={MARKETING_EDITORIAL_EYEBROW}>
          Setlist Pick&apos;Em
        </p>
        <h1 className={MARKETING_EDITORIAL_H1}>
          The free Phish setlist prediction game
        </h1>
        <p className={MARKETING_EDITORIAL_LEDE}>
          Setlist Pick&apos;Em is a free, live game for fans who love calling the show. Lock six{' '}
          <strong className="font-semibold text-slate-800">Phish setlist picks</strong> before
          showtime: openers, closers, encore, and a wildcard. Then watch your score move as the
          night unfolds. Phish is up first; more bands are on the way.
        </p>

        <section className={`mb-12 space-y-4 ${MARKETING_EDITORIAL_BODY}`}>
          <h2 className={MARKETING_EDITORIAL_H2}>
            What is a setlist prediction game?
          </h2>
          <p>
            A{' '}
            <strong className="font-semibold text-slate-800">setlist prediction game</strong>{' '}
            (some fans call it a{' '}
            <strong className="font-semibold text-slate-800">fantasy setlist</strong> game) asks
            you to call which songs get played, and where they land, before the show starts. Then
            you compete in private pools and on the global leaderboard as scores update live.
          </p>
          <MarketingIphoneFigure
            className="pt-2"
            src={STANDINGS_SAMPLE_SRC}
            alt="iPhone showing Setlist Pick 'Em show standings with Crowd Pulse and a ranked leaderboard. Player names and player counts are blurred."
            caption="Show and tour leaderboards: live setlist and standings during the show, full history after."
          />
          <p>Use the app to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Call your slots: openers, closers, encore, and a wildcard</li>
            <li>Score live as each song is played</li>
            <li>
              Climb show and tour boards against your friends, and everyone else on the global
              leaderboard
            </li>
          </ul>
          <p>
            Fans have called the set on paper and in group chats for years. Setlist Pick&apos;Em
            turns that ritual into a live game with a scoreboard.
          </p>
        </section>

        <section className={`mb-12 space-y-4 ${MARKETING_EDITORIAL_BODY}`}>
          <h2 className={MARKETING_EDITORIAL_H2}>
            What are Phish setlist picks?
          </h2>
          <p>
            Your Phish setlist picks are the six calls you lock before the lights go down: the Set 1
            opener and closer, the Set 2 opener and closer, the encore, and one wildcard.
            That&apos;s the whole game. You&apos;re not writing out a full predicted setlist or
            following a tip sheet. When a song lands in one of your slots, you score, and your pool
            and the global leaderboard update in real time.
          </p>
        </section>

        <section className="mb-12 space-y-4 text-base leading-relaxed text-slate-700">
          <h2 className={MARKETING_EDITORIAL_H2}>
            Fantasy setlists, without the spreadsheet
          </h2>
          <p>
            Points for slot hits, wildcards, and Bustout Boost™ longshots are tallied
            automatically. No spreadsheet, no arguing over who&apos;s keeping score. The full point
            values are on{' '}
            <Link to="/how-scoring-works" className={LINK_ON_LIGHT}>
              how scoring works
            </Link>
            .
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-slate-900">Before:</strong> lock your picks before showtime
            </li>
            <li>
              <strong className="text-slate-900">During:</strong> live scoring and standings, at
              the venue or on couch tour
            </li>
            <li>
              <strong className="text-slate-900">After:</strong> final grades, tour standings, and
              personal stats that grow every night you play
            </li>
          </ul>
          <p>
            <Link to="/tour-stats" className={LINK_ON_LIGHT}>
              Tour stats
            </Link>{' '}
            (song frequency, bustouts, gaps) update every night the band plays. Once you play, you
            get your own numbers too: picking average, Bustout Boost™ hits, and a heatmap of your
            most frequent picks.
          </p>
        </section>

        <section className={`mb-12 space-y-4 ${MARKETING_EDITORIAL_BODY}`}>
          <h2 className={MARKETING_EDITORIAL_H2}>How to play</h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>Create a free account and open the card for the next show.</li>
            <li>
              Pick your Set 1 opener and closer, Set 2 opener and closer, encore, and wildcard.
            </li>
            <li>
              Watch scores update live, climb the boards, or start a private pool with friends.
            </li>
          </ol>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              to="/how-it-works"
              className={`inline-flex items-center gap-1 ${LINK_ON_LIGHT}`}
            >
              How it works
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/how-scoring-works"
              className={`inline-flex items-center gap-1 ${LINK_ON_LIGHT}`}
            >
              How scoring works
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link to="/tour-stats" className={`inline-flex items-center gap-1 ${LINK_ON_LIGHT}`}>
              Tour stats
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </p>
        </section>

        <div className="flex justify-center border-t border-slate-200 pt-10">
          <AppDocumentAuthLink
            signup
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-10 py-3.5 text-base font-bold text-white shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] transition-all hover:bg-brand-primary-hover hover:shadow-[0_15px_30px_-15px_rgba(16,185,129,0.6)] active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
          >
            Start predicting setlists
          </AppDocumentAuthLink>
        </div>
      </div>
    </article>
  );
}

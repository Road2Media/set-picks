import React from 'react';
import { Link } from 'react-router-dom';

import {
  PUBLIC_SHOW_NOTES_HUB,
  publicShowNotePath,
} from '../../../shared/config/publicShowNotes';
import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

/**
 * Hub and night body for `/tour-notes` (#684). Presentational.
 * Night copy comes from the sanitized public note. The hub essay is the
 * prerender copy, so the first HTML and the mounted page say the same thing.
 *
 * @param {{
 *   mode?: 'hub' | 'night' | 'invalid',
 *   status?: 'loading' | 'ready' | 'error',
 *   notes?: { showDate: string, headline: string, tourSlug: string | null }[],
 *   note?: {
 *     headline: string,
 *     paragraphs: string[],
 *     tourSlug: string | null,
 *   } | null,
 *   signupHref?: string,
 * }} props
 */
export default function ShowNotesView({
  mode = 'hub',
  status = 'ready',
  notes = [],
  note = null,
  signupHref = '/login?mode=signup',
}) {
  const tourHref = note?.tourSlug ? `/tour-stats/${note.tourSlug}` : '/tour-stats';
  const tourLabel = note?.tourSlug ? "This tour's stats" : 'Tour stats';

  return (
    <div className={`mx-auto w-full min-w-0 max-w-3xl py-10 ${MARKETING_PAGE_GUTTER_X}`}>
      <header className="mb-6 min-w-0 space-y-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {mode === 'night' && note ? note.headline : PUBLIC_SHOW_NOTES_HUB.h1}
        </h1>
        {mode === 'hub'
          ? PUBLIC_SHOW_NOTES_HUB.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-relaxed text-slate-300">
                {paragraph}
              </p>
            ))
          : null}
      </header>

      {mode === 'invalid' ? (
        <p className="text-base leading-relaxed text-slate-300">That date is not a show note.</p>
      ) : null}

      {mode === 'night' && status === 'loading' ? (
        <p className="text-base leading-relaxed text-slate-300">Loading show notes.</p>
      ) : null}

      {mode === 'night' && status === 'error' ? (
        <p className="text-base leading-relaxed text-slate-300">Show notes are not up yet.</p>
      ) : null}

      {mode === 'night' && status === 'ready' && note
        ? note.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-4 text-base leading-relaxed text-slate-200">
              {paragraph}
            </p>
          ))
        : null}

      {mode === 'night' && status === 'ready' && !note ? (
        <p className="text-base leading-relaxed text-slate-300">
          No public note for this date. A note is published for a bustout or a song new to the tour.
        </p>
      ) : null}

      {mode === 'hub' && status === 'loading' ? (
        <p className="text-sm text-slate-400">Loading show notes.</p>
      ) : null}

      {mode === 'hub' && status === 'error' ? (
        <p className="text-base leading-relaxed text-slate-300">Show notes are not up yet.</p>
      ) : null}

      {mode === 'hub' && status === 'ready' && notes.length > 0 ? (
        <ul className="mb-8 space-y-2">
          {notes.map((row) => (
            <li key={row.showDate}>
              <Link to={publicShowNotePath(row.showDate)} className={LINK_ON_DARK}>
                {row.headline}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode === 'night' ? (
          <Link to={publicShowNotePath()} className={LINK_ON_DARK}>
            All show notes
          </Link>
        ) : null}
        <Link to={tourHref} className={LINK_ON_DARK}>
          {tourLabel}
        </Link>
        <Link to="/how-it-works" className={LINK_ON_DARK}>
          How it works
        </Link>
        <Link to="/phish-setlist-prediction-game" className={LINK_ON_DARK}>
          The game
        </Link>
        <a href={signupHref} className={LINK_ON_DARK}>
          Make picks
        </a>
      </p>
    </div>
  );
}

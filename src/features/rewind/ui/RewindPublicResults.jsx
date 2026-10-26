import React from 'react';

import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import { REWIND_ATTRIBUTION } from '../model/rewindContract';

function formatAverage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(1);
}

/**
 * Public week results. Hit counts only — no song titles, no full setlist.
 */
export default function RewindPublicResults({ state }) {
  if (state.status === 'disabled') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-white">Rewind</h1>
        <p className="mt-3 text-base text-slate-300">
          One past show a week. This page is off until Rewind is turned on.
        </p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-slate-300">Loading this Rewind week…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-white">Rewind</h1>
        <p className="mt-3 text-base text-slate-300" role="alert">
          {state.message || 'Could not load this week.'}
        </p>
      </div>
    );
  }

  if (state.status === 'empty' || !state.week) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-white">Rewind</h1>
        <p className="mt-3 text-base text-slate-300">
          No featured show this week. Live standings are unchanged.
        </p>
      </div>
    );
  }

  const week = state.week;
  const players = Number(week.playerCount) || 0;
  const counts = week.correctSlotCounts || {};
  const href = week.phishNetUrl || 'https://phish.net';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-teal-400">Rewind</p>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {week.title || 'This week’s show'}
        </h1>
        <p className="text-base text-slate-300">
          {[week.venue, week.showDate].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm leading-relaxed text-slate-400">
          How the week scored. Aggregates only — not the setlist. {players}{' '}
          {players === 1 ? 'player' : 'players'} locked in. Average score{' '}
          {formatAverage(week.averageScore)}.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">
          Slot hits
        </h2>
        <ul className="space-y-2">
          {FORM_FIELDS.map((field) => {
            const hits = Number(counts[field.id]) || 0;
            return (
              <li
                key={field.id}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"
              >
                <span className="text-sm text-white">{field.label}</span>
                <span className="text-sm text-slate-300">
                  {hits} of {players}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-slate-300">
        {week.attribution || REWIND_ATTRIBUTION}{' '}
        <a href={href} className={LINK_ON_DARK} target="_blank" rel="noreferrer">
          That show on Phish.net
        </a>
      </p>
      <p className="mt-4 text-sm text-slate-300">
        <a href="/dashboard/rewind" className={LINK_ON_DARK}>
          Play this week
        </a>
      </p>
    </div>
  );
}

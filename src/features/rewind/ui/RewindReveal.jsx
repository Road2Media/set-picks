import React from 'react';

import { REWIND_ATTRIBUTION } from '../model/rewindContract';

/**
 * Six-slot result after lock. Not the full setlist.
 */
export default function RewindReveal({ reveal }) {
  if (!reveal) return null;
  const href = reveal.phishNetUrl || 'https://phish.net';

  return (
    <section className="space-y-3" aria-live="polite">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Your Rewind
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-content-primary">
          {Number(reveal.score) || 0} pts
        </p>
        <p className="text-sm text-content-secondary">
          {Number(reveal.correctSlots) || 0} of 6 slots scored
        </p>
      </div>
      <ul className="space-y-2">
        {(reveal.slots || []).map((slot) => (
          <li
            key={slot.id}
            className="rounded-xl border border-border-muted/40 bg-surface-inset px-3 py-2"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-content-secondary">
              {slot.label}
              {slot.bustoutBoost ? ' · Bustout' : ''}
            </p>
            <p className="text-sm text-content-primary">
              You picked {slot.guess || '—'}
              {slot.actual ? ` · Played ${slot.actual}` : ''}
              {' · '}
              {Number(slot.points) || 0} pts
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-content-secondary">
        {reveal.attribution || REWIND_ATTRIBUTION}{' '}
        <a
          href={href}
          className="font-semibold text-brand-primary underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          Full setlist on Phish.net
        </a>
      </p>
    </section>
  );
}

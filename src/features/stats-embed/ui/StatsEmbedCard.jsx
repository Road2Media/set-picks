import React from 'react';

/**
 * Framed card. Presentational. The credit is a real anchor.
 *
 * @param {{
 *   model: {
 *     kind: 'badge' | 'standings',
 *     tourLabel: string | null,
 *     detail: string,
 *     creditUrl: string,
 *     creditLabel: string,
 *   },
 * }} props
 */
export default function StatsEmbedCard({ model }) {
  const heading =
    model.kind === 'standings' && model.tourLabel
      ? model.tourLabel
      : model.creditLabel;

  return (
    <article className="flex min-h-screen flex-col justify-between bg-brand-bg px-4 py-4 text-white">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
          {model.kind === 'standings' ? 'Tour standings' : 'Setlist prediction game'}
        </p>
        <h1 className="mt-2 font-display text-lg font-bold leading-tight text-white">
          {heading}
        </h1>
        <p className="mt-2 text-sm leading-snug text-slate-300">{model.detail}</p>
      </div>
      <p className="mt-4 text-sm text-slate-400">
        <a
          href={model.creditUrl}
          target="_blank"
          rel="noopener"
          className="font-semibold text-teal-300 underline underline-offset-2"
        >
          {model.creditLabel}
        </a>
      </p>
    </article>
  );
}

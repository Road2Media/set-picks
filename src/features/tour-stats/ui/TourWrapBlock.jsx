import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';

/**
 * Compact finished-tour summary (#1140). Sentences come from
 * `buildFinishedTourWrap` so this block matches prerender HTML and the share image.
 *
 * @param {{ wrap: null | Record<string, unknown> }} props
 */
export default function TourWrapBlock({ wrap }) {
  const [shareState, setShareState] = useState('idle');
  if (!wrap) return null;

  async function onShare() {
    const payload = {
      title: wrap.headline,
      text: wrap.shareText,
      url: wrap.shareUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(payload);
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${wrap.shareText} ${wrap.shareUrl}`);
      setShareState('copied');
    } catch {
      setShareState('error');
    }
  }

  return (
    <section
      className="mb-6 rounded-2xl border border-teal-400/40 bg-white/5 px-4 py-4 text-left sm:px-5"
      data-tour-wrap="summary"
      aria-label="Tour wrap"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
        Tour wrap
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-white">
        {wrap.headline}
      </h2>
      <p className="mt-2 text-sm leading-snug text-slate-200">{wrap.countsLine}</p>
      {wrap.mostPlayedLine ? (
        <p className="mt-1 text-sm leading-snug text-slate-300">{wrap.mostPlayedLine}</p>
      ) : null}
      <p className="mt-1 text-sm leading-snug text-slate-300">{wrap.bustoutsLine}</p>
      <p className="mt-1 text-sm leading-snug text-slate-300">
        {wrap.boostLine}{' '}
        <Link to="/how-scoring-works" className={LINK_ON_DARK}>
          How scoring works
        </Link>
      </p>
      {wrap.winnerLine ? (
        <p className="mt-2 text-sm font-semibold leading-snug text-white">
          {wrap.winnerLine}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex w-fit items-center justify-center rounded-xl border border-teal-400/70 px-4 py-2 text-sm font-bold text-teal-200 transition-colors hover:bg-teal-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          {shareState === 'copied'
            ? 'Link copied'
            : shareState === 'error'
              ? 'Could not copy the link'
              : 'Share this wrap'}
        </button>
        <p className="text-xs leading-snug text-slate-400">
          Song and setlist data provided by{' '}
          <a
            href="https://phish.net"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_ON_DARK}
          >
            Phish.net
          </a>
          .
        </p>
      </div>
    </section>
  );
}

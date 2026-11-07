import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { LINK_ON_DARK } from '../../../shared/ui/surfaceLinkStyles';
import { TOUR_WRAP_COLORS } from '../model/tourWrapTokens';

/**
 * Finished-tour card in the share-image shape (#1193).
 *
 * Closed by default: kicker, headline, four counts, most played, longest gap,
 * and share. Scoring, the winner, and the Phish.net credit sit under More.
 * Sentences come from `buildFinishedTourWrap`.
 *
 * @param {{ wrap: null | Record<string, unknown> }} props
 */
export default function TourWrapBlock({ wrap }) {
  const [shareState, setShareState] = useState('idle');
  if (!wrap) return null;

  const tiles = Array.isArray(wrap.statTiles) ? wrap.statTiles : [];

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
      className="mb-3 rounded-2xl border px-3 py-3 text-left sm:px-4"
      style={{
        backgroundColor: TOUR_WRAP_COLORS.panel,
        borderColor: TOUR_WRAP_COLORS.accentBorder,
      }}
      data-tour-wrap="summary"
      aria-label="Tour wrap"
    >
      <p
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: TOUR_WRAP_COLORS.accent }}
      >
        Tour wrap
      </p>
      <h2 className="mt-0.5 font-display text-lg font-bold leading-tight text-white sm:text-2xl">
        {wrap.headline}
      </h2>
      {tiles.length > 0 ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label}>
              <dd
                className="font-display text-2xl font-bold leading-none tabular-nums sm:text-4xl"
                style={{ color: TOUR_WRAP_COLORS.accent }}
              >
                {tile.value}
              </dd>
              <dt
                className="mt-1 text-xs leading-none"
                style={{ color: TOUR_WRAP_COLORS.statLabel }}
              >
                {tile.label}
              </dt>
            </div>
          ))}
        </dl>
      ) : null}
      {wrap.mostPlayedLine ? (
        <p
          className="mt-2 text-sm leading-snug"
          style={{ color: TOUR_WRAP_COLORS.detail }}
          data-tour-wrap="most-played"
        >
          {wrap.mostPlayedLine}
        </p>
      ) : null}
      <p
        className="mt-1 text-sm leading-snug"
        style={{ color: TOUR_WRAP_COLORS.detail }}
        data-tour-wrap="bustouts"
      >
        {wrap.bustoutsLine}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex w-fit items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors hover:bg-teal-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          style={{
            borderColor: TOUR_WRAP_COLORS.accent,
            color: TOUR_WRAP_COLORS.accent,
          }}
        >
          {shareState === 'copied'
            ? 'Link copied'
            : shareState === 'error'
              ? 'Could not copy the link'
              : 'Share this wrap'}
        </button>
      </div>
      <details className="mt-1">
        <summary
          className="cursor-pointer text-sm font-semibold"
          style={{ color: TOUR_WRAP_COLORS.accent }}
        >
          More
        </summary>
        {wrap.winnerLine ? (
          <p className="mt-2 text-sm font-semibold leading-snug text-white">
            {wrap.winnerLine}
          </p>
        ) : null}
        <p className="mt-1 text-sm leading-snug text-slate-300">
          {wrap.boostLine}{' '}
          <Link to="/how-scoring-works" className={LINK_ON_DARK}>
            How scoring works
          </Link>
        </p>
        <p className="mt-1 text-xs leading-snug text-slate-400">
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
      </details>
    </section>
  );
}

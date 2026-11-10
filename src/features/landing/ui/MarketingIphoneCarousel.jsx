import React, { useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { MARKETING_EDITORIAL_META } from '../../../shared/ui/marketingEditorialChrome';

/**
 * Light-editorial carousel for iPhone marketing figures (#944).
 *
 * @param {{
 *   slides: Array<{ src: string, alt: string, caption?: string }>,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function MarketingIphoneCarousel({
  slides,
  className = '',
  label = 'Product screenshots',
}) {
  const reactId = useId();
  const labelId = `marketing-iphone-carousel-${reactId}`;
  const [index, setIndex] = useState(0);
  const count = slides.length;
  if (!count) return null;

  const safeIndex = ((index % count) + count) % count;
  const slide = slides[safeIndex];

  const go = (delta) => {
    setIndex((current) => (current + delta + count) % count);
  };

  return (
    <figure
      className={`mx-auto w-full max-w-sm ${className}`.trim()}
      aria-labelledby={labelId}
    >
      <p id={labelId} className="sr-only">
        {label}
      </p>
      <div
        className="relative"
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
      >
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={900}
          height={1350}
          decoding="async"
          loading={safeIndex === 0 ? 'eager' : 'lazy'}
          className="mx-auto h-auto w-full select-none"
        />

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-xs transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-xs transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
              aria-label="Next screenshot"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {slide.caption ? (
        <figcaption className={`mt-4 text-center ${MARKETING_EDITORIAL_META}`}>
          {slide.caption}
          {count > 1 ? (
            <span className="mt-1 block text-xs text-slate-400">
              {safeIndex + 1} of {count}
            </span>
          ) : null}
        </figcaption>
      ) : null}

      {count > 1 ? (
        <div
          className="mt-3 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Screenshot slides"
        >
          {slides.map((entry, i) => {
            const selected = i === safeIndex;
            return (
              <button
                key={entry.src}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`Show screenshot ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue ${
                  selected
                    ? 'w-6 bg-teal-600'
                    : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            );
          })}
        </div>
      ) : null}
    </figure>
  );
}

import React, { useCallback, useState } from 'react';

import { IOS_INSTALL_SCREENSHOT_STEPS } from './iosInstallScreenshots.js';

/**
 * @param {{ compact?: boolean }} props
 */
export default function IosInstallScreenshotGallery({ compact = false }) {
  const [hiddenSrcs, setHiddenSrcs] = useState(() => new Set());

  const handleError = useCallback((src) => {
    setHiddenSrcs((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  const visible = IOS_INSTALL_SCREENSHOT_STEPS.filter((s) => !hiddenSrcs.has(s.src));
  if (visible.length === 0) return null;

  const imgClass = compact
    ? 'w-full rounded-lg object-cover'
    : 'w-full rounded-xl object-cover max-h-[min(70vh,520px)] object-top';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {visible.map((step) => (
        <figure
          key={step.src}
          className={
            compact
              ? 'overflow-hidden rounded-xl border border-border-muted/60 bg-surface-inset/70 p-1.5'
              : 'overflow-hidden rounded-2xl border border-border-muted/60 bg-surface-inset/70 p-2'
          }
        >
          <img
            src={step.src}
            alt={step.alt}
            loading="lazy"
            className={imgClass}
            onError={() => handleError(step.src)}
          />
          {!compact ? (
            <figcaption className="px-1 pb-1 pt-2 text-xs font-bold text-content-secondary">
              {step.caption}
            </figcaption>
          ) : (
            <figcaption className="px-1 pb-0.5 pt-1.5 text-[10px] font-bold leading-tight text-content-secondary">
              {step.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

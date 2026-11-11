import React, { useLayoutEffect, useRef } from 'react';

import splashGradientWordmarkSvg from '../../../shared/assets/branding/splash-gradient-4x1.svg?raw';
import {
  brandHeroWordmarkAspectFrameClassNames,
  brandHeroWordmarkScaleWrapperClassNames,
  brandHeroWordmarkSvgClassNames,
} from '../../../shared/config/branding';

/**
 * Inline SVG stays vector on mobile WebKit; `<img src=".svg">` is often rasterized (soft/grainy),
 * especially with CSS filters. Avoid box-shadow on the aspect frame — it traces the rectangular
 * box and reads as a “border” around transparent letter areas (unlike drop-shadow-sm on an img).
 *
 * Crop (replaces former img `object-cover` / `object-position`):
 * - Mobile: `xMidYMin slice` ≈ `object-top`
 * - sm+: `xMidYMid slice` ≈ former `object-[center_62%]` (skip SVG headroom)
 */
const HERO_WORDMARK_SVG_HTML = splashGradientWordmarkSvg
  .replace(/\spreserveAspectRatio="[^"]*"/, '')
  .replace(
    '<svg ',
    `<svg class="${brandHeroWordmarkSvgClassNames}" preserveAspectRatio="xMidYMin slice" focusable="false" aria-hidden="true" `,
  );

export default function SplashHeroWordmark() {
  const frameRef = useRef(null);

  useLayoutEffect(() => {
    const svg = frameRef.current?.querySelector('svg');
    if (!svg) return undefined;

    const mq = window.matchMedia('(min-width: 640px)');
    const syncCrop = () => {
      svg.setAttribute(
        'preserveAspectRatio',
        mq.matches ? 'xMidYMid slice' : 'xMidYMin slice',
      );
    };

    syncCrop();
    mq.addEventListener('change', syncCrop);
    return () => mq.removeEventListener('change', syncCrop);
  }, []);

  return (
    <span className={brandHeroWordmarkScaleWrapperClassNames}>
      <span
        ref={frameRef}
        className={brandHeroWordmarkAspectFrameClassNames}
        // Trusted brand asset (bundled ?raw), not user content.
        dangerouslySetInnerHTML={{ __html: HERO_WORDMARK_SVG_HTML }}
      />
    </span>
  );
}

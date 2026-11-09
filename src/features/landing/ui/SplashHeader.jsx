import React from 'react';

import {
  BRAND_SPLASH_HEADER_VINYL_MARK_SRC,
  brandSplashHeaderVinylMarkImgClassNames,
  brandWordmarkSplashHeaderLeadingClassNames,
} from '../../../shared/config/branding';
import BrandWordmarkBarRow from '../../../shared/ui/BrandWordmarkBarRow';
import { MARKETING_HEADER_HEIGHT } from '../../../shared/ui/marketingEditorialChrome';
import MarketingHeaderAuthCluster from './MarketingHeaderAuthCluster';
import { MarketingHeaderNav } from './MarketingSiteNav';

export default function SplashHeader({
  onPlayNowClick,
  onSignInClick,
  onAuthCtaIntent,
}) {
  // Height is `--header-height` (`marketingEditorialViewport.css` / `splashScrollPadding.js`).
  // Mobile (#706): [Sign In] [Join →] [☰]. Desktop: nav sits near center (slight right bias); CTAs stay right.
  return (
    <header className={`fixed left-0 right-0 top-0 z-50 flex items-center overflow-visible border-b border-white/5 bg-brand-bg/80 backdrop-blur-lg transition-all duration-300 ${MARKETING_HEADER_HEIGHT}`}>
      <div className="relative mx-auto h-full w-full max-w-7xl min-w-0">
        <BrandWordmarkBarRow variant="splash">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={brandWordmarkSplashHeaderLeadingClassNames}
            aria-label={"Setlist Pick 'Em — scroll to top"}
          >
            <img
              src={BRAND_SPLASH_HEADER_VINYL_MARK_SRC}
              alt={"Setlist Pick 'Em"}
              width={512}
              height={508}
              decoding="async"
              className={brandSplashHeaderVinylMarkImgClassNames}
            />
          </button>

          <div className="flex min-w-0 items-center justify-self-end sm:justify-self-auto">
            <MarketingHeaderAuthCluster
              onSignIn={onSignInClick}
              onJoin={onPlayNowClick}
              onAuthCtaIntent={onAuthCtaIntent}
            />
          </div>
        </BrandWordmarkBarRow>

        {/* Desktop: primary nav floated near center, nudged right so it doesn’t collide with the vinyl. */}
        <MarketingHeaderNav className="pointer-events-auto absolute left-[48%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex xl:left-[52%]" />
      </div>
    </header>
  );
}

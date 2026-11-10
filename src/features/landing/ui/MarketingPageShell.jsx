import React from 'react';

import {
  BRAND_SPLASH_HEADER_VINYL_MARK_SRC,
  brandSplashHeaderVinylMarkImgClassNames,
} from '../../../shared/config/branding';
import { PHISH_NET_FOOTER_ATTRIBUTION } from '../../../shared/config/phishLiveSource';
import {
  MARKETING_HEADER_HEIGHT,
  MARKETING_PAGE_GUTTER_X,
} from '../../../shared/ui/marketingEditorialChrome';
import useMarketingAuthLeave from '../model/useMarketingAuthLeave';
import MarketingAuthLeaveOverlay from './MarketingAuthLeaveOverlay';
import MarketingHeaderAuthCluster from './MarketingHeaderAuthCluster';
import { MarketingFooterNav, MarketingHeaderNav } from './MarketingSiteNav';

/**
 * Shell for standalone marketing / educational pages.
 * Sticky header: vinyl home mark, primary nav, Sign In + Join (#663 / #706).
 * Footer is legal chrome (#948).
 *
 * The vinyl uses a real `<a href="/">` (not React Router `<Link>`) so returning
 * from app-document surfaces (`/login`, invite VIP) always reloads the marketing
 * entry (`index.html`) instead of soft-navigating to app-shell splash.
 * Sign In / Join hard-navigate to `/login`, same as the splash header.
 * Public `/tour-stats*` is marketing (#853) — soft Links are fine there.
 */
export default function MarketingPageShell({ children }) {
  const { leaving, leaveMessage, openSignUp, openSignIn, onAuthCtaIntent } =
    useMarketingAuthLeave();

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent text-white">
      <header className={`sticky top-0 z-50 flex items-center border-b border-white/5 bg-brand-bg/80 backdrop-blur-lg ${MARKETING_HEADER_HEIGHT}`}>
        <div className={`relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 sm:gap-4 ${MARKETING_PAGE_GUTTER_X}`}>
          <a
            href="/"
            aria-label="Setlist Pick 'Em — back to home"
            className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
          >
            <img
              src={BRAND_SPLASH_HEADER_VINYL_MARK_SRC}
              alt="Setlist Pick 'Em"
              width={36}
              height={36}
              decoding="async"
              className={brandSplashHeaderVinylMarkImgClassNames}
            />
            <span className="hidden font-display text-base font-bold tracking-tight text-white lg:block">
              Setlist Pick&nbsp;&apos;Em
            </span>
          </a>

          {/* Desktop: nav near center (slight right bias); Sign In + Join stay right. */}
          <MarketingHeaderNav className="pointer-events-auto absolute left-[48%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex xl:left-[52%]" />

          <MarketingHeaderAuthCluster
            onSignIn={openSignIn}
            onJoin={openSignUp}
            onAuthCtaIntent={onAuthCtaIntent}
          />
        </div>
      </header>
      {leaving ? <MarketingAuthLeaveOverlay message={leaveMessage} /> : null}
      <main className="w-full flex-1">{children}</main>

      <div className={`relative z-10 pb-4 pt-10 ${MARKETING_PAGE_GUTTER_X}`}>
        <MarketingFooterNav variant="primary" />
      </div>

      <footer className={`relative z-10 border-t border-slate-800/60 bg-transparent py-6 text-center text-xs font-medium leading-relaxed text-slate-500 ${MARKETING_PAGE_GUTTER_X}`}>
        <p>&copy; {new Date().getFullYear()} Road2 Media, LLC. All rights reserved.</p>
        <p className="mt-1">
          Song and setlist data provided by{' '}
          <a
            href={PHISH_NET_FOOTER_ATTRIBUTION.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200 hover:decoration-slate-400"
          >
            {PHISH_NET_FOOTER_ATTRIBUTION.text}
          </a>
          .
        </p>
        <MarketingFooterNav variant="legal" className="mt-3" />
      </footer>
    </div>
  );
}

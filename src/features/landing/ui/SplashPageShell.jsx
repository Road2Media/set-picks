import React from 'react';

import { PHISH_NET_FOOTER_ATTRIBUTION } from '../../../shared/config/phishLiveSource';
import useSplashDocumentScrollPadding from '../model/useSplashDocumentScrollPadding';
import { MarketingFooterNav } from './MarketingSiteNav';
import SplashAboutSection from './SplashAboutSection';
import SplashHeader from './SplashHeader';
import SplashHeroSection from './SplashHeroSection';
import SplashHowItWorksSection from './SplashHowItWorksSection';

/**
 * Marketing / app splash composition. Auth CTAs go to `/login` (signup or sign-in);
 * the old mid-page Get Started chooser card is removed (#835).
 */
export default function SplashPageShell({
  howItWorksSectionRef,
  howItWorksHeadingRef,
  aboutSectionRef,
  aboutHeadingRef,
  onOpenSignUp,
  onOpenSignIn,
  onAuthCtaIntent,
  children,
}) {
  useSplashDocumentScrollPadding();

  return (
    <>
      {/* Fixed + flex parent breaks iOS Safari; header must sit outside the flex wrapper. */}
      <SplashHeader
        onPlayNowClick={onOpenSignUp}
        onSignInClick={onOpenSignIn}
        onAuthCtaIntent={onAuthCtaIntent}
      />

      <div className="relative flex min-h-screen w-full flex-col bg-transparent text-white">
        <main className="relative w-full flex-1 overflow-x-hidden">
          <SplashHeroSection
            onPlayNowClick={onOpenSignUp}
            onAuthCtaIntent={onAuthCtaIntent}
          />
          <SplashHowItWorksSection
            sectionRef={howItWorksSectionRef}
            headingRef={howItWorksHeadingRef}
            onCreateAccountClick={onOpenSignUp}
            onAuthCtaIntent={onAuthCtaIntent}
          />
          <SplashAboutSection
            sectionRef={aboutSectionRef}
            headingRef={aboutHeadingRef}
            onGetStartedClick={onOpenSignUp}
            onAuthCtaIntent={onAuthCtaIntent}
          />
        </main>

        {/* Primary site links above the legal footer rule (#948). */}
        <div className="relative z-10 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
          <MarketingFooterNav variant="primary" />
        </div>

        <footer className="relative z-10 border-t border-slate-800/60 bg-transparent px-4 py-6 text-center text-xs font-medium leading-relaxed text-slate-500 sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} Road2 Media, LLC. All rights reserved.
          </p>
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

        {children}
      </div>
    </>
  );
}

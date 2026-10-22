import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import {
  MarketingAuthLeaveOverlay,
  MarketingScrollToTop,
  resolveMarketingAuthLeaveMessage,
  useSpeculativeLoginWarm,
} from '../features/landing/splash';
import MarketingHomePage from '../pages/marketing/MarketingHomePage';

// Sibling marketing routes stay off the `/` cold-open graph (#835).
// Home statically imports splash UI only; these load on navigation / deep link.
const AboutPage = lazy(() => import('../pages/marketing/AboutPage'));
const HowItWorksPage = lazy(() => import('../pages/marketing/HowItWorksPage'));
const HowScoringWorksPage = lazy(
  () => import('../pages/marketing/HowScoringWorksPage'),
);
const PhishSetlistPredictionGamePage = lazy(
  () => import('../pages/marketing/PhishSetlistPredictionGamePage'),
);
const PublicTourStatsPage = lazy(
  () => import('../pages/marketing/PublicTourStatsPage'),
);
const MsgGardenStatsPage = lazy(
  () => import('../pages/marketing/MsgGardenStatsPage'),
);

/**
 * Paths that leave the marketing document (#832 / #892 / #916).
 * `/login` → HTML-first auth door (`login.html`);
 * `/privacy` + `/terms` → zero-JS legal door shells;
 * other app routes → `app.html`.
 */
function isLeaveMarketingDocumentPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  if (pathname === '/privacy' || pathname === '/terms') return true;
  const prefixes = [
    '/login',
    '/dashboard',
    '/setup',
    '/password-reset-complete',
    '/join',
    '/comms-preview',
    '/card-shell-preview',
  ];
  if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return pathname.startsWith('/user/') || pathname.startsWith('/invite/');
}

/**
 * Full navigation out of the marketing document.
 * Used when a marketing-shell Link targets login / legal / Firebase-backed routes.
 */
function LoadLeaveMarketingDocument() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (!isLeaveMarketingDocumentPath(pathname)) return;
    window.location.replace(`${pathname}${search}${hash}`);
  }, []);

  if (
    typeof window !== 'undefined' &&
    !isLeaveMarketingDocumentPath(window.location.pathname)
  ) {
    return <Navigate to="/" replace />;
  }

  // Residual soft-nav safety net (#872) — primary CTAs hard-link past this hop.
  const search =
    typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search);
  const signup =
    params.get('mode') === 'signup' || params.get('signup') === '1';
  return (
    <MarketingAuthLeaveOverlay
      message={resolveMarketingAuthLeaveMessage({ signup })}
    />
  );
}

function MarketingRouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center bg-brand-bg text-sm font-medium text-slate-400"
      aria-busy="true"
    >
      Loading…
    </div>
  );
}

/**
 * Marketing cold-open router (#832). Real product UI, no AuthProvider.
 * Only `/` is eager — other marketing pages are lazy so home cold open
 * does not download/score their chunks (#835 paint fix).
 */
export default function MarketingApp() {
  // After first paint: download-only warm of /login + firebase-core (#880).
  useSpeculativeLoginWarm();

  return (
    <>
      <MarketingScrollToTop />
      <Routes>
        <Route path="/" element={<MarketingHomePage />} />
        <Route
          path="/how-it-works"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <HowItWorksPage />
            </Suspense>
          }
        />
        <Route
          path="/how-scoring-works"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <HowScoringWorksPage />
            </Suspense>
          }
        />
        <Route
          path="/phish-setlist-prediction-game"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <PhishSetlistPredictionGamePage />
            </Suspense>
          }
        />
        <Route
          path="/about"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <AboutPage />
            </Suspense>
          }
        />
        {/* Public tour-stats: marketing document + deferred Firestore (#853). */}
        <Route
          path="/tour-stats"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <PublicTourStatsPage />
            </Suspense>
          }
        />
        <Route
          path="/tour-stats/msg"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <MsgGardenStatsPage />
            </Suspense>
          }
        />
        <Route
          path="/tour-stats/:tourSlug"
          element={
            <Suspense fallback={<MarketingRouteFallback />}>
              <PublicTourStatsPage />
            </Suspense>
          }
        />
        {/* Legal + app-document surfaces — hard leave to legal door / app / login (#916). */}
        <Route path="*" element={<LoadLeaveMarketingDocument />} />
      </Routes>
    </>
  );
}

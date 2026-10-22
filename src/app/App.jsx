import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

import { registerRouteChunkLoaders } from '../shared/lib/routeChunkPrefetch';

import RootAppShell from './layout/RootAppShell';

// Every top-level route is lazy-loaded so direct hits on e.g.
// `/dashboard/profile` don't pay the full dashboard+admin+pools download on
// first paint. The shared Suspense boundary lives in `RootAppShell` (one
// place → consistent fallback).
//
// `HomeRoute` joined them in #731: `/join`, `/invite/:handle` and every
// dashboard hard open were downloading the Landing graph they never render.
// The splash keeps its first-paint budget because `prerender-seo.mjs`
// modulepreloads the HomeRoute chunk into `dist/index.html`.
const loadHomeRoute = () => import('./routes/HomeRoute');
const loadSetupRoute = () => import('./routes/SetupRoute');
const loadDashboardRoute = () => import('./routes/DashboardRoute');

// Feature surfaces (auth modals, invite CTAs) prefetch these by key so they
// never have to import app-layer route modules (#805).
registerRouteChunkLoaders({
  home: loadHomeRoute,
  setup: loadSetupRoute,
  dashboard: loadDashboardRoute,
});

const HomeRoute = lazy(loadHomeRoute);
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const PasswordResetCompletePage = lazy(() =>
  import('../pages/auth/PasswordResetCompletePage')
);
const PublicProfilePage = lazy(() => import('../pages/profile/PublicProfilePage'));
const PoolInviteMissingCodePage = lazy(() =>
  import('../pages/pool-invite/PoolInviteMissingCodePage')
);
const PoolInvitePage = lazy(() => import('../pages/pool-invite/PoolInvitePage'));
const InviteLandingPage = lazy(() => import('../pages/invite/InviteLandingPage'));
const AboutPage = lazy(() => import('../pages/marketing/AboutPage'));
const HowItWorksPage = lazy(() => import('../pages/marketing/HowItWorksPage'));
const HowScoringWorksPage = lazy(() => import('../pages/marketing/HowScoringWorksPage'));
const PublicTourStatsPage = lazy(() => import('../pages/marketing/PublicTourStatsPage'));
const MsgGardenStatsPage = lazy(() => import('../pages/marketing/MsgGardenStatsPage'));
const AnnualTourStatsPage = lazy(() => import('../pages/marketing/AnnualTourStatsPage'));
const PhishSetlistPredictionGamePage = lazy(
  () => import('../pages/marketing/PhishSetlistPredictionGamePage'),
);
const PrivacyPolicyPage = lazy(() => import('../pages/legal/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('../pages/legal/TermsOfServicePage'));
const SetupRoute = lazy(loadSetupRoute);
const DashboardRoute = lazy(loadDashboardRoute);
// Dev-only comms template gallery (redirects home in production builds).
const CommsPreviewPage = lazy(() => import('../pages/dev/CommsPreviewPage'));
const CardShellPreviewPage = lazy(() => import('../pages/dev/CardShellPreviewPage'));

function App() {
  return (
    <Routes>
      <Route element={<RootAppShell />}>
        {/* Soft-nav compat inside app SPA. Marketing hard-nav uses login.html (#892). */}
        <Route path="/login" element={<LoginPage />} />

        {/* After email password reset — Firebase continueUrl (must stay public) */}
        <Route path="/password-reset-complete" element={<PasswordResetCompletePage />} />

        {/* Public player profile (e.g. from leaderboard links) */}
        <Route path="/user/:userId" element={<PublicProfilePage />} />

        {/* Marketing / educational pages — public, crawlable, no auth */}
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/how-scoring-works" element={<HowScoringWorksPage />} />
        <Route path="/tour-stats" element={<PublicTourStatsPage />} />
        <Route path="/tour-stats/msg" element={<MsgGardenStatsPage />} />
        <Route path="/tour-stats/2026" element={<AnnualTourStatsPage />} />
        <Route path="/tour-stats/:tourSlug" element={<PublicTourStatsPage />} />
        <Route
          path="/phish-setlist-prediction-game"
          element={<PhishSetlistPredictionGamePage />}
        />
        <Route path="/about" element={<AboutPage />} />

        {/* Legal pages — public, no auth (required for GCP OAuth consent screen) */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        {/* Public splash — no auth loading gate (WRS / SEO friendly) */}
        <Route path="/" element={<HomeRoute />} />

        {/* Pool invite: no code — drop stale breadcrumb */}
        <Route path="/join" element={<PoolInviteMissingCodePage />} />
        <Route path="/join/" element={<PoolInviteMissingCodePage />} />
        {/* Deep link — saves valid code and shows VIP landing (#580) */}
        <Route path="/join/:code" element={<PoolInvitePage />} />

        {/* Site VIP invite — no pool join side effects */}
        <Route path="/invite/:handle" element={<InviteLandingPage />} />

        {/* Dev-only: comms template preview gallery (no auth; prod redirects home) */}
        <Route path="/comms-preview" element={<CommsPreviewPage />} />
        <Route path="/card-shell-preview" element={<CardShellPreviewPage />} />

        <Route path="/setup" element={<SetupRoute />} />

        <Route path="/dashboard/*" element={<DashboardRoute />} />
      </Route>
    </Routes>
  );
}

export default App;

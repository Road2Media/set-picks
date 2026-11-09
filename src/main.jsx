import React from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './app/App.jsx'
import Ga4RouteListener from './app/Ga4RouteListener.jsx'
import ScrollToTop from './app/ScrollToTop.jsx'
import { AuthProvider } from './features/auth/provider'
import {
  shouldDeferGa4Boot,
  shouldDeferMessagingServiceWorker,
  shouldPrefetchDashboardOnBoot,
  shouldWarmAppCheckOnBoot,
} from './shared/lib/appBootPath'
import { shouldDeferFirebaseBoot } from './shared/lib/ensureFirebase'
import {
  ensureAppCheckNow,
  initializeAppCheckDeferred,
} from './shared/lib/firebaseAppCheck'
import { hasPersistedSessionHint } from './shared/lib/persistedSessionHint'
import { prefetchRouteChunk } from './shared/lib/routeChunkPrefetch'
import { peekGoogleRedirectIntent } from './features/auth/utils/googleRedirectIntent'
import './index.css'

const bootPath =
  typeof window !== 'undefined' ? window.location.pathname : ''

// #733: react-ga4 lives in vendor-ga4 and is not on the entry modulepreload
// graph. Public cold opens (/, /join, /invite) wait for idle so the library
// does not compete with the VIP route chunks. Other app routes start it now.
// Hits that fire first are queued inside ga4.js and flushed on init.
function startAnalytics() {
  void import('./shared/lib/ga4').then(({ bootAnalytics }) => bootAnalytics())
}
const scheduleIdle =
  typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2500 })
    : (fn) => setTimeout(fn, 1)
if (shouldDeferGa4Boot(bootPath)) scheduleIdle(startAnalytics)
else startAnalytics()

// #773 / #803: dashboard + setup warm App Check on boot; splash/join/invite
// stay deferred for anonymous visitors (session + auth modal warm instead).
// #853: public `/tour-stats*` hard-opens on the marketing document (not here).
// #835: anon `/login` skips idle App Check entirely — first auth CTA calls
// ensureAuthReady() so firebase-core is not downloaded to paint the form.
const deferFirebaseBoot = shouldDeferFirebaseBoot(bootPath, {
  hasSession: hasPersistedSessionHint(),
  hasRedirectIntent: Boolean(peekGoogleRedirectIntent()),
})
if (shouldWarmAppCheckOnBoot(bootPath)) {
  ensureAppCheckNow()
} else if (!deferFirebaseBoot) {
  initializeAppCheckDeferred()
}
// #804: returning sessions land on `/` only to bounce to the dashboard. Start
// that chunk in the same tick as the entry bundle instead of after auth
// resolves, so the redirect is not a serial download.
if (
  shouldPrefetchDashboardOnBoot(bootPath, { hasSession: hasPersistedSessionHint() })
) {
  prefetchRouteChunk('dashboard')
}

/**
 * FCM SW: dynamic-import the messaging module so it stays off the entry static
 * graph (no modulepreload of firebaseMessaging on splash). Immediate register
 * on dashboard/setup; idle-defer elsewhere. `getMessagingClient` still
 * registers on demand for push opt-in.
 */
function scheduleMessagingServiceWorker(pathname) {
  const start = () => {
    void import('./shared/lib/firebaseMessaging').then((m) => {
      void m.registerMessagingServiceWorker()
    })
  }
  if (shouldDeferMessagingServiceWorker(pathname)) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(start, { timeout: 5000 })
    } else {
      window.setTimeout(start, 2500)
    }
    return
  }
  start()
}

// Shared client for React Query caches (#243 profile/tour standings, #507
// show-scoped standings). Defaults tuned for read-heavy dashboard hooks
// where tab revisits should reuse data within the session.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <ScrollToTop />
            <Ga4RouteListener />
            <App />
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// Anon `/login` must not idle-import firebaseMessaging (static → firebase.js).
if (!deferFirebaseBoot) {
  scheduleMessagingServiceWorker(bootPath)
}

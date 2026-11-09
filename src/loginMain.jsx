import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import LoginApp from './app/LoginApp.jsx'
import { AuthProvider } from './features/auth/provider'
import {
  shouldDeferFirebaseBoot,
} from './shared/lib/ensureFirebase'
import { hasPersistedSessionHint } from './shared/lib/persistedSessionHint'
import { peekGoogleRedirectIntent } from './features/auth/utils/googleRedirectIntent'
import { registerRouteChunkLoaders } from './shared/lib/routeChunkPrefetch'
import './index.css'

/**
 * HTML-first auth-door Vite entry (#892 / epic #889 Phase 2).
 * Document already contains form chrome; this bundle hydrates Auth + form wiring
 * only — not the dashboard SPA graph (`main.jsx` / QueryClient / App routes).
 */

const bootPath =
  typeof window !== 'undefined' ? window.location.pathname : ''
const deferFirebaseBoot = shouldDeferFirebaseBoot(bootPath, {
  hasSession: hasPersistedSessionHint(),
  hasRedirectIntent: Boolean(peekGoogleRedirectIntent()),
})

// Session / redirect return: kick App Check (dynamic — keep app-check off entry
// modulepreload). Anon form still defers Firebase execute.
if (!deferFirebaseBoot) {
  void import('./shared/lib/firebaseAppCheck').then((m) => {
    if (hasPersistedSessionHint()) m.ensureAppCheckNow()
    else m.initializeAppCheckDeferred()
  })
}

// Post-auth snappiness: warmLoginAuthSurface prefetches by key (#805).
registerRouteChunkLoaders({
  setup: () => import('./app/routes/SetupRoute'),
  dashboard: () => import('./app/routes/DashboardRoute'),
})

const rootEl = document.getElementById('root')
const root = createRoot(rootEl)
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoginApp />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Analytics after first paint — keep GA/web-vitals off the login critical graph.
// bootAnalytics loads web-vitals only after GA init so the first hit is not dropped (#733).
const scheduleIdle =
  typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2500 })
    : (fn) => setTimeout(fn, 1)
scheduleIdle(() => {
  void import('./shared/lib/ga4').then(({ bootAnalytics }) => bootAnalytics())
})

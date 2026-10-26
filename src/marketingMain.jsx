import React from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'

import MarketingApp from './app/MarketingApp.jsx'
import { shouldStayOnMarketingDocument } from './marketingDocumentStay'
import { PERSISTED_SESSION_HINT_STORAGE_KEY } from './shared/lib/persistedSessionHint'
import './index.css'

/**
 * Marketing cold-open entry (#832) — loaded from `index.html`.
 * Real splash/marketing React UI — no AuthProvider / firebase on this graph.
 * Authenticated SPA boots from `app.html` → `main.jsx` (includes `/login` until #889 Phase 2).
 */

try {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname || ''
    // Public marketing surfaces that must stay reachable for returning
    // sessions — do not bounce them to /dashboard (#853 tour-stats).
    // Legal (`/privacy`|/terms`) is a separate zero-JS document (#916).
    const stayOnMarketingDocument = shouldStayOnMarketingDocument(path)
    if (
      !stayOnMarketingDocument &&
      window.localStorage?.getItem(PERSISTED_SESSION_HINT_STORAGE_KEY) === '1'
    ) {
      window.location.replace('/dashboard')
    } else {
      const q = new URLSearchParams(window.location.search)
      if (q.get('login') === 'true') {
        const signup = q.get('signup') === '1'
        window.location.replace(signup ? '/login?mode=signup' : '/login')
      }
    }
  }
} catch {
  // Private mode / blocked storage — continue to marketing UI.
}

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        <MarketingApp />
      </HelmetProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Analytics after first paint — dynamic import so GA/web-vitals stay off the
// marketing modulepreload graph (#835).
const scheduleIdle =
  typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2500 })
    : (fn) => setTimeout(fn, 1)
scheduleIdle(() => {
  void Promise.all([
    import('./shared/lib/ga4'),
    import('./shared/lib/webVitals'),
  ]).then(([{ initGa4 }, { initWebVitals }]) => {
    initGa4()
    initWebVitals()
  })
})

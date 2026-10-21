import React, { Suspense, useEffect, useLayoutEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import {
  LoginFocusPark,
  LoginFormShellFallback,
  ensureNeutralLoginFocusGuards,
  scheduleNeutralLoginFocus,
} from '../features/auth/login'
import AppBackground from '../shared/ui/AppBackground'
import LoginPage from '../pages/auth/LoginPage'

/**
 * Soft-nav safety net for the auth-door document (#892).
 * Terms/Privacy hard-nav via `<a href>` to the marketing document (#908);
 * if a soft route still lands here, assign so hosting can serve the correct
 * shell (not a stuck Suspense).
 */
function LeaveLoginDocument() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    const target = `${pathname}${search}${hash}`
    // Avoid reload loops on `/login` itself.
    if (pathname === '/login' || pathname.startsWith('/login/')) return
    window.location.assign(target)
  }, [pathname, search, hash])
  return <LoginFormShellFallback />
}

/**
 * Login-only router surface — no dashboard / marketing / invite routes.
 * LoginPage is static so the first React form is the final one. A lazy
 * boundary swapped a focused field for a new readOnly input and iOS dropped
 * the keyboard (#1050). Suspense stays for any later suspend, with real form
 * chrome instead of a blank spinner (anti-#881).
 */
export default function LoginApp() {
  // #909 / #1050: guards before paint; retries still catch late Safari autofocus.
  useLayoutEffect(() => {
    ensureNeutralLoginFocusGuards()
    return scheduleNeutralLoginFocus()
  }, [])

  return (
    <>
      <AppBackground />
      <LoginFocusPark />
      <div className="relative z-[1] min-h-screen">
        <Suspense fallback={<LoginFormShellFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<LeaveLoginDocument />} />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import AppBackground from '../../../shared/ui/AppBackground';
import {
  PUBLIC_SUPPORT_LABEL,
  PUBLIC_SUPPORT_MAILTO,
} from '../../../shared/config/supportContact';
import { resolveLegalBackNav } from '../model/legalBackNav';

/**
 * Shared layout for /privacy and /terms — full-screen, public, no auth.
 * Owns ambient background so soft-nav from the app SPA (Profile/account)
 * looks correct without RootAppShell. Hard-nav cold open uses the zero-JS
 * legal door shell (#916).
 *
 * @param {{
 *   title: string,
 *   lastUpdated: string,
 *   children: React.ReactNode,
 *   resumeKind?: 'signup' | 'signin' | null,
 * }} props
 */
export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
  resumeKind = null,
}) {
  const back = resolveLegalBackNav(resumeKind);
  const backClassName =
    'inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 transition-colors hover:text-white';

  return (
    <>
      <AppBackground />
      <div className="relative z-1 flex min-h-screen w-full flex-col bg-transparent text-white">
        <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8 md:py-16">
          <nav className="mb-8">
            {back.hardNav ? (
              <a href={back.href} className={backClassName}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {back.label}
              </a>
            ) : (
              <Link to={back.href} className={backClassName}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {back.label}
              </Link>
            )}
          </nav>

          <header className="mb-10">
            <h1 className="font-display text-display-xl md:text-display-xl-lg font-bold italic text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">
              {title}
            </h1>
            <p className="mt-3 text-sm font-bold text-slate-500">
              Last updated: {lastUpdated}
            </p>
          </header>

          <article className="legal-prose space-y-6 text-sm leading-relaxed text-slate-300 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-base [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-200 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand-primary [&_a]:underline [&_a]:decoration-brand-primary/40 [&_a]:underline-offset-2 [&_a]:hover:decoration-brand-primary">
            {children}
          </article>

          <footer className="mt-16 border-t border-slate-800/60 pt-6 text-center text-xs font-medium text-slate-500">
            <p>&copy; {new Date().getFullYear()} Road2 Media, LLC. All rights reserved.</p>
            <p className="mt-2 space-x-4">
              <Link
                to="/privacy"
                className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200"
              >
                Terms of Service
              </Link>
              <a
                href={PUBLIC_SUPPORT_MAILTO}
                className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200"
              >
                {PUBLIC_SUPPORT_LABEL}
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

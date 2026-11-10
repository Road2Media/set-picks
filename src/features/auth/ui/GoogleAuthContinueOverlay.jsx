import React from 'react';

import { resolveGoogleContinueMessage } from './googleContinueCopy';

/**
 * Full-screen chrome while Google OAuth is in flight (#860).
 * Covers the blank gap before redirect unload / popup settle / redirect return.
 *
 * @param {{ intent?: 'signin' | 'signup' | null }} props
 */
export default function GoogleAuthContinueOverlay({ intent = 'signin' }) {
  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-brand-bg/85 px-6 backdrop-blur-xs"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-teal-400"
          aria-hidden
        />
        <p className="text-sm font-semibold text-slate-300">
          {resolveGoogleContinueMessage(intent)}
        </p>
      </div>
    </div>
  );
}

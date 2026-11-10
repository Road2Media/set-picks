import React from 'react';

/**
 * Sticky bottom banner shown when a new service worker is waiting to activate.
 * Tapping "Reload" posts SKIP_WAITING to the waiting worker via applyUpdate().
 */
export default function UpdateAvailableBanner({ onReload }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-teal-400/40 bg-slate-900/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md"
    >
      <span className="text-sm font-semibold text-slate-200">Update available</span>
      <button
        type="button"
        onClick={onReload}
        className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-black text-slate-900 transition-colors hover:bg-teal-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        Reload
      </button>
    </div>
  );
}

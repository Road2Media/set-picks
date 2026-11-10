import React from 'react';

import { useHideCrowdPulse } from '../model/useHideCrowdPulse';

/**
 * Preferences control for competitive players (#694 P3).
 * Checked means the room's picks stay off every crowd pulse surface.
 */
export default function HideCrowdPulsePreference() {
  const { error, hideCrowdPulse, isSaving, setHideCrowdPulse } =
    useHideCrowdPulse();

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border-muted/60 bg-surface-inset/40 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-black text-white">
            Hide crowd pulse
          </span>
          <span className="mt-1 block text-xs font-bold leading-relaxed text-content-secondary">
            Hides what the room locked in on Standings, the crowd night page,
            Make Picks, and Scorecard.
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded-sm border-border-muted/60 text-brand-primary focus:ring-brand-primary"
          checked={hideCrowdPulse}
          disabled={isSaving}
          aria-label="Hide crowd pulse"
          onChange={(event) => setHideCrowdPulse(event.target.checked)}
        />
      </label>
      {error ? (
        <p className="text-xs font-bold text-red-400" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

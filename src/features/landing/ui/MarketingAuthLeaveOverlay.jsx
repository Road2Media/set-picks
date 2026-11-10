import React from 'react';

import { MARKETING_LEAVE_SIGN_IN } from '../model/marketingAuthLeaveCopy';

/**
 * Immediate leave chrome while marketing hard-navs to `/login` (#872).
 * Paints before document swap so Jump on Tour / Make picks now never feel dead.
 * Pass destination-aware copy via `message` (sign up vs sign in).
 */
export default function MarketingAuthLeaveOverlay({
  message = MARKETING_LEAVE_SIGN_IN,
}) {
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
        <p className="text-sm font-semibold text-slate-300">{message}</p>
      </div>
    </div>
  );
}

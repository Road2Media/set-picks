import React from 'react';

import Button from '../../../shared/ui/Button';
import {
  DASHBOARD_CARD_PAD,
  DASHBOARD_CARD_RADIUS,
} from '../../../shared/ui/dashboardCardClasses';
import { AUTH_GOOGLE_CTA } from './authCtaClasses';
import { GOOGLE_CTA_DEFAULT } from './googleCtaLabel';

/**
 * Shared auth credentials chrome (#834) — Google CTA, divider, and form slot.
 * Modal shell wraps this in a dialog; `/login` uses it as a page panel.
 *
 * Geometry matches dashboard L1 promo/sponsor cards (`rounded-xl`, quiet
 * border + panel fill) so `/login` reads as a primary surface, not a
 * floating glass widget.
 */
export default function SplashAuthPanel({
  title,
  onClose,
  showClose = false,
  handleGoogle,
  onGoogleIntent,
  busy,
  googleDisabled,
  googleLabel,
  prependContent,
  googleFootnote,
  children,
}) {
  const isGoogleDisabled =
    typeof googleDisabled === 'boolean' ? googleDisabled : busy;
  const ctaLabel =
    typeof googleLabel === 'string' && googleLabel.trim()
      ? googleLabel
      : GOOGLE_CTA_DEFAULT;
  const googlePending = isGoogleDisabled && ctaLabel !== GOOGLE_CTA_DEFAULT;
  // Desktop intent warm (#850) — `/login` also immediate-warms after paint (#858).
  const intentProps =
    typeof onGoogleIntent === 'function'
      ? {
          onPointerEnter: onGoogleIntent,
          onFocus: onGoogleIntent,
        }
      : undefined;

  return (
    <div
      className={`w-full max-w-md ${DASHBOARD_CARD_RADIUS} border border-border-subtle/60 bg-surface-panel/40 ${DASHBOARD_CARD_PAD} md:p-6!`}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-[1.75rem]">
          {title}
        </h1>
        {showClose && typeof onClose === 'function' ? (
          <Button
            variant="text"
            type="button"
            onClick={onClose}
            className="px-2 py-0 text-2xl leading-none text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ×
          </Button>
        ) : null}
      </div>

      {prependContent ? <div className="mb-5">{prependContent}</div> : null}

      {/* Native <button>: shared Button `text` uses hover:text-white (blanks white CTA). */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isGoogleDisabled}
        aria-busy={googlePending}
        className={AUTH_GOOGLE_CTA}
        {...intentProps}
      >
        {googlePending ? (
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900"
            aria-hidden
          />
        ) : (
          <img
            src="https://www.google.com/favicon.ico"
            alt=""
            className="h-5 w-5"
          />
        )}
        {ctaLabel}
      </button>

      {googleFootnote ? (
        <p className="mt-2.5 text-center text-xs font-medium leading-relaxed text-slate-400">
          {googleFootnote}
        </p>
      ) : null}

      <div className="mb-5 mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-subtle/60" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          or
        </span>
        <div className="h-px flex-1 bg-border-subtle/60" />
      </div>

      {children}
    </div>
  );
}

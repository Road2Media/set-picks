/**
 * Shared geometry for Google + email auth CTAs so neither reads larger.
 * (Shared Button `secondary` uses border-2 + md padding, which outgrows Google.)
 */
export const AUTH_CTA_BOX =
  'inline-flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-base font-black leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50';

/** Bold white chip; hover brightens (glow + ring) since fill is already white. */
export const AUTH_GOOGLE_CTA = `${AUTH_CTA_BOX} bg-white text-slate-900 ring-1 ring-black/10 hover:bg-white hover:text-black hover:ring-white/50 hover:brightness-110 hover:shadow-[0_0_28px_-6px_rgba(255,255,255,0.55)] active:brightness-100 active:shadow-none`;

/** Ring (not border) so box size matches Google’s ring-1 CTA. */
export const AUTH_EMAIL_CTA = `${AUTH_CTA_BOX} bg-transparent text-teal-300 ring-1 ring-teal-400/70 hover:bg-teal-400/10 hover:ring-teal-300`;

/** Same box as the email CTA, quieter. Not an underlined text link. */
export const AUTH_FORGOT_CTA = `${AUTH_CTA_BOX} bg-transparent text-slate-300 ring-1 ring-white/15 hover:bg-white/5 hover:text-white hover:ring-white/40`;

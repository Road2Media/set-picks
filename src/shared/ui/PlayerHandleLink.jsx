import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Deep-link a player handle to their public profile at `/user/:uid` (#222).
 *
 * Single source of truth for the "brand-primary hover underline" handle link
 * pattern used by Pool hub leaderboard, Show standings rows, Tour standings
 * rows, and the Standings "winner of the night" banner so they stay visually
 * consistent.
 *
 * Falls back to a plain `<span>` when no `userId` is available (legacy
 * records), preserving styling parity minus the hover affordance.
 *
 * The link intentionally calls `stopPropagation` on click so it can be
 * embedded inside row-level click targets (e.g. expandable Show standings
 * rows) without toggling the row. Callers that render the link outside of a
 * row container can ignore that behavior — it's a no-op for them.
 *
 * @param {{
 *   userId?: string | null,
 *   handle?: string | null,
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
export default function PlayerHandleLink({
  userId,
  handle,
  className = '',
  ariaLabel,
}) {
  const safeHandle = (handle || '').trim() || 'Anonymous';
  const baseClass =
    'font-bold tracking-tight text-brand-primary hover:text-brand-primary-strong hover:underline decoration-brand-primary/70 underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand rounded-xs';
  const combined = className ? `${baseClass} ${className}` : baseClass;

  if (!userId) {
    return <span className={combined}>{safeHandle}</span>;
  }

  return (
    <Link
      to={`/user/${userId}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel || `View ${safeHandle}'s profile`}
      className={combined}
    >
      {safeHandle}
    </Link>
  );
}

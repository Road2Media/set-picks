import React from 'react';
import { Share } from 'lucide-react';

const ghostInviteClass =
  'inline-flex items-center gap-1.5 rounded-md px-0 py-0 text-sm font-semibold tracking-tight text-content-secondary transition-colors hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Presentational ghost-style invite control (no IO).
 */
export function PoolInviteShareButtonView({
  label,
  onShareClick,
  disabled,
  title,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onShareClick}
      disabled={disabled}
      className={`${ghostInviteClass} ${className}`.trim()}
      title={title}
    >
      <Share className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

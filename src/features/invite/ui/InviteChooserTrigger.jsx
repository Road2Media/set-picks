import React from 'react';
import { UserPlus } from 'lucide-react';

/**
 * Primary standings Invite control — opens the chooser sheet (never auto-shares).
 */
export default function InviteChooserTrigger({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-brand-primary/45 bg-brand-primary/15 px-2.5 py-1 text-[11px] font-bold text-brand-primary transition-colors hover:bg-brand-primary/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg sm:px-3 sm:text-xs',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <UserPlus className="h-3.5 w-3.5" aria-hidden />
      <span>Invite</span>
    </button>
  );
}

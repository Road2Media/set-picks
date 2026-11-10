import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { hasSelectedAvatar } from '../model/avatarCatalog';
import { resolveEarnedBadges } from '../model/badgeCatalog';
import ProfileAvatar from './ProfileAvatar';

/**
 * Standings / hub identity mark: avatar next to handle, optional earned-badge
 * pin, and an “add” affordance when the viewer’s own avatar is unset (#567/#568).
 *
 * @param {{
 *   avatarId?: string | null,
 *   badges?: Record<string, unknown> | null,
 *   isSelf?: boolean,
 *   handle?: string | null,
 * }} props
 */
export default function StandingsPlayerAvatar({
  avatarId = null,
  badges = null,
  isSelf = false,
  handle = null,
}) {
  const selected = hasSelectedAvatar(avatarId);
  const showcase = resolveEarnedBadges(badges)[0] || null;
  const label = (handle || '').trim() || 'Player';
  const initial = label.charAt(0).toUpperCase();

  // Self with no avatar yet → tappable “add” affordance.
  if (isSelf && !selected) {
    return (
      <Link
        to="/dashboard/profile"
        onClick={(e) => e.stopPropagation()}
        aria-label="Add a profile avatar"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-brand-primary/55 bg-surface-field text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </Link>
    );
  }

  // A player who has picked a catalog avatar shows it; everyone else gets a
  // neutral initial chip so unset users don’t all read as the default ticket.
  const mark = selected ? (
    <ProfileAvatar
      avatarId={avatarId}
      size="sm"
      alt={`${label}'s avatar`}
      className="h-9! w-9! rounded-full!"
    />
  ) : (
    <span
      aria-label={`${label}'s avatar`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle/50 bg-surface-field text-xs font-black uppercase tracking-wide text-content-secondary"
    >
      {initial}
    </span>
  );

  return (
    <span className="relative inline-flex h-9 w-9 shrink-0">
      {mark}
      {showcase ? (
        <img
          src={showcase.src}
          alt=""
          width={18}
          height={18}
          title={showcase.name}
          className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-md border border-border-subtle/50 bg-surface-panel/50 shadow-xs"
          decoding="async"
        />
      ) : null}
    </span>
  );
}

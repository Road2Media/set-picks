import React from 'react';

import { resolveAvatar } from '../model/avatarCatalog';

/**
 * Presentational profile avatar mark.
 *
 * @param {{
 *   avatarId?: string | null,
 *   size?: 'sm' | 'md' | 'lg',
 *   className?: string,
 *   alt?: string,
 * }} props
 */
export default function ProfileAvatar({
  avatarId,
  size = 'md',
  className = '',
  alt,
}) {
  const avatar = resolveAvatar(avatarId);
  const dim =
    size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';

  return (
    <img
      src={avatar.src}
      alt={alt ?? avatar.label}
      width={size === 'lg' ? 80 : size === 'sm' ? 40 : 56}
      height={size === 'lg' ? 80 : size === 'sm' ? 40 : 56}
      className={`${dim} shrink-0 rounded-2xl border border-border-subtle/50 bg-surface-field object-cover ${className}`.trim()}
      decoding="async"
    />
  );
}

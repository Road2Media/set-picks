import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AVATAR_ID,
  PROFILE_AVATARS,
  explicitAvatarId,
  hasSelectedAvatar,
  normalizeAvatarId,
  resolveAvatar,
} from './avatarCatalog';

describe('avatarCatalog', () => {
  it('has unique ids and default in the catalog', () => {
    const ids = PROFILE_AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_AVATAR_ID);
    expect(PROFILE_AVATARS.length).toBeGreaterThanOrEqual(8);
  });

  it('normalizes unknown / empty ids to default', () => {
    expect(normalizeAvatarId(undefined)).toBe(DEFAULT_AVATAR_ID);
    expect(normalizeAvatarId('')).toBe(DEFAULT_AVATAR_ID);
    expect(normalizeAvatarId('not-a-real-avatar')).toBe(DEFAULT_AVATAR_ID);
    expect(normalizeAvatarId('flame')).toBe('flame');
  });

  it('resolves src paths under /avatars', () => {
    const avatar = resolveAvatar('disc');
    expect(avatar.src).toBe('/avatars/disc.svg');
    expect(avatar.label).toMatch(/vinyl/i);
  });

  it('detects whether an avatar was explicitly selected', () => {
    expect(hasSelectedAvatar(undefined)).toBe(false);
    expect(hasSelectedAvatar(null)).toBe(false);
    expect(hasSelectedAvatar('')).toBe(false);
    expect(hasSelectedAvatar('ticket')).toBe(true);
    expect(hasSelectedAvatar('nope')).toBe(false);
  });

  it('keeps an explicit catalog id and leaves unset values null (#643)', () => {
    expect(explicitAvatarId(undefined)).toBeNull();
    expect(explicitAvatarId(null)).toBeNull();
    expect(explicitAvatarId('')).toBeNull();
    expect(explicitAvatarId('not-a-real-avatar')).toBeNull();
    expect(explicitAvatarId('ticket')).toBe('ticket');
    expect(explicitAvatarId(' flame ')).toBe('flame');
    expect(normalizeAvatarId(null)).toBe(DEFAULT_AVATAR_ID);
    expect(resolveAvatar(null).id).toBe(DEFAULT_AVATAR_ID);
  });
});

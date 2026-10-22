import { describe, expect, it } from 'vitest';

import {
  didAvatarSelectionChange,
  profileAvatarSaveFields,
  seedProfileAvatarId,
} from './profileAvatarForm';

describe('profile avatar form seed and save (#643)', () => {
  it('seeds unset profiles as null, including a missing document', () => {
    expect(seedProfileAvatarId(null)).toBeNull();
    expect(seedProfileAvatarId(undefined)).toBeNull();
    expect(seedProfileAvatarId({})).toBeNull();
    expect(seedProfileAvatarId({ avatarId: null })).toBeNull();
    expect(seedProfileAvatarId({ avatarId: '' })).toBeNull();
    expect(seedProfileAvatarId({ avatarId: '   ' })).toBeNull();
    expect(seedProfileAvatarId({ avatarId: 'not-a-real-avatar' })).toBeNull();
  });

  it('seeds an explicit ticket choice as ticket', () => {
    expect(seedProfileAvatarId({ avatarId: 'ticket' })).toBe('ticket');
    expect(seedProfileAvatarId({ avatarId: ' flame ' })).toBe('flame');
  });

  it('omits avatarId from the save payload when nothing is selected', () => {
    expect(profileAvatarSaveFields(null)).toEqual({});
    expect(profileAvatarSaveFields(undefined)).toEqual({});
    expect(profileAvatarSaveFields('')).toEqual({});
    expect(profileAvatarSaveFields('nope')).toEqual({});
    expect('avatarId' in profileAvatarSaveFields(null)).toBe(false);
  });

  it('includes ticket only when the user picked ticket', () => {
    expect(profileAvatarSaveFields('ticket')).toEqual({ avatarId: 'ticket' });
    expect(profileAvatarSaveFields('  flame  ')).toEqual({ avatarId: 'flame' });
  });

  it('does not treat a still-unset save as an avatar change', () => {
    expect(didAvatarSelectionChange(null, null)).toBe(false);
    expect(didAvatarSelectionChange('ticket', 'ticket')).toBe(false);
    expect(didAvatarSelectionChange(null, 'ticket')).toBe(true);
    expect(didAvatarSelectionChange('flame', 'ticket')).toBe(true);
    expect(didAvatarSelectionChange('ticket', null)).toBe(false);
  });
});

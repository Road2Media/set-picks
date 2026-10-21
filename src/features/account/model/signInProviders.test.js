import { describe, expect, it } from 'vitest';

import {
  accountSecurityMode,
  readSignInProviderIds,
  signInProviderLabel,
} from './signInProviders.js';

function userWith(providerIds, email = 'fan@example.com') {
  return {
    email,
    providerData: providerIds.map((providerId) => ({ providerId })),
  };
}

describe('signInProviders', () => {
  it('reads provider ids from the client user', () => {
    expect(readSignInProviderIds(userWith(['google.com', 'password']))).toEqual([
      'google.com',
      'password',
    ]);
    expect(readSignInProviderIds(null)).toEqual([]);
  });

  it('names every linked method, including both', () => {
    expect(signInProviderLabel(userWith(['password']))).toBe('Email & password');
    expect(signInProviderLabel(userWith(['google.com']))).toBe('Google');
    expect(signInProviderLabel(userWith(['google.com', 'password']))).toBe(
      'Google and email & password',
    );
    expect(signInProviderLabel(userWith(['password', 'google.com']))).toBe(
      'Google and email & password',
    );
    expect(signInProviderLabel(userWith([]))).toBe('Unknown');
  });

  it('keeps the password form when Google is also linked', () => {
    expect(accountSecurityMode(userWith(['google.com']))).toBe('google-only');
    expect(accountSecurityMode(userWith(['password']))).toBe('password');
    expect(accountSecurityMode(userWith(['google.com', 'password']))).toBe('both');
    expect(accountSecurityMode({ providerData: [{ providerId: 'password' }] })).toBe(
      'google-only',
    );
  });
});

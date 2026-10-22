import { describe, expect, it } from 'vitest';

import { buildInitialUserProfilePayload } from './profileSetupApi';

const SERVER_SENTINEL = Symbol('serverTimestamp');
const factories = {
  serverTimestamp: () => SERVER_SENTINEL,
  // Use the Date instance itself as the stand-in for the Firestore
  // Timestamp so tests can assert "we passed `authCreationTime` through".
  timestampFromDate: (d) => d,
};

const baseParams = {
  handle: ' Pat ',
  favoriteSong: ' Wilson  ',
  email: 'pat@example.com',
  authCreationTime: '2026-05-08T16:30:00.000Z',
};

describe('buildInitialUserProfilePayload', () => {
  it('canonical first-time write — no existing doc, no auth time', () => {
    const out = buildInitialUserProfilePayload(
      null,
      { ...baseParams, authCreationTime: null },
      factories
    );
    expect(out.handle).toBe('Pat');
    expect(out.favoriteSong).toBe('Wilson');
    expect(out.email).toBe('pat@example.com');
    expect(out.createdAt).toBe(SERVER_SENTINEL);
    expect(out.totalPoints).toBe(0);
    expect('avatarId' in out).toBe(false);
  });

  it('uses Firebase Auth creationTime when provided (orphan repair)', () => {
    // Regression: before PR-2, an orphan completing setup got a fresh
    // serverTimestamp() for createdAt, clobbering their real signup
    // date. With authCreationTime we preserve the truth.
    const out = buildInitialUserProfilePayload(
      { termsPrivacyAcceptedAt: { seconds: 1, nanoseconds: 0 } }, // CONSENT_ONLY
      baseParams,
      factories
    );
    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.createdAt.toISOString()).toBe('2026-05-08T16:30:00.000Z');
    expect(out.totalPoints).toBe(0);
  });

  it('preserves existing createdAt when present (idempotent setup re-run)', () => {
    const existingCreatedAt = { seconds: 1715000000, nanoseconds: 0 };
    const out = buildInitialUserProfilePayload(
      { createdAt: existingCreatedAt, totalPoints: 42 },
      baseParams,
      factories
    );
    // Field is intentionally absent — `setDoc({ merge: true })` will leave
    // the existing value alone.
    expect('createdAt' in out).toBe(false);
    expect('totalPoints' in out).toBe(false);
  });

  it('preserves a non-zero totalPoints (rollup-before-setup race)', () => {
    const out = buildInitialUserProfilePayload(
      { totalPoints: 25 },
      { ...baseParams, authCreationTime: null },
      factories
    );
    expect('totalPoints' in out).toBe(false);
    expect(out.createdAt).toBe(SERVER_SENTINEL);
  });

  it('falls back to serverTimestamp when authCreationTime is unparseable', () => {
    const out = buildInitialUserProfilePayload(
      null,
      { ...baseParams, authCreationTime: 'definitely-not-an-iso-date' },
      factories
    );
    expect(out.createdAt).toBe(SERVER_SENTINEL);
  });

  it('falls back to serverTimestamp when authCreationTime is empty string', () => {
    const out = buildInitialUserProfilePayload(
      null,
      { ...baseParams, authCreationTime: '' },
      factories
    );
    expect(out.createdAt).toBe(SERVER_SENTINEL);
  });

  it('defaults favoriteSong to "Unknown" when blank', () => {
    const out = buildInitialUserProfilePayload(
      null,
      { ...baseParams, favoriteSong: '   ', authCreationTime: null },
      factories
    );
    expect(out.favoriteSong).toBe('Unknown');
  });

  it('coerces missing email to null', () => {
    const out = buildInitialUserProfilePayload(
      null,
      { ...baseParams, email: undefined, authCreationTime: null },
      factories
    );
    expect(out.email).toBeNull();
  });

  it('resets totalPoints to 0 when existing value is non-numeric (corrupt)', () => {
    const out = buildInitialUserProfilePayload(
      { totalPoints: 'oops' },
      { ...baseParams, authCreationTime: null },
      factories
    );
    expect(out.totalPoints).toBe(0);
  });
});

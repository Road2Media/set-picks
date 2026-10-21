import { describe, expect, it } from 'vitest';

import { passwordResetSentNotice } from './passwordResetNoticeCopy.js';

describe('passwordResetSentNotice', () => {
  it('tells splash and sign-in to check spam, then return', () => {
    expect(passwordResetSentNotice('fan@example.com', { returnToSignIn: true })).toBe(
      "Check your inbox at fan@example.com for a password reset link. If you don't see it in a few minutes, check your spam or junk folder. Then return here to sign in.",
    );
  });

  it('tells account security to check spam', () => {
    expect(passwordResetSentNotice('fan@example.com')).toBe(
      "Check your inbox at fan@example.com for a password reset link. If you don't see it in a few minutes, check your spam or junk folder.",
    );
  });
});

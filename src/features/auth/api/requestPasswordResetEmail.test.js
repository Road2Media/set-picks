import { beforeEach, describe, expect, it, vi } from 'vitest';

const callableMock = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => callableMock),
}));

vi.mock('../../../shared/lib/firebase', () => ({
  app: { name: 'test-app' },
}));

import { httpsCallable } from 'firebase/functions';
import { requestPasswordResetEmail, PASSWORD_RESET_CALLABLE } from './requestPasswordResetEmail';

describe('requestPasswordResetEmail', () => {
  beforeEach(() => {
    callableMock.mockReset();
    httpsCallable.mockClear();
  });

  it('calls the unauthenticated reset callable with the trimmed address', async () => {
    callableMock.mockResolvedValue({ data: { ok: true } });
    const result = await requestPasswordResetEmail('  Fan@Example.com  ');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), PASSWORD_RESET_CALLABLE);
    expect(callableMock).toHaveBeenCalledWith({ email: 'Fan@Example.com' });
    expect(result).toEqual({ ok: true });
  });

  it('passes through a Google-only sign-in result without treating it as a send', async () => {
    callableMock.mockResolvedValue({ data: { ok: true, signIn: 'google' } });
    const result = await requestPasswordResetEmail('pat@road2media.com');
    expect(result).toEqual({ ok: true, signIn: 'google' });
  });

  it('maps rate limits onto the existing too-many-requests code', async () => {
    const error = new Error('Too many password reset requests. Try again later.');
    error.code = 'functions/resource-exhausted';
    callableMock.mockRejectedValue(error);
    await expect(requestPasswordResetEmail('fan@example.com')).rejects.toMatchObject({
      code: 'auth/too-many-requests',
    });
  });

  it('treats a body without ok as a send failure', async () => {
    callableMock.mockResolvedValue({ data: {} });
    await expect(requestPasswordResetEmail('fan@example.com')).rejects.toMatchObject({
      code: 'auth/internal-error',
    });
  });

  it('hides not-found and transport failures behind one generic error', async () => {
    const error = new Error('User not found');
    error.code = 'functions/not-found';
    callableMock.mockRejectedValue(error);
    await expect(requestPasswordResetEmail('fan@example.com')).rejects.toMatchObject({
      code: 'auth/internal-error',
      message: 'Could not send reset email. Try again later.',
    });
  });
});

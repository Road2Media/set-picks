/**
 * Client Firebase Auth `user.providerData` — not Admin `getUser()`.
 * An account can list both `google.com` and `password` on the same uid.
 */

/**
 * @param {{ providerData?: Array<{ providerId?: string }> } | null | undefined} user
 * @returns {string[]}
 */
export function readSignInProviderIds(user) {
  const data = user?.providerData;
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => (typeof entry?.providerId === 'string' ? entry.providerId : ''))
    .filter(Boolean);
}

/**
 * Preferences eyebrow. Password used to hide Google; both stay visible.
 *
 * @param {{ providerData?: Array<{ providerId?: string }> } | null | undefined} user
 * @returns {string}
 */
export function signInProviderLabel(user) {
  const ids = readSignInProviderIds(user);
  const password = ids.includes('password');
  const google = ids.includes('google.com');
  if (google && password) return 'Google and email & password';
  if (password) return 'Email & password';
  if (google) return 'Google';
  return ids[0] || 'Unknown';
}

/**
 * Which account-security panel to show.
 * `both` keeps the password form and says Google is still linked.
 *
 * @param {{ email?: string, providerData?: Array<{ providerId?: string }> } | null | undefined} user
 * @returns {'google-only' | 'password' | 'both'}
 */
export function accountSecurityMode(user) {
  const email = typeof user?.email === 'string' ? user.email : '';
  const ids = readSignInProviderIds(user);
  if (!email || !ids.includes('password')) return 'google-only';
  if (ids.includes('google.com')) return 'both';
  return 'password';
}

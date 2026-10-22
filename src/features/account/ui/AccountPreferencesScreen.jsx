import React, { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useSignOut } from '../../auth';
import { InstallAppCard, isInstalled } from '../../install';
import { NotificationPrefsPanel } from '../../notifications';
import Button from '../../../shared/ui/Button';
import {
  PUBLIC_SUPPORT_LABEL,
  PUBLIC_SUPPORT_MAILTO,
} from '../../../shared/config/supportContact';
import { signInProviderLabel } from '../model/signInProviders';
import AccountSecurity from './AccountSecurity';
import DeleteAccountSection from './DeleteAccountSection';

/**
 * Preferences tertiary — sign-in, logout, notification prefs, install/PWA, legal.
 * Contact us is `support@setlistpickem.com` (inbound allowlist → Workspace).
 *
 * @param {{ user: import('firebase/auth').User | null | undefined }} props
 */
export default function AccountPreferencesScreen({ user }) {
  const signOut = useSignOut();
  const [searchParams, setSearchParams] = useSearchParams();

  const focusPush =
    searchParams.get('openPush') === '1' || searchParams.get('section') === 'push';

  const consumePushFocus = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('openPush');
    next.delete('section');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const providerLabel = signInProviderLabel(user);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out: ', error);
    }
  };

  const installed =
    typeof window !== 'undefined' && isInstalled(window, navigator);

  return (
    <div>
      <p className="mb-6 text-xs font-bold uppercase tracking-widest text-content-secondary">
        Sign-in · {providerLabel}
      </p>

      <div className="mb-8">
        <AccountSecurity user={user} showHeading={false} />
      </div>

      <div className="border-t border-border-muted pt-6">
        <Button
          variant="text"
          onClick={handleLogout}
          type="button"
          className="w-full bg-transparent hover:bg-red-500/10 border-2 border-red-500/30 hover:border-red-500 text-red-400 text-sm py-4 rounded-xl uppercase tracking-widest"
        >
          Log Out
        </Button>
      </div>

      <div className="mt-10 border-t border-border-muted pt-8">
        <p className="mb-1 text-xs font-black uppercase tracking-widest text-content-secondary">
          Notifications
        </p>
        <p className="mb-6 text-sm font-bold leading-relaxed text-content-secondary">
          Messages always appear in your inbox on Messages. Use the controls below for push and
          email.
        </p>
        <NotificationPrefsPanel
          focusSection={focusPush ? 'push' : null}
          onFocusConsumed={consumePushFocus}
        />
      </div>

      {installed ? (
        <p className="mt-8 rounded-2xl border border-border-muted/60 bg-surface-inset/40 px-4 py-3 text-xs font-bold leading-relaxed text-content-secondary">
          Installed on this device — Setlist Pick &apos;Em is on your home screen.
        </p>
      ) : (
        <InstallAppCard />
      )}

      {user?.uid ? (
        <footer className="mt-10 border-t border-border-muted/40 pb-2 pt-6 text-center text-[11px] font-medium text-content-secondary/70">
          <span className="space-x-2">
            <Link
              to="/privacy"
              className="underline decoration-border-muted underline-offset-2 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <span aria-hidden>&middot;</span>
            <Link
              to="/terms"
              className="underline decoration-border-muted underline-offset-2 transition-colors hover:text-white"
            >
              Terms
            </Link>
            <span aria-hidden>&middot;</span>
            <a
              href={PUBLIC_SUPPORT_MAILTO}
              className="underline decoration-border-muted underline-offset-2 transition-colors hover:text-white"
            >
              {PUBLIC_SUPPORT_LABEL}
            </a>
          </span>
        </footer>
      ) : null}

      <DeleteAccountSection />
    </div>
  );
}

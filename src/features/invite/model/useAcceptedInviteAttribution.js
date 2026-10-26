import { useEffect } from 'react';

import { useAuth } from '../../auth';
import { recordAcceptedInviteIfPending } from '../api/recordAcceptedInvite';
import { peekPendingInviter } from './pendingInviter';

/**
 * After setup, send the stored inviter handle once. A click never reaches
 * this. The server decides whether the account is a new signup.
 */
export function useAcceptedInviteAttribution() {
  const { user, userProfile, loading } = useAuth();
  const handle = typeof userProfile?.handle === 'string' ? userProfile.handle.trim() : '';

  useEffect(() => {
    if (loading || !user || !handle || !peekPendingInviter()) return undefined;
    let cancelled = false;
    recordAcceptedInviteIfPending().catch((err) => {
      if (!cancelled) console.error('Accepted invite attribution failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user, handle]);
}

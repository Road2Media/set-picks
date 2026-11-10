import { useCallback, useState } from 'react';

import { useAuth } from '../../auth';
import { mergeHideCrowdPulse } from '../api/gamePrefsApi';
import { resolveHideCrowdPulse } from './crowdPulsePreference';

/**
 * Live hide-crowd preference from the signed-in user doc.
 * The dashboard does not mount until that doc has loaded.
 */
export function useHideCrowdPulse() {
  const { user, userProfile } = useAuth();
  const hideCrowdPulse = resolveHideCrowdPulse(userProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const setHideCrowdPulse = useCallback(
    async (value) => {
      if (!user?.uid || typeof value !== 'boolean') return;
      setIsSaving(true);
      setError('');
      try {
        await mergeHideCrowdPulse(user.uid, value);
      } catch (e) {
        console.error(e);
        setError('Could not save preference. Try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [user?.uid]
  );

  return {
    error,
    hideCrowdPulse,
    isSaving,
    setHideCrowdPulse,
  };
}

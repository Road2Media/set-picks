import React from 'react';

import { useAuth } from '../../features/auth';
import { PhishIqAccount } from '../../features/phish-iq';

/**
 * Signed-in Phish IQ (`/dashboard/phish-iq`). The page only wires auth.
 */
export default function PhishIqDashboardPage() {
  const { user, userProfile } = useAuth();
  return <PhishIqAccount user={user} profile={userProfile} />;
}

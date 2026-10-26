import React from 'react';

import {
  RewindComingSoon,
  RewindPlayView,
  isRewindModeEnabled,
  useRewindPlay,
} from '../../features/rewind';

export default function RewindPlayPage({ user }) {
  const enabled = isRewindModeEnabled();
  const play = useRewindPlay({ user, enabled });

  if (!enabled) return <RewindComingSoon />;
  return <RewindPlayView {...play} />;
}

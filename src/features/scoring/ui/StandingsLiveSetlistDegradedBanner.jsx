import React from 'react';

import StatusBanner from '../../../shared/ui/StatusBanner';

/**
 * Non-blocking player notice while live setlist polling is degraded (#644).
 *
 * @param {{ message?: string }} props
 */
export default function StandingsLiveSetlistDegradedBanner({ message }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-3">
      <StatusBanner type="warning" message={message} />
    </div>
  );
}

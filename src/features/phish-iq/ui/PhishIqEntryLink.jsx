import React from 'react';
import { Link } from 'react-router-dom';

import { PICKS_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import { NAV_LABEL_PHISH_IQ } from '../../../shared/config/dashboardVocabulary';
import Card from '../../../shared/ui/Card';

export const PHISH_IQ_ENTRY_BODY =
  'Five questions on today’s songs. Same quiz for every player.';

/**
 * Make Picks entry for the logged-in quiz (#1258).
 * Nested under the Picks primary. Not a tertiary segment.
 */
export default function PhishIqEntryLink() {
  return (
    <Card
      as={Link}
      to={PICKS_CLUSTER_PATHS.phishIq}
      data-phish-iq-entry
      variant="inset"
      padding="sm"
      className="mb-4 flex items-center justify-between gap-3 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span>
        <span className="block text-sm font-bold text-content-primary">{NAV_LABEL_PHISH_IQ}</span>
        <span className="mt-0.5 block text-xs leading-snug text-content-secondary">
          {PHISH_IQ_ENTRY_BODY}
        </span>
      </span>
      <span className="shrink-0 text-xs font-black uppercase tracking-widest text-brand-primary">
        Play
      </span>
    </Card>
  );
}

import React, { useRef } from 'react';

import { SponsorSlot } from '../../../shared/ui';
import { getAdSlot } from '../config/adSlots';
import { useAdCreative } from '../model/useAdCreative';
import { useAdImpression } from '../model/useAdImpression';
import AdCreativeLink from './AdCreativeLink';

/**
 * First-party promo for one explicit slot (#121).
 *
 * Renders nothing when the slot is unknown, Remote Config is off, or the
 * creative is missing or invalid. `VITE_ENABLE_SPONSOR_SLOTS=true` still
 * shows the empty proportion shell for local and preview layout checks.
 * That flag does not fill a creative.
 *
 * @param {{ slotId: string, className?: string }} props
 */
export default function AdPlacement({ slotId, className = '' }) {
  const slot = getAdSlot(slotId);
  const { creative } = useAdCreative(slotId);
  const impressionRef = useRef(null);
  const previewShell = import.meta.env.VITE_ENABLE_SPONSOR_SLOTS === 'true';

  useAdImpression(impressionRef, {
    slotId,
    creativeId: creative?.creative_id,
    enabled: Boolean(creative),
  });

  if (!slot) return null;

  if (!creative) {
    if (!previewShell) return null;
    return (
      <SponsorSlot slotId={slotId} variant={slot.variant} className={className} />
    );
  }

  return (
    <SponsorSlot
      slotId={slotId}
      variant={slot.variant}
      className={className}
      tone="sponsored"
    >
      <div ref={impressionRef} className="flex min-w-0 flex-1">
        <AdCreativeLink slotId={slotId} creative={creative} />
      </div>
    </SponsorSlot>
  );
}

import React, { useRef } from 'react';

import { SponsorSlot } from '../../../shared/ui';
import { getAdSlot } from '../config/adSlots';
import { useAdCreative } from '../model/useAdCreative';
import { useAdImpression } from '../model/useAdImpression';
import AdCreativeLink from './AdCreativeLink';

/**
 * First-party promo for one explicit slot (#121, #420).
 *
 * The creative comes from the ad provider. This file does not import
 * Remote Config. It renders nothing when the slot is unknown, the kill
 * switch is off, or the creative is missing or invalid. A publish can
 * clear a unit that is already on screen. `VITE_ENABLE_SPONSOR_SLOTS=true`
 * still shows the empty proportion shell for local and preview layout
 * checks. That flag does not fill a creative.
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

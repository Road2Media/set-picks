import React from 'react';
import { UserPlus } from 'lucide-react';

import Button from '../../../shared/ui/Button';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_BOX_L1_MIN_H,
  STANDINGS_BOX_MEDIA_TILE,
  STANDINGS_BOX_TITLE,
} from './standingsSurfaceClasses';

/**
 * Prominent Invite promo for Standings (#609) — same visual weight as a
 * sponsor banner (logo tile + copy + CTA) so invite isn’t buried under chrome.
 * In-flow content block on mobile and desktop (not sticky chrome).
 * Outer shell is the quiet sponsor box. The Invite button stays teal.
 * The icon tile does not.
 *
 * @param {{ onInvite: () => void, className?: string }} props
 */
export default function StandingsInvitePromo({ onInvite, className = '' }) {
  return (
    <aside
      aria-label="Invite friends"
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <DashboardJobShell
        tone="none"
        pad="row"
        className={`flex ${STANDINGS_BOX_L1_MIN_H} w-full items-center gap-3.5 md:gap-4`}
      >
        <div
          className={`flex ${STANDINGS_BOX_MEDIA_TILE} items-center justify-center border border-border-subtle/60 bg-transparent md:h-16 md:w-16`}
        >
          <UserPlus
            className="h-7 w-7 text-content-secondary md:h-8 md:w-8"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${STANDINGS_BOX_TITLE}`}>Invite your crew</p>
          <p className={`mt-0.5 line-clamp-2 ${STANDINGS_BOX_BODY}`}>
            Click Invite to send a personalized invite via text or social
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 px-3! py-1.5! text-[11px] sm:px-3.5! sm:py-2!"
          onClick={onInvite}
        >
          Invite
        </Button>
      </DashboardJobShell>
    </aside>
  );
}

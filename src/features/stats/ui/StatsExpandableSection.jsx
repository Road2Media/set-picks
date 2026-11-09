import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import InfoTooltip, {
  InfoTooltipProvider,
} from '../../../shared/ui/InfoTooltip';
import {
  DASHBOARD_CARD_CHEVRON,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';

/**
 * Expandable Personal Stats container (#1004, shell #1089).
 * Phase 1 quiet card: no label color and no job wash.
 * Later insight tiles land as children — no new tertiary IA.
 *
 * @param {{
 *   title: string,
 *   hint?: string,
 *   hintLabel?: string,
 *   defaultOpen?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export default function StatsExpandableSection({
  title,
  hint,
  hintLabel,
  defaultOpen = true,
  children,
}) {
  const headingId = `stats-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <InfoTooltipProvider>
      <DashboardJobShell
        as="details"
        tone="none"
        pad="row"
        className="group"
        open={open}
        onToggle={(event) => {
          setOpen(event.currentTarget.open);
        }}
      >
        <summary className="flex list-none cursor-pointer items-center gap-2 text-left [&::-webkit-details-marker]:hidden">
          <h2 id={headingId} className={DASHBOARD_CARD_TITLE}>
            {title}
          </h2>
          {hint ? (
            <InfoTooltip label={hintLabel || title} definition={hint} />
          ) : null}
          <ChevronDown
            className={`${DASHBOARD_CARD_CHEVRON} ml-auto group-open:rotate-180`}
            aria-hidden
          />
        </summary>
        <div className="mt-3" role="region" aria-labelledby={headingId}>
          {children}
        </div>
      </DashboardJobShell>
    </InfoTooltipProvider>
  );
}

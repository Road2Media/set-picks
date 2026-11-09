import React from 'react';

import ChromeSegmentedControl from '../../../shared/ui/ChromeSegmentedControl';
import InfoTooltip, {
  InfoTooltipProvider,
} from '../../../shared/ui/InfoTooltip';

/** Fixed trailing column so trays with/without hints share one width. */
const HINT_SLOT_CLASS =
  'flex h-5 w-5 shrink-0 items-center justify-center';

/**
 * In-page All-time / This tour (or inner card) tray — quaternary filter under
 * Stats tertiary. Hint uses a reserved trailing column (empty when absent)
 * so InfoTooltip never changes equal-width segment geometry across stacked
 * trays. Does not scroll the dashboard chrome — that stays on tertiary nav only.
 *
 * @param {{
 *   ariaLabel: string,
 *   value: string,
 *   onChange: (id: string) => void,
 *   items: Array<{ id: string, label: string }>,
 *   hint?: string,
 *   hintLabel?: string,
 *   layout?: 'equal' | 'wrap',
 * }} props
 */
export default function StatsScopeToggle({
  ariaLabel,
  value,
  onChange,
  items,
  hint,
  hintLabel,
  layout = 'equal',
}) {
  const hasHint = typeof hint === 'string' && hint.trim().length > 0;

  return (
    <InfoTooltipProvider>
      <div className="flex w-full min-w-0 items-center gap-2">
        <ChromeSegmentedControl
          ariaLabel={ariaLabel}
          value={value}
          onChange={onChange}
          items={items}
          scrollToTop={false}
          tone="inset"
          layout={layout}
          className="min-w-0 flex-1"
        />
        <div className={HINT_SLOT_CLASS} aria-hidden={!hasHint}>
          {hasHint ? (
            <InfoTooltip label={hintLabel || ariaLabel} definition={hint} />
          ) : null}
        </div>
      </div>
    </InfoTooltipProvider>
  );
}

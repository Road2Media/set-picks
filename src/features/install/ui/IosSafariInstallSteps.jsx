import React from 'react';

import { IOS_CHROME_INSTALL_STEPS, IOS_SAFARI_INSTALL_STEPS } from '../model/installCopy';

/**
 * Shared ordered iOS A2HS steps (#539).
 *
 * @param {{
 *   className?: string,
 *   compact?: boolean,
 *   variant?: 'safari' | 'chrome',
 * }} props
 */
export default function IosSafariInstallSteps({
  className = '',
  compact = false,
  variant = 'safari',
}) {
  const steps = variant === 'chrome' ? IOS_CHROME_INSTALL_STEPS : IOS_SAFARI_INSTALL_STEPS;
  const listClass = compact
    ? 'space-y-1.5 rounded-xl border border-border-muted/60 bg-surface-inset/72 p-3 text-xs text-content-secondary'
    : 'space-y-2 rounded-2xl border border-border-muted/60 bg-surface-inset/72 p-4 text-sm text-content-secondary';

  return (
    <ol className={`${listClass} ${className}`.trim()}>
      {steps.map((step) => (
        <li key={`${variant}-${step.id}`}>
          {step.prefix}
          {step.parts.map((part, i) =>
            part.bold ? (
              <span key={`${step.id}-${i}`} className="font-bold text-white">
                {part.text}
              </span>
            ) : (
              <span key={`${step.id}-${i}`}>{part.text}</span>
            ),
          )}
        </li>
      ))}
    </ol>
  );
}

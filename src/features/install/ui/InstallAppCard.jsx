import React, { useMemo } from 'react';
import { Download, Share2 } from 'lucide-react';

import { Panel } from '../../../shared/ui/Card';
import { getInstallLeadCopy, resolveInstallCopyBranch } from '../model/installCopy';
import { useInstallPrompt } from '../model/useInstallPrompt';
import IosInstallScreenshotGallery from './IosInstallScreenshotGallery.jsx';
import IosSafariInstallSteps from './IosSafariInstallSteps.jsx';

export default function InstallAppCard() {
  const {
    canPrompt,
    isInstalled,
    showIosGuide,
    promptInstall,
    dismissIos,
    openIosGuide,
    closeIosGuide,
    shouldShowIosFlow,
    shouldShowIosNonSafariFlow,
  } = useInstallPrompt();

  const branch = useMemo(
    () =>
      resolveInstallCopyBranch({
        canPrompt,
        shouldShowIosFlow,
        shouldShowIosNonSafariFlow,
      }),
    [canPrompt, shouldShowIosFlow, shouldShowIosNonSafariFlow],
  );
  const lead = getInstallLeadCopy(branch);

  if (isInstalled) return null;

  return (
    <Panel as="section" className="mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-content-secondary">
        {lead.eyebrow}
      </h3>

      {canPrompt || shouldShowIosFlow || shouldShowIosNonSafariFlow ? (
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">{lead.body}</p>
      ) : null}

      {canPrompt ? (
        <button
          type="button"
          onClick={promptInstall}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-primary/45 bg-brand-primary/10 py-3.5 text-sm font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {lead.ctaLabel || 'Add to Home Screen'}
        </button>
      ) : null}

      {shouldShowIosFlow ? (
        <>
          <button
            type="button"
            onClick={showIosGuide ? closeIosGuide : openIosGuide}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-subtle bg-surface-field py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:border-brand-primary/50 hover:bg-surface-panel"
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            {showIosGuide ? 'Hide Safari steps' : 'Show Safari steps'}
          </button>

          {showIosGuide ? (
            <div className="mt-4 space-y-3">
              <IosSafariInstallSteps variant="safari" />
              <IosInstallScreenshotGallery />
            </div>
          ) : null}

          <button
            type="button"
            onClick={dismissIos}
            className="mt-3 text-xs font-black uppercase tracking-widest text-content-secondary underline decoration-border-muted underline-offset-4 transition-colors hover:text-white"
          >
            Don&apos;t show this again
          </button>
        </>
      ) : null}

      {shouldShowIosNonSafariFlow ? (
        <>
          <button
            type="button"
            onClick={showIosGuide ? closeIosGuide : openIosGuide}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-subtle bg-surface-field py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:border-brand-primary/50 hover:bg-surface-panel"
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            {showIosGuide ? 'Hide Chrome steps' : 'Show Chrome steps'}
          </button>

          {showIosGuide ? (
            <div className="mt-4 space-y-3">
              <IosSafariInstallSteps variant="chrome" />
            </div>
          ) : null}

          <button
            type="button"
            onClick={dismissIos}
            className="mt-3 text-xs font-black uppercase tracking-widest text-content-secondary underline decoration-border-muted underline-offset-4 transition-colors hover:text-white"
          >
            Don&apos;t show this again
          </button>
        </>
      ) : null}

      {!canPrompt && !shouldShowIosFlow && !shouldShowIosNonSafariFlow ? (
        <p className="mt-4 rounded-2xl border border-border-muted bg-surface-inset p-4 text-sm leading-relaxed text-content-secondary">
          {lead.body}
        </p>
      ) : null}
    </Panel>
  );
}

import React from 'react';

import SplashAuthPanel from './SplashAuthPanel';

export default function SplashAuthModalShell({
  isOpen,
  onClose,
  title,
  handleGoogle,
  busy,
  /** When set, overrides default Google disabled state (`busy` only). */
  googleDisabled,
  /** Pending / preparing label override (e.g. “Opening Google…”). */
  googleLabel,
  /** Rendered after the title row and before “Continue with Google” (e.g. sign-up legal consent). */
  prependContent,
  googleFootnote,
  children,
  /**
   * When false, clicking the dimmed backdrop does not close the dialog.
   * OAuth popups can leave a stray click that would otherwise dismiss the
   * modal before the user reads post-Google error copy (sign-in modal).
   */
  closeOnBackdropClick = true,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-brand-bg-deep/85 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (!closeOnBackdropClick) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <SplashAuthPanel
          title={title}
          onClose={onClose}
          showClose
          handleGoogle={handleGoogle}
          busy={busy}
          googleDisabled={googleDisabled}
          googleLabel={googleLabel}
          prependContent={prependContent}
          googleFootnote={googleFootnote}
        >
          {children}
        </SplashAuthPanel>
      </div>
    </div>
  );
}

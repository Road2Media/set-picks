import React from 'react';

import LegalPageLayout from './LegalPageLayout';
import LegalMarkdownRenderer from './LegalMarkdownRenderer';
import termsMd from '../../../../docs/TERMS_OF_SERVICE.md?raw';

export default function TermsOfServiceContent({ resumeKind = null }) {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="November 10, 2026"
      resumeKind={resumeKind}
    >
      <LegalMarkdownRenderer content={termsMd} />
    </LegalPageLayout>
  );
}

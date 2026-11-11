import React from 'react';

import LegalPageLayout from './LegalPageLayout';
import LegalMarkdownRenderer from './LegalMarkdownRenderer';
import termsMd from '../../../../docs/TERMS_OF_SERVICE.md?raw';

export default function TermsOfServiceContent({ resumeKind = null }) {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="September 22, 2026"
      resumeKind={resumeKind}
    >
      <LegalMarkdownRenderer content={termsMd} />
    </LegalPageLayout>
  );
}

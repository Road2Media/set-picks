import React from 'react';

import LegalPageLayout from './LegalPageLayout';
import LegalMarkdownRenderer from './LegalMarkdownRenderer';
import privacyMd from '../../../../docs/PRIVACY_POLICY.md?raw';

export default function PrivacyPolicyContent({ resumeKind = null }) {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="November 9, 2026"
      resumeKind={resumeKind}
    >
      <LegalMarkdownRenderer content={privacyMd} />
    </LegalPageLayout>
  );
}

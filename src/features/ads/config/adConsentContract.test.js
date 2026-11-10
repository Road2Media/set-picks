import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildLegalBootDocumentHtml } from '../../../../scripts/legal-boot-shell.mjs';
import { AD_PREFERENCES_HREF } from '../adPreferencesPath';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('ads consent contract', () => {
  const consent = read('src/features/ads/model/adConsent.js');
  const bootstrap = read('src/features/ads/ui/AdConsentBootstrap.jsx');
  const hook = read('src/features/ads/model/useAdConsent.js');
  const shell = read('src/app/layout/RootAppShell.jsx');
  const account = read('src/features/account/ui/AccountPreferencesScreen.jsx');
  const legalLayout = read('src/features/legal/ui/LegalPageLayout.jsx');
  const legalBoot = read('scripts/legal-boot-shell.mjs');
  const privacy = read('docs/PRIVACY_POLICY.md');
  const terms = read('docs/TERMS_OF_SERVICE.md');
  const runbook = read('docs/ADS_CONSENT_RUNBOOK.md');
  const spike = read('docs/ADS_CSP_SPIKE.md');
  const adsTxt = read('public/ads.txt');
  const ga4 = read('src/shared/lib/ga4.js');
  const vercel = read('vercel.json');

  it('keeps the shell mount off the auth, Firestore, and GA4 paths', () => {
    expect(shell).toContain('AdConsentBootstrap');
    expect(shell).not.toContain('initGa4');
    expect(shell).not.toContain('bootAnalytics');
    for (const source of [consent, bootstrap, hook]) {
      expect(source).not.toContain('firebase');
      expect(source).not.toContain('ga4');
      expect(source).not.toContain('react-ga4');
    }
    expect(ga4).not.toContain('adConsent');
    expect(ga4).not.toContain('useAdConsent');
    expect(bootstrap).toContain('mountCmpScript');
    expect(bootstrap).not.toContain('loadFirebaseRemoteConfig');
  });

  it('links Ad preferences from account, the legal pages, and the legal door', () => {
    expect(account).toContain('AdPreferencesSection');
    expect(account).toContain('AD_PREFERENCES_HREF');
    expect(legalLayout).toContain('AD_PREFERENCES_HREF');
    expect(AD_PREFERENCES_HREF).toBe('/dashboard/profile/account#ad-preferences');
    expect(legalBoot).toContain('AD_PREFERENCES_HREF');
    expect(privacy).toContain(AD_PREFERENCES_HREF);
    expect(privacy).toContain('**Last updated:** November 10, 2026');
    expect(terms).toContain('**Last updated:** November 10, 2026');
    expect(read('src/features/legal/ui/PrivacyPolicyContent.jsx')).toContain('November 10, 2026');
    expect(read('src/features/legal/ui/TermsOfServiceContent.jsx')).toContain('November 10, 2026');

    const privacyHtml = buildLegalBootDocumentHtml('/privacy', { rootDir: root });
    const termsHtml = buildLegalBootDocumentHtml('/terms', { rootDir: root });
    expect(privacyHtml).toContain(`href="${AD_PREFERENCES_HREF}"`);
    expect(privacyHtml).toContain('We do not load a third-party advertising script.');
    expect(privacyHtml).not.toContain('we may collect or allow third-party ad networks');
    expect(termsHtml).toContain('None are on the site today.');
    expect(termsHtml).toContain(`href="${AD_PREFERENCES_HREF}"`);
  });

  it('does not claim a live ad network in the legal copy', () => {
    expect(privacy).not.toMatch(/we may collect or allow third-party ad networks/i);
    expect(privacy).not.toMatch(/Deliver, measure, and optimize third-party advertisements/);
    expect(privacy).not.toMatch(/In the future, third-party advertising partners/);
    expect(privacy).toMatch(/do not load a third-party advertising script/i);
    expect(privacy).toMatch(/Advertising partners:\*\* None/);
    expect(privacy).toMatch(/IDFA/);
    expect(privacy).toMatch(/GAID/);
    expect(privacy).toMatch(/are not collected/);
    expect(terms).toMatch(/None are on the site today/);
    expect(terms).not.toMatch(/you agree to the display of such advertisements and promotional content/);
  });

  it('publishes ads.txt with no seller records and no app-ads.txt', () => {
    const records = adsTxt
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    expect(records).toEqual([]);
    expect(adsTxt).not.toMatch(/pub-\d/);
    expect(adsTxt).toMatch(/No seller is authorized/);
    expect(existsSync(join(root, 'public/app-ads.txt'))).toBe(false);
    expect(runbook).toMatch(/app-ads\.txt/);
    expect(runbook).toMatch(/f08c47fec0942fa0/);
    expect(runbook).toMatch(/Patrick/);
  });

  it('documents the CSP edit and leaves vercel.json alone', () => {
    expect(spike).toMatch(/vercel\.json/);
    expect(spike).toMatch(/do not/i);
    expect(spike).toMatch(/unsafe-eval/);
    expect(spike).toMatch(/securepubads\.g\.doubleclick\.net/);
    expect(spike).toMatch(/fundingchoicesmessages\.google\.com/);
    expect(spike).toMatch(/media\.ethicalads\.io/);
    expect(spike).toMatch(/Content-Security-Policy-Report-Only/);
    expect(vercel).not.toContain('fundingchoicesmessages.google.com');
    expect(vercel).not.toContain('securepubads.g.doubleclick.net');
    expect(vercel).not.toContain('pagead2.googlesyndication.com');
    expect(vercel).not.toContain('media.ethicalads.io');
    expect(runbook).toMatch(/VITE_CMP_PROVIDER/);
    expect(runbook).toMatch(/google-funding-choices/);
    expect(runbook).toMatch(/setlist\.fm/);
    expect(runbook).toMatch(/Google Analytics 4/);
  });
});

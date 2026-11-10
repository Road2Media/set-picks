import { useEffect } from 'react';

import { mountCmpScript, readCmpConfig } from '../model/adConsent';

/**
 * App-shell mount for the consent script (#421).
 *
 * The effect runs after paint. The default config is off, and
 * `mountCmpScript` returns before it touches the document. This file
 * does not import Auth, Firestore, Remote Config, or GA4.
 */
export default function AdConsentBootstrap() {
  useEffect(() => {
    mountCmpScript(document, readCmpConfig());
  }, []);
  return null;
}

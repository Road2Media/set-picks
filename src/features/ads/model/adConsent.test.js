import { describe, expect, it } from 'vitest';

import {
  AD_CONSENT_STORAGE_KEY,
  CMP_PROVIDER_FUNDING_CHOICES,
  CMP_SCRIPT_ELEMENT_ID,
  buildCmpScriptSrc,
  canLoadThirdPartyAdScript,
  canOpenCmpUi,
  mountCmpScript,
  openCmpPreferences,
  parseStoredAdChoice,
  readCmpConfig,
  readStoredAdChoice,
  resolveAdConsent,
  serializeAdChoice,
  tcfAllowsAdvertising,
  writeStoredAdChoice,
} from './adConsent';

const PUB = 'pub-1234567890123456';

function memoryStorage(initial = null) {
  const data = new Map();
  if (initial != null) data.set(AD_CONSENT_STORAGE_KEY, initial);
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    dump: data,
  };
}

function fakeDocument() {
  const byId = new Map();
  const head = {
    children: [],
    appendChild(el) {
      this.children.push(el);
      if (el.id) byId.set(el.id, el);
      return el;
    },
  };
  return {
    head,
    getElementById(id) {
      return byId.get(id) ?? null;
    },
    createElement(tag) {
      return { tag, id: '', async: false, src: '' };
    },
  };
}

describe('readCmpConfig', () => {
  it('ships off when the env is unset', () => {
    expect(readCmpConfig().enabled).toBe(false);
    expect(readCmpConfig({}).enabled).toBe(false);
    expect(readCmpConfig(undefined).enabled).toBe(false);
  });

  it('stays off unless both values match Funding Choices', () => {
    expect(readCmpConfig({ VITE_CMP_PROVIDER: CMP_PROVIDER_FUNDING_CHOICES }).enabled).toBe(false);
    expect(readCmpConfig({ VITE_CMP_SITE_ID: PUB }).enabled).toBe(false);
    expect(
      readCmpConfig({ VITE_CMP_PROVIDER: 'cookiebot', VITE_CMP_SITE_ID: PUB }).enabled,
    ).toBe(false);
    expect(
      readCmpConfig({
        VITE_CMP_PROVIDER: 'Google-Funding-Choices',
        VITE_CMP_SITE_ID: PUB,
      }).enabled,
    ).toBe(false);
    expect(
      readCmpConfig({
        VITE_CMP_PROVIDER: CMP_PROVIDER_FUNDING_CHOICES,
        VITE_CMP_SITE_ID: 'https://fundingchoicesmessages.google.com/i/pub-1',
      }).enabled,
    ).toBe(false);
  });

  it('accepts an AdSense id or a numeric network code', () => {
    expect(
      readCmpConfig({
        VITE_CMP_PROVIDER: CMP_PROVIDER_FUNDING_CHOICES,
        VITE_CMP_SITE_ID: PUB,
      }),
    ).toEqual({ provider: CMP_PROVIDER_FUNDING_CHOICES, siteId: PUB, enabled: true });
    expect(
      readCmpConfig({
        VITE_CMP_PROVIDER: CMP_PROVIDER_FUNDING_CHOICES,
        VITE_CMP_SITE_ID: '21715635079',
      }).enabled,
    ).toBe(true);
  });
});

describe('stored choice', () => {
  it('treats a missing or foreign record as unknown', () => {
    expect(parseStoredAdChoice(null)).toBe('unknown');
    expect(parseStoredAdChoice('')).toBe('unknown');
    expect(parseStoredAdChoice('granted')).toBe('unknown');
    expect(parseStoredAdChoice('{"v":2,"advertising":"granted"}')).toBe('unknown');
    expect(parseStoredAdChoice('{')).toBe('unknown');
  });

  it('round-trips granted and denied', () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    const raw = serializeAdChoice('granted', now);
    expect(JSON.parse(raw)).toEqual({
      v: 1,
      advertising: 'granted',
      updatedAt: '2026-11-10T12:00:00.000Z',
    });
    expect(parseStoredAdChoice(raw)).toBe('granted');
    expect(parseStoredAdChoice(serializeAdChoice('denied', now))).toBe('denied');
  });

  it('reads and writes through a storage object', () => {
    const storage = memoryStorage();
    expect(readStoredAdChoice(storage)).toBe('unknown');
    expect(writeStoredAdChoice(storage, 'denied', new Date('2026-11-10T00:00:00.000Z')).ok).toBe(true);
    expect(readStoredAdChoice(storage)).toBe('denied');
    expect(writeStoredAdChoice(storage, 'later').reason).toBe('invalid-choice');
    expect(writeStoredAdChoice(null, 'granted').reason).toBe('no-storage');
  });
});

describe('tcfAllowsAdvertising', () => {
  const allow = {
    eventStatus: 'tcloaded',
    gdprApplies: true,
    purpose: { consents: { 1: true, 2: true, 3: false, 4: false } },
  };

  it('requires a loaded decision, purpose 1, and an advertising purpose', () => {
    expect(tcfAllowsAdvertising(allow)).toBe(true);
    expect(tcfAllowsAdvertising({ ...allow, eventStatus: 'useractioncomplete' })).toBe(true);
    expect(tcfAllowsAdvertising({ ...allow, purpose: { consents: { 1: true, 4: true } } })).toBe(true);
  });

  it('does not treat a missing region or an open banner as a grant', () => {
    expect(tcfAllowsAdvertising({ ...allow, gdprApplies: false, purpose: { consents: {} } })).toBe(false);
    expect(tcfAllowsAdvertising({ eventStatus: 'tcloaded', gdprApplies: false })).toBe(false);
    expect(tcfAllowsAdvertising({ ...allow, eventStatus: 'cmpuishown' })).toBe(false);
    expect(tcfAllowsAdvertising({ ...allow, purpose: { consents: { 1: true } } })).toBe(false);
    expect(tcfAllowsAdvertising({ ...allow, purpose: { consents: { 1: 'true', 2: true } } })).toBe(false);
    expect(tcfAllowsAdvertising(null)).toBe(false);
  });
});

describe('resolveAdConsent', () => {
  it('blocks every script while the CMP is off, including a saved allow', () => {
    const consent = resolveAdConsent({
      cmpEnabled: false,
      storedChoice: 'granted',
      tcfAllows: true,
    });
    expect(consent.advertisingAllowed).toBe(false);
    expect(consent.source).toBe('first-party');
    expect(canLoadThirdPartyAdScript(consent)).toBe(false);
  });

  it('lets a player denial beat a partner allow', () => {
    const consent = resolveAdConsent({
      cmpEnabled: true,
      storedChoice: 'denied',
      tcfAllows: true,
    });
    expect(consent.advertisingAllowed).toBe(false);
    expect(canLoadThirdPartyAdScript(consent)).toBe(false);
  });

  it('allows a script only when the partner and the player both leave it open', () => {
    for (const storedChoice of ['unknown', 'granted']) {
      const consent = resolveAdConsent({
        cmpEnabled: true,
        storedChoice,
        tcfAllows: true,
      });
      expect(consent.advertisingAllowed).toBe(true);
      expect(canLoadThirdPartyAdScript(consent)).toBe(true);
    }
    expect(
      canLoadThirdPartyAdScript(
        resolveAdConsent({ cmpEnabled: true, storedChoice: 'granted', tcfAllows: false }),
      ),
    ).toBe(false);
  });

  it('ignores a hand-built allow that did not come from the CMP', () => {
    expect(canLoadThirdPartyAdScript({ advertisingAllowed: true, cmpEnabled: false })).toBe(false);
    expect(canLoadThirdPartyAdScript(null)).toBe(false);
  });
});

describe('mountCmpScript', () => {
  it('does not touch the document when the config is off', () => {
    const doc = fakeDocument();
    doc.createElement = () => {
      throw new Error('should not create a tag');
    };
    expect(mountCmpScript(doc, readCmpConfig({}))).toEqual({
      mounted: false,
      reason: 'cmp-off',
      src: '',
    });
    expect(doc.head.children).toEqual([]);
  });

  it('appends one async Funding Choices tag for a valid id', () => {
    const doc = fakeDocument();
    const config = readCmpConfig({
      VITE_CMP_PROVIDER: CMP_PROVIDER_FUNDING_CHOICES,
      VITE_CMP_SITE_ID: PUB,
    });
    const first = mountCmpScript(doc, config);
    expect(first).toEqual({
      mounted: true,
      reason: 'mounted',
      src: `https://fundingchoicesmessages.google.com/i/${PUB}?ers=1`,
    });
    expect(doc.head.children).toEqual([
      {
        tag: 'script',
        id: CMP_SCRIPT_ELEMENT_ID,
        async: true,
        src: first.src,
      },
    ]);
    expect(mountCmpScript(doc, config).reason).toBe('already-mounted');
    expect(doc.head.children).toHaveLength(1);
    expect(buildCmpScriptSrc({ enabled: true, provider: 'cookiebot', siteId: PUB })).toBe('');
  });
});

describe('openCmpPreferences', () => {
  it('stays closed until the partner function exists', () => {
    expect(canOpenCmpUi({})).toBe(false);
    expect(openCmpPreferences(undefined)).toEqual({ opened: false, reason: 'cmp-off' });
    let calls = 0;
    const globalObj = { googlefc: { showRevocationMessage: () => { calls += 1; } } };
    expect(openCmpPreferences(globalObj)).toEqual({ opened: true, reason: 'opened' });
    expect(calls).toBe(1);
  });
});

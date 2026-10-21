import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildLoginBootShellMarkup } from '../../../../scripts/login-boot-shell.mjs';
import {
  blurAutofocusedCredentialField,
  ensureNeutralLoginFocusGuards,
  isCredentialAutofillTarget,
  scheduleNeutralLoginFocus,
} from './deferPasswordManagerAutofill';

describe('isCredentialAutofillTarget', () => {
  it('matches email/password inputs', () => {
    expect(
      isCredentialAutofillTarget({
        tagName: 'INPUT',
        getAttribute: () => 'email',
        id: 'si-email',
      }),
    ).toBe(true);
    expect(
      isCredentialAutofillTarget({
        tagName: 'INPUT',
        getAttribute: () => 'password',
        id: 'si-pass',
      }),
    ).toBe(true);
  });

  it('rejects buttons, checkboxes, and null', () => {
    expect(
      isCredentialAutofillTarget({
        tagName: 'BUTTON',
        getAttribute: () => null,
        id: '',
      }),
    ).toBe(false);
    expect(
      isCredentialAutofillTarget({
        tagName: 'INPUT',
        getAttribute: () => 'checkbox',
        id: 'legal',
      }),
    ).toBe(false);
    expect(isCredentialAutofillTarget(null)).toBe(false);
  });
});

describe('blurAutofocusedCredentialField', () => {
  it('is a no-op when document is unavailable (node vitest)', () => {
    expect(() => blurAutofocusedCredentialField()).not.toThrow();
  });

  it('blurs credential focus and parks on focus park', () => {
    const blur = vi.fn();
    const parkFocus = vi.fn();
    const prev = globalThis.document;
    globalThis.document = {
      activeElement: {
        tagName: 'INPUT',
        id: 'si-email',
        getAttribute: () => 'email',
        blur,
      },
      getElementById: (id) =>
        id === 'login-focus-park'
          ? { focus: parkFocus }
          : null,
    };
    try {
      expect(blurAutofocusedCredentialField()).toBe(true);
      expect(blur).toHaveBeenCalled();
      expect(parkFocus).toHaveBeenCalledWith({ preventScroll: true });
    } finally {
      if (prev === undefined) delete globalThis.document;
      else globalThis.document = prev;
    }
  });

  it('does not blur after a user gesture (#1050)', () => {
    const blur = vi.fn();
    const prev = globalThis.document;
    globalThis.document = {
      documentElement: { dataset: { loginFocusGestured: '1' } },
      activeElement: {
        tagName: 'INPUT',
        id: 'si-email',
        getAttribute: () => 'email',
        blur,
      },
      getElementById: () => null,
    };
    try {
      expect(blurAutofocusedCredentialField()).toBe(false);
      expect(blur).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete globalThis.document;
      else globalThis.document = prev;
    }
  });
});

function makeCredentialDom() {
  const listeners = [];
  const elements = new Map();
  const root = { dataset: {} };
  const email = {
    tagName: 'INPUT',
    id: 'si-email',
    readOnly: true,
    dataset: {},
    getAttribute(name) {
      if (name === 'type') return 'email';
      return null;
    },
    removeAttribute(name) {
      if (name === 'readonly') this.readOnly = false;
    },
    blur: vi.fn(),
    focus: vi.fn(),
  };
  const label = {
    tagName: 'LABEL',
    getAttribute(name) {
      if (name === 'for') return 'si-email';
      return null;
    },
  };
  const park = {
    tagName: 'BUTTON',
    id: 'login-focus-park',
    focus: vi.fn(),
  };
  elements.set('si-email', email);
  elements.set('login-focus-park', park);
  elements.set('lbs-signin', { tagName: 'SECTION', id: 'lbs-signin' });
  elements.set('lbs-signup', { tagName: 'SECTION', id: 'lbs-signup' });
  const doc = {
    documentElement: root,
    activeElement: null,
    getElementById: (id) => elements.get(id) || null,
    addEventListener(type, fn) {
      listeners.push({ type, fn });
    },
    dispatch(type, target) {
      const event = { target };
      for (const listener of listeners) {
        if (listener.type === type) listener.fn(event);
      }
    },
  };
  return { doc, email, label, park };
}

describe('ensureNeutralLoginFocusGuards', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  });

  it('parks pre-gesture autofocus and keeps a first tap (#1050)', () => {
    const { doc, email, label, park } = makeCredentialDom();
    globalThis.document = doc;
    ensureNeutralLoginFocusGuards();

    doc.activeElement = email;
    doc.dispatch('focusin', email);
    expect(email.blur).toHaveBeenCalledTimes(1);
    expect(park.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(email.readOnly).toBe(true);

    email.blur.mockClear();
    park.focus.mockClear();
    doc.dispatch('pointerdown', email);
    expect(email.readOnly).toBe(false);
    expect(doc.documentElement.dataset.loginFocusGestured).toBe('1');

    doc.activeElement = email;
    doc.dispatch('focusin', email);
    expect(email.blur).not.toHaveBeenCalled();
    expect(blurAutofocusedCredentialField()).toBe(false);

    const { doc: labelDoc, email: labelEmail, label: emailLabel } = makeCredentialDom();
    globalThis.document = labelDoc;
    ensureNeutralLoginFocusGuards();
    labelDoc.dispatch('touchstart', emailLabel);
    expect(labelEmail.readOnly).toBe(false);
    expect(label).toBeTruthy();
  });

  it('keeps the autofocus killer armed after a non-field tap', () => {
    const { doc, email, park } = makeCredentialDom();
    globalThis.document = doc;
    ensureNeutralLoginFocusGuards();
    doc.dispatch('pointerdown', park);
    expect(doc.documentElement.dataset.loginFocusGestured).toBeUndefined();
    doc.activeElement = email;
    doc.dispatch('focusin', email);
    expect(email.blur).toHaveBeenCalledTimes(1);
    expect(park.focus).toHaveBeenCalled();
  });
});

describe('scheduleNeutralLoginFocus', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  });

  it('blurs autofocus before a gesture and stops once the user taps (#1050)', () => {
    vi.useFakeTimers();
    const schedule = globalThis.setTimeout.bind(globalThis);
    const cancel = globalThis.clearTimeout.bind(globalThis);
    const { doc, email, park } = makeCredentialDom();
    doc.activeElement = email;
    globalThis.document = doc;
    globalThis.window = {
      location: { search: '' },
      setTimeout: (fn, ms) => schedule(fn, ms),
      clearTimeout: (id) => cancel(id),
      requestAnimationFrame: (fn) => schedule(fn, 0),
      cancelAnimationFrame: (id) => cancel(id),
    };

    const stop = scheduleNeutralLoginFocus();
    expect(email.blur).toHaveBeenCalled();
    expect(park.focus).toHaveBeenCalled();

    doc.dispatch = undefined;
    email.blur.mockClear();
    doc.documentElement.dataset.loginFocusGestured = '1';
    vi.advanceTimersByTime(400);
    expect(email.blur).not.toHaveBeenCalled();
    stop();
  });
});

function bootFocusScript() {
  const html = buildLoginBootShellMarkup();
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*$/);
  if (!match) throw new Error('login boot shell is missing its focus script');
  return match[1];
}

describe('login boot shell focus guard', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  });

  it('does not blur a first tap inside the neutralize window (#1050)', () => {
    vi.useFakeTimers();
    const schedule = globalThis.setTimeout.bind(globalThis);
    const cancel = globalThis.clearTimeout.bind(globalThis);
    const { doc, email, label } = makeCredentialDom();
    globalThis.document = doc;
    globalThis.requestAnimationFrame = (fn) => schedule(fn, 0);
    globalThis.window = {
      location: { search: '' },
      requestAnimationFrame: globalThis.requestAnimationFrame,
      setTimeout: (fn, ms) => schedule(fn, ms),
      clearTimeout: (id) => cancel(id),
    };

    // Indirect eval so the bare `requestAnimationFrame` call hits the global.
    (0, eval)(bootFocusScript());
    expect(doc.documentElement.dataset.loginFocusGuard).toBe('1');

    doc.dispatch('pointerdown', label);
    expect(email.readOnly).toBe(false);
    expect(doc.documentElement.dataset.loginFocusGestured).toBe('1');

    doc.activeElement = email;
    vi.advanceTimersByTime(400);
    expect(email.blur).not.toHaveBeenCalled();
  });

  it('still parks cold autofocus before any gesture (#909)', () => {
    vi.useFakeTimers();
    const schedule = globalThis.setTimeout.bind(globalThis);
    const cancel = globalThis.clearTimeout.bind(globalThis);
    const { doc, email, park } = makeCredentialDom();
    doc.activeElement = email;
    globalThis.document = doc;
    globalThis.requestAnimationFrame = (fn) => schedule(fn, 0);
    globalThis.window = {
      location: { search: '' },
      requestAnimationFrame: globalThis.requestAnimationFrame,
      setTimeout: (fn, ms) => schedule(fn, ms),
      clearTimeout: (id) => cancel(id),
    };

    (0, eval)(bootFocusScript());
    expect(email.blur).toHaveBeenCalled();
    expect(park.focus).toHaveBeenCalled();
    expect(email.readOnly).toBe(true);
    vi.advanceTimersByTime(400);
    expect(email.blur.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not disarm autofocus protection when the tap misses the field', () => {
    vi.useFakeTimers();
    const schedule = globalThis.setTimeout.bind(globalThis);
    const cancel = globalThis.clearTimeout.bind(globalThis);
    const { doc, email, park } = makeCredentialDom();
    globalThis.document = doc;
    globalThis.requestAnimationFrame = (fn) => schedule(fn, 0);
    globalThis.window = {
      location: { search: '' },
      requestAnimationFrame: globalThis.requestAnimationFrame,
      setTimeout: (fn, ms) => schedule(fn, ms),
      clearTimeout: (id) => cancel(id),
    };

    (0, eval)(bootFocusScript());
    doc.dispatch('pointerdown', park);
    expect(doc.documentElement.dataset.loginFocusGestured).toBeUndefined();
    doc.activeElement = email;
    email.blur.mockClear();
    vi.advanceTimersByTime(400);
    expect(email.blur).toHaveBeenCalled();
    expect(email.readOnly).toBe(true);
  });
});

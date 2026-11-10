import { describe, expect, it, vi } from 'vitest';

import { readProgrammaticAdsConfig } from '../model/programmaticAdsConfig';
import {
  ETHICALADS_SCRIPT_ELEMENT_ID,
  ETHICALADS_SCRIPT_SRC,
  bindEthicalAdsScript,
  mountEthicalAds,
  requestEthicalAdsPlacement,
  watchEthicalAdsFill,
} from './ethicalAdsProvider';

function fakeDocument() {
  const byId = new Map();
  const created = [];
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
    created,
    getElementById(id) {
      return byId.get(id) ?? null;
    },
    createElement(tag) {
      const listeners = new Map();
      const el = {
        tag,
        id: '',
        async: false,
        src: '',
        dataset: {},
        parentNode: head,
        addEventListener(type, fn) {
          listeners.set(type, fn);
        },
        removeEventListener(type, fn) {
          if (listeners.get(type) === fn) listeners.delete(type);
        },
        dispatch(type) {
          listeners.get(type)?.();
        },
        remove() {
          head.children = head.children.filter((child) => child !== el);
          byId.delete(el.id);
        },
      };
      created.push(el);
      return el;
    },
  };
}

const on = {
  enabled: true,
  provider: 'ethicalads',
  publisher: 'setlist-pickem',
};

describe('mountEthicalAds', () => {
  it('does not touch the document when the env is unset', () => {
    const doc = fakeDocument();
    const result = mountEthicalAds(doc, readProgrammaticAdsConfig({}));
    expect(result).toMatchObject({ ok: false, reason: 'off', src: '' });
    expect(doc.created).toEqual([]);
    expect(doc.head.children).toEqual([]);
  });

  it('does not put the publisher slug in the script URL', () => {
    const doc = fakeDocument();
    const result = mountEthicalAds(doc, on);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('mounted');
    expect(result.element.src).toBe(ETHICALADS_SCRIPT_SRC);
    expect(result.element.src).not.toContain('setlist-pickem');
    expect(result.element.id).toBe(ETHICALADS_SCRIPT_ELEMENT_ID);
    expect(result.element.async).toBe(true);
    expect(doc.head.children).toHaveLength(1);

    const second = mountEthicalAds(doc, on);
    expect(second.reason).toBe('already-mounted');
    expect(doc.head.children).toHaveLength(1);

    second.remove();
    expect(doc.head.children).toEqual([]);
  });

  it('ignores a publisher that is not a slug', () => {
    const doc = fakeDocument();
    const result = mountEthicalAds(doc, {
      enabled: true,
      provider: 'ethicalads',
      publisher: 'https://evil.example/gpt.js',
    });
    expect(result.ok).toBe(false);
    expect(doc.created).toEqual([]);
  });
});

describe('ethicalads client handshake', () => {
  it('requests a placement only after the script is ready', () => {
    const doc = fakeDocument();
    const mounted = mountEthicalAds(doc, on);
    const onReady = vi.fn();
    const onError = vi.fn();
    bindEthicalAdsScript(mounted.element, { onReady, onError });
    expect(onReady).not.toHaveBeenCalled();
    mounted.element.dispatch('load');
    expect(onReady).toHaveBeenCalledTimes(1);
    mounted.element.dispatch('error');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('calls load and reports a paid fill', async () => {
    let resolveWait;
    const wait = new Promise((resolve) => {
      resolveWait = resolve;
    });
    const load = vi.fn();
    const requested = requestEthicalAdsPlacement({ ethicalads: { load, wait } });
    expect(requested.ok).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);

    const onFill = vi.fn();
    watchEthicalAdsFill(requested.wait, onFill);
    resolveWait([{ id: 'programmatic_standings_inline' }]);
    await wait;
    expect(onFill).toHaveBeenCalledWith(true);
  });

  it('treats an empty wait and a missing client as no fill', async () => {
    const onFill = vi.fn();
    watchEthicalAdsFill(Promise.resolve([]), onFill);
    await Promise.resolve();
    expect(onFill).toHaveBeenCalledWith(false);
    expect(requestEthicalAdsPlacement({}).ok).toBe(false);
    expect(requestEthicalAdsPlacement(undefined).reason).toBe('not-ready');
  });
});

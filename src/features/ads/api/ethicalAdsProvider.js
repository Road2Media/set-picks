import {
  isValidEthicalAdsPublisher,
  PROGRAMMATIC_PROVIDER_ETHICALADS,
} from '../model/programmaticAdsConfig';

/**
 * EthicalAds client (#422). Import this module only after
 * `resolveProgrammaticPhase` returns `ready`. The default build never
 * imports it, so it never requests this host.
 *
 * The script URL is fixed. The publisher slug is a data attribute on the
 * placement div, not part of the URL.
 */

export const ETHICALADS_SCRIPT_SRC =
  'https://media.ethicalads.io/media/client/ethicalads.min.js';

export const ETHICALADS_SCRIPT_ELEMENT_ID = 'set-picks-ethicalads';

/**
 * @param {{ enabled?: boolean, provider?: string, publisher?: string } | null | undefined} config
 * @returns {boolean}
 */
function configCanMount(config) {
  return Boolean(
    config?.enabled &&
      config.provider === PROGRAMMATIC_PROVIDER_ETHICALADS &&
      isValidEthicalAdsPublisher(config.publisher),
  );
}

/**
 * Append the EthicalAds client once. Returns before it touches the document
 * when the config is off.
 *
 * @param {Document | { head?: { appendChild: Function, children?: unknown[] }, getElementById?: Function, createElement?: Function } | null | undefined} doc
 * @param {{ enabled?: boolean, provider?: string, publisher?: string } | null | undefined} config
 * @returns {{
 *   ok: boolean,
 *   reason: 'off' | 'no-document' | 'already-mounted' | 'mounted',
 *   src: string,
 *   element?: { src?: string, id?: string, async?: boolean, addEventListener?: Function, removeEventListener?: Function, parentNode?: { removeChild: Function }, remove?: Function },
 *   remove: () => void,
 * }}
 */
export function mountEthicalAds(doc, config) {
  if (!configCanMount(config)) {
    return { ok: false, reason: 'off', src: '', remove() {} };
  }
  if (
    !doc ||
    typeof doc.createElement !== 'function' ||
    !doc.head ||
    typeof doc.head.appendChild !== 'function'
  ) {
    return { ok: false, reason: 'no-document', src: ETHICALADS_SCRIPT_SRC, remove() {} };
  }

  const existing =
    typeof doc.getElementById === 'function' ? doc.getElementById(ETHICALADS_SCRIPT_ELEMENT_ID) : null;
  if (existing) {
    return {
      ok: true,
      reason: 'already-mounted',
      src: existing.src || ETHICALADS_SCRIPT_SRC,
      element: existing,
      remove: removeScript(existing),
    };
  }

  const script = doc.createElement('script');
  script.id = ETHICALADS_SCRIPT_ELEMENT_ID;
  script.async = true;
  script.src = ETHICALADS_SCRIPT_SRC;
  doc.head.appendChild(script);
  return {
    ok: true,
    reason: 'mounted',
    src: ETHICALADS_SCRIPT_SRC,
    element: script,
    remove: removeScript(script),
  };
}

/**
 * @param {{ parentNode?: { removeChild: Function }, remove?: Function } | null | undefined} script
 * @returns {() => void}
 */
function removeScript(script) {
  return () => {
    if (!script) return;
    if (typeof script.remove === 'function') {
      script.remove();
      return;
    }
    if (script.parentNode && typeof script.parentNode.removeChild === 'function') {
      script.parentNode.removeChild(script);
    }
  };
}

/**
 * @param {{ addEventListener?: Function, removeEventListener?: Function, readyState?: string, dataset?: { loaded?: string } } | null | undefined} script
 * @param {{ onReady?: () => void, onError?: () => void }} handlers
 * @returns {() => void}
 */
export function bindEthicalAdsScript(script, handlers) {
  if (!script || typeof script.addEventListener !== 'function') return () => {};
  const onReady = () => {
    if (script.dataset) script.dataset.loaded = 'true';
    if (typeof handlers?.onReady === 'function') handlers.onReady();
  };
  const onError = () => {
    if (typeof handlers?.onError === 'function') handlers.onError();
  };
  if (script.dataset?.loaded === 'true' || script.readyState === 'complete') {
    onReady();
    return () => {};
  }
  script.addEventListener('load', onReady);
  script.addEventListener('error', onError);
  return () => {
    if (typeof script.removeEventListener === 'function') {
      script.removeEventListener('load', onReady);
      script.removeEventListener('error', onError);
    }
  };
}

/**
 * Manual placements do not request an ad until `ethicalads.load()`.
 *
 * @param {{ ethicalads?: { load?: Function, wait?: Promise<unknown> } } | null | undefined} globalObj
 * @returns {{ ok: boolean, reason: 'not-ready' | 'requested', wait: Promise<unknown> | null }}
 */
export function requestEthicalAdsPlacement(globalObj) {
  const api = globalObj?.ethicalads;
  if (!api || typeof api.load !== 'function') {
    return { ok: false, reason: 'not-ready', wait: null };
  }
  const wait = api.wait && typeof api.wait.then === 'function' ? api.wait : null;
  api.load();
  return { ok: true, reason: 'requested', wait };
}

/**
 * @param {Promise<unknown> | null | undefined} wait
 * @param {(filled: boolean) => void} onFill
 * @returns {() => void}
 */
export function watchEthicalAdsFill(wait, onFill) {
  if (typeof onFill !== 'function') return () => {};
  if (!wait || typeof wait.then !== 'function') {
    onFill(false);
    return () => {};
  }
  let cancelled = false;
  wait.then(
    (placements) => {
      if (cancelled) return;
      onFill(Array.isArray(placements) && placements.length > 0);
    },
    () => {
      if (!cancelled) onFill(false);
    },
  );
  return () => {
    cancelled = true;
  };
}

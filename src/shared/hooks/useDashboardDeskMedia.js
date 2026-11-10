import { useSyncExternalStore } from 'react';

/**
 * Same query as the Tailwind `desk` screen (`tailwind.config.js`).
 * Phone landscape fails the height half, so it stays mobile chrome (#705).
 */
export const DASHBOARD_DESK_MEDIA_QUERY = '(min-width: 768px) and (min-height: 480px)';

/** Same query as the Tailwind `short` screen. Does not overlap `desk`. */
export const DASHBOARD_SHORT_MEDIA_QUERY = '(max-height: 479.98px)';

const subscribers = new Map();

/**
 * @param {string} query
 * @returns {(onChange: () => void) => () => void}
 */
function subscribeMedia(query) {
  let subscribe = subscribers.get(query);
  if (!subscribe) {
    subscribe = (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    };
    subscribers.set(query, subscribe);
  }
  return subscribe;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
function matchMediaNow(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => matchMediaNow(query),
    () => false,
  );
}

/** True on the `desk` screen (sidebar + sticky stack). */
export function useDashboardDeskMedia() {
  return useMediaQuery(DASHBOARD_DESK_MEDIA_QUERY);
}

/** True on the `short` screen (landscape compaction, brand row hidden). */
export function useDashboardShortMedia() {
  return useMediaQuery(DASHBOARD_SHORT_MEDIA_QUERY);
}

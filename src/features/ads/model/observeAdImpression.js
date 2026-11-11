/** Share of the unit that must be visible. */
export const AD_IMPRESSION_THRESHOLD = 0.5;

/** How long that share must stay visible before one impression. */
export const AD_IMPRESSION_DWELL_MS = 1000;

/**
 * Fire `onImpression` once when `element` stays at least half visible for the
 * dwell. Scrolling away before the dwell cancels it. No-op without
 * IntersectionObserver (tests and very old browsers).
 *
 * @param {Element | null | undefined} element
 * @param {{
 *   onImpression: () => void,
 *   threshold?: number,
 *   dwellMs?: number,
 * }} options
 * @returns {() => void}
 */
export function observeAdImpression(element, options) {
  const onImpression = options?.onImpression;
  const threshold = options?.threshold ?? AD_IMPRESSION_THRESHOLD;
  const dwellMs = options?.dwellMs ?? AD_IMPRESSION_DWELL_MS;

  if (!element || typeof onImpression !== 'function') return () => {};
  if (typeof IntersectionObserver === 'undefined') return () => {};

  let fired = false;
  let timer = null;

  const clearDwell = () => {
    if (timer == null) return;
    clearTimeout(timer);
    timer = null;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (fired) return;
      const visible = entries.some(
        (entry) => entry.isIntersecting && entry.intersectionRatio >= threshold,
      );
      if (!visible) {
        clearDwell();
        return;
      }
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = null;
        if (fired) return;
        fired = true;
        observer.disconnect();
        onImpression();
      }, dwellMs);
    },
    { threshold: [0, threshold, 1] },
  );

  observer.observe(element);

  return () => {
    clearDwell();
    observer.disconnect();
  };
}

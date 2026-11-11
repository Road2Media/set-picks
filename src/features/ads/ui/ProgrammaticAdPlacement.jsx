import React, { useEffect, useRef, useState } from 'react';

import {
  PROGRAMMATIC_CREATIVE_ID,
  PROGRAMMATIC_FILL_WAIT_MS,
} from '../config/programmaticSlots';
import { observeAdImpression } from '../model/observeAdImpression';
import { isValidEthicalAdsPublisher } from '../model/programmaticAdsConfig';
import { trackAdClick, trackAdImpression, trackProgrammaticFill } from '../model/adTelemetry';
import { useProgrammaticAd } from '../model/useProgrammaticAd';

/**
 * One EthicalAds placement (#422). Renders nothing unless the phase is
 * `ready`. The client script is a dynamic import that runs only then, and
 * `data-ea-manual` keeps the ad request behind `ethicalads.load()`.
 *
 * A house creative, a denied consent signal, or either kill switch leaves
 * this null. The house unit above is the fallback. No fill, a script
 * error, or the wait timeout collapses this seam. It does not reserve a gap.
 *
 * @param {{ slotId: string, className?: string }} props
 */
export default function ProgrammaticAdPlacement({ slotId, className = '' }) {
  const { phase, publisher } = useProgrammaticAd(slotId);
  const [collapsed, setCollapsed] = useState(false);
  const placementRef = useRef(null);
  const filledRef = useRef(false);
  const show = phase === 'ready' && isValidEthicalAdsPublisher(publisher) && !collapsed;

  useEffect(() => {
    setCollapsed(false);
    filledRef.current = false;
  }, [phase, publisher]);

  useEffect(() => {
    if (!show) return undefined;
    let cancelled = false;
    let removeScript = () => {};
    let unbind = () => {};
    let stopFill = () => {};
    let stopImpression = () => {};
    let timer = null;

    const collapse = () => {
      if (cancelled || filledRef.current) return;
      setCollapsed(true);
    };

    timer = setTimeout(collapse, PROGRAMMATIC_FILL_WAIT_MS);

    import('../api/ethicalAdsProvider.js')
      .then((mod) => {
        if (cancelled) return;
        const mounted = mod.mountEthicalAds(document, {
          enabled: true,
          provider: 'ethicalads',
          publisher,
        });
        if (!mounted.ok || !mounted.element) {
          collapse();
          return;
        }
        removeScript = mounted.remove;
        unbind = mod.bindEthicalAdsScript(mounted.element, {
          onError: collapse,
          onReady: () => {
            if (cancelled) return;
            const requested = mod.requestEthicalAdsPlacement(window);
            if (!requested.ok) {
              collapse();
              return;
            }
            stopFill = mod.watchEthicalAdsFill(requested.wait, (filled) => {
              if (cancelled || !filled) {
                collapse();
                return;
              }
              filledRef.current = true;
              if (timer != null) {
                clearTimeout(timer);
                timer = null;
              }
              trackProgrammaticFill({ slotId, provider: 'ethicalads' });
              stopImpression = observeAdImpression(placementRef.current, {
                onImpression: () =>
                  trackAdImpression({
                    slotId,
                    creativeId: PROGRAMMATIC_CREATIVE_ID,
                    provider: 'ethicalads',
                  }),
              });
            });
          },
        });
      })
      .catch(() => {
        collapse();
      });

    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
      unbind();
      stopFill();
      stopImpression();
      removeScript();
    };
  }, [show, publisher, slotId]);

  if (!show) return null;

  return (
    <aside
      aria-label="Sponsored content"
      data-sponsor-slot={slotId}
      className={['w-full', className].filter(Boolean).join(' ')}
      onClick={() => {
        if (!filledRef.current) return;
        trackAdClick({
          slotId,
          creativeId: PROGRAMMATIC_CREATIVE_ID,
          destinationType: 'external',
          provider: 'ethicalads',
        });
      }}
    >
      <div
        ref={placementRef}
        id={slotId}
        className="horizontal"
        data-ea-publisher={publisher}
        data-ea-type="image"
        data-ea-manual="true"
        data-ea-campaign-types="paid"
      />
    </aside>
  );
}

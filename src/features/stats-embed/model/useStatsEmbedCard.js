import { useEffect, useState } from 'react';

import {
  fetchEmbedDefaultTourSlug,
  fetchEmbedTourWinners,
} from '../api/fetchEmbedTourWinners';
import { buildEmbedCardModel } from './projectEmbedCard';
import { isEmbedTourSlug } from './embedPaths';

/**
 * @param {URLSearchParams | { get: (key: string) => string | null }} searchParams
 */
export function useStatsEmbedCard(searchParams) {
  const forceBadge = searchParams.get('card') === 'badge';
  const tourParam = searchParams.get('tour');
  const requestedSlug = isEmbedTourSlug(tourParam) ? tourParam : '';
  const [model, setModel] = useState(() =>
    buildEmbedCardModel({ forceBadge: true }),
  );

  useEffect(() => {
    if (forceBadge) {
      setModel(buildEmbedCardModel({ forceBadge: true }));
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const slug =
          requestedSlug || (await fetchEmbedDefaultTourSlug({ signal: ac.signal }));
        if (!slug || cancelled) return;
        const doc = await fetchEmbedTourWinners(slug, { signal: ac.signal });
        if (cancelled) return;
        setModel(buildEmbedCardModel({ doc, forceBadge: false }));
      } catch {
        if (cancelled || ac.signal.aborted) return;
        setModel(buildEmbedCardModel({ forceBadge: true }));
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [forceBadge, requestedSlug]);

  return model;
}

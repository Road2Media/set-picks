import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ga4Event } from '../../../shared/lib/ga4';
import { buildStandingsViewPath } from './standingsViewPath';
import { DEFAULT_STANDINGS_VIEW, STANDINGS_VIEWS } from './useStandingsView';

/**
 * Cross-route Standings IA toggle (#255 / #769).
 *
 * Show / Tour / Year / Pools stay on `/dashboard/standings` (delegating to the
 * in-page `setPathView` when already there — that path owns GA4).
 * Preserves `?tour=` on Tour and `?year=` on Year.
 *
 * @param {{
 *   view: 'show' | 'tour' | 'year' | 'pools',
 *   setPathView?: (next: 'show' | 'tour' | 'year' | 'pools') => void,
 * }} options
 */
export function useStandingsViewChange({ view, setPathView }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useCallback(
    (nextView) => {
      const normalized =
        typeof nextView === 'string' && STANDINGS_VIEWS.includes(nextView)
          ? nextView
          : DEFAULT_STANDINGS_VIEW;
      if (normalized === view) return;

      const tourKey = searchParams.get('tour') || '';
      const poolId = searchParams.get('pool') || '';
      const yearKey = searchParams.get('year') || '';

      if (typeof setPathView === 'function') {
        setPathView(normalized);
        return;
      }

      ga4Event('standings_view_change', { from: view, to: normalized });
      navigate(
        buildStandingsViewPath(normalized, {
          tourKey: normalized === 'tour' ? tourKey : '',
          poolId: normalized === 'pools' ? poolId : '',
          yearKey: normalized === 'year' ? yearKey : '',
        }),
      );
    },
    [navigate, searchParams, setPathView, view],
  );
}

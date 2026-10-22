import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ga4Event } from '../../../shared/lib/ga4';

/**
 * Views owned by `/dashboard/standings?view=` (#255). Keep aligned with
 * `dashboardPageMeta.js` and `scripts/verify-dashboard-meta.mjs`.
 */
export const STANDINGS_PATH_VIEWS = Object.freeze(['show', 'tour', 'year', 'pools']);

/**
 * Standings chrome views (#769). Stats moved to the Stats primary.
 */
export const STANDINGS_VIEWS = STANDINGS_PATH_VIEWS;

/** Default view when the URL has no `?view` query. */
export const DEFAULT_STANDINGS_VIEW = 'show';
const RECENT_STANDINGS_POOL_KEY = 'standings.recentPoolId';

function isKnownPathView(v) {
  return typeof v === 'string' && STANDINGS_PATH_VIEWS.includes(v);
}

/**
 * Pure normalizer: anything unrecognized falls back to the default
 * view so a stale bookmark (`?view=season`, `?view=`, etc.) still
 * renders something sensible rather than an empty tab panel.
 */
export function normalizeView(raw) {
  return isKnownPathView(raw) ? raw : DEFAULT_STANDINGS_VIEW;
}

/**
 * Pure read-side derivation of `(view, poolId)` from the current URL
 * query + the user's pools. Exercised directly in unit tests; the
 * hook below layers URL-sync side effects on top.
 *
 * @param {{
 *   view?: string | null | undefined,
 *   pool?: string | null | undefined,
 * }} query
 * @param {Array<{ id: string }> | null | undefined} userPools
 */
export function deriveStandingsView(query, userPools) {
  const view = normalizeView(query?.view);
  const rawPool = typeof query?.pool === 'string' ? query.pool : '';
  if (view !== 'pools' || !rawPool) {
    return { view, poolId: null };
  }
  const found = (userPools || []).some(
    (p) => p && typeof p.id === 'string' && p.id === rawPool,
  );
  return { view, poolId: found ? rawPool : null };
}

/**
 * Pick the default pool for the Pools view.
 * - Prefer most-recent pool when it still exists.
 * - Otherwise fall back to the first pool.
 *
 * @param {Array<{ id: string }> | null | undefined} userPools
 * @param {string | null | undefined} recentPoolId
 */
export function deriveDefaultPoolId(userPools, recentPoolId) {
  const ids = (userPools || [])
    .map((p) => (p && typeof p.id === 'string' ? p.id : ''))
    .filter(Boolean);
  if (ids.length === 0) return null;
  if (typeof recentPoolId === 'string' && ids.includes(recentPoolId)) {
    return recentPoolId;
  }
  return ids[0];
}

function readRecentStandingsPoolId() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(RECENT_STANDINGS_POOL_KEY);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function writeRecentStandingsPoolId(poolId) {
  if (typeof window === 'undefined') return;
  if (typeof poolId !== 'string' || !poolId.trim()) return;
  try {
    window.localStorage.setItem(RECENT_STANDINGS_POOL_KEY, poolId.trim());
  } catch {
    // Ignore storage write failures (private mode / blocked storage).
  }
}

/**
 * URL-synced state for the standings top-level pill toggle.
 *
 * Owns the `?view=show|tour|year|pools` and `?pool=<id>` query params so
 * `useDisplayedPicks` can stay a pure derivation and the page can stay
 * declarative. Handles:
 *
 *   1. **Deep-link from pool details** — `navTargetPoolId` (passed through
 *      `location.state.targetPoolId` when jumping from pool details) wins
 *      once on mount; flips `view=pools` + selects that pool and writes
 *      the canonical URL shape.
 *   2. **Legacy `?poolId=<id>`** from the old `useDisplayedPicks` URL
 *      contract — migrated one-shot to `?view=pools&pool=<id>` so old
 *      bookmarks still land on the right surface.
 *   3. **Invalid pool ids** — if `?pool=<id>` doesn't match any of the
 *      user's pools (race after leaving a pool, stale bookmark), we fall
 *      back to the default view and clear the query rather than render
 *      an empty leaderboard.
 *
 * @param {{
 *   userPools?: Array<{ id: string, name?: string, members?: string[] }> | null,
 *   navTargetPoolId?: string | null | undefined,
 * }} options
 */
export function useStandingsView({ userPools, navTargetPoolId } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConsumedRef = useRef(false);
  const legacyMigrationConsumedRef = useRef(false);

  const rawView = searchParams.get('view');
  const rawPool = searchParams.get('pool') || '';
  const rawLegacyPoolId = searchParams.get('poolId') || '';

  const poolsById = useMemo(() => {
    const map = new Map();
    (userPools || []).forEach((p) => {
      if (p && typeof p.id === 'string') map.set(p.id, p);
    });
    return map;
  }, [userPools]);

  const { view, poolId } = deriveStandingsView(
    { view: rawView, pool: rawPool },
    userPools,
  );

  // One-shot: promote `location.state.targetPoolId` (coming from pool
  // details CTA) over whatever the URL says.
  useEffect(() => {
    if (deepLinkConsumedRef.current) return;
    const target = typeof navTargetPoolId === 'string' ? navTargetPoolId.trim() : '';
    if (!target) return;
    if (!poolsById.has(target)) return;
    deepLinkConsumedRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'pools');
        next.set('pool', target);
        next.delete('poolId');
        return next;
      },
      { replace: true },
    );
  }, [navTargetPoolId, poolsById, setSearchParams]);

  // Legacy migration: `?poolId=<id>` (pre-#255) → `?view=pools&pool=<id>`.
  useEffect(() => {
    if (legacyMigrationConsumedRef.current) return;
    if (!rawLegacyPoolId.trim()) return;
    if (rawView) {
      // The user already landed on a modern URL — just drop the stray
      // `poolId` query so it stops confusing the selector.
      legacyMigrationConsumedRef.current = true;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('poolId');
          return next;
        },
        { replace: true },
      );
      return;
    }
    const legacyId = rawLegacyPoolId.trim();
    legacyMigrationConsumedRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'pools');
        if (poolsById.has(legacyId)) {
          next.set('pool', legacyId);
        } else {
          next.delete('pool');
        }
        next.delete('poolId');
        return next;
      },
      { replace: true },
    );
  }, [rawLegacyPoolId, rawView, poolsById, setSearchParams]);

  // Self-heal: `?view=pools&pool=<unknown>` → drop to default.
  useEffect(() => {
    if (view !== 'pools') return;
    if (!rawPool) return;
    if (poolsById.has(rawPool)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('pool');
        return next;
      },
      { replace: true },
    );
  }, [view, rawPool, poolsById, setSearchParams]);

  // In Pools view, auto-select a sensible default when no pool is selected.
  useEffect(() => {
    if (view !== 'pools') return;
    if (poolId) return;
    const defaultPoolId = deriveDefaultPoolId(userPools, readRecentStandingsPoolId());
    if (!defaultPoolId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'pools');
        next.set('pool', defaultPoolId);
        next.delete('poolId');
        return next;
      },
      { replace: true },
    );
  }, [view, poolId, userPools, setSearchParams]);

  // Keep the most recently viewed Pools-selection for future visits.
  useEffect(() => {
    if (view !== 'pools') return;
    if (!poolId) return;
    writeRecentStandingsPoolId(poolId);
  }, [view, poolId]);

  const setView = useCallback(
    (nextView) => {
      const normalized = normalizeView(nextView);
      // `?view=` collapses in GA4 page reports, so switches were invisible
      // before this event (#609) — keep it or standings iteration goes blind.
      if (normalized !== view) {
        ga4Event('standings_view_change', { from: view, to: normalized });
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (normalized === DEFAULT_STANDINGS_VIEW) {
            next.delete('view');
          } else {
            next.set('view', normalized);
          }
          if (normalized !== 'pools') {
            next.delete('pool');
          }
          next.delete('poolId');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, view],
  );

  const setPoolId = useCallback(
    (id) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('view', 'pools');
          if (typeof id === 'string' && id.trim()) {
            next.set('pool', id.trim());
          } else {
            next.delete('pool');
          }
          next.delete('poolId');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { view, poolId, setView, setPoolId };
}

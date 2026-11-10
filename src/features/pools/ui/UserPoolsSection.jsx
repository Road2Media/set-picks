import React from 'react';

import PendingPoolJoinBanner from './PendingPoolJoinBanner';
import PoolCard from './PoolCard';

/**
 * @param {{
 *   pools: Array<{ id: string }>,
 *   hasPicksForNextShow?: boolean,
 *   picksStatusLoading?: boolean,
 *   listLoading?: boolean,
 *   pendingJoinState?: 'idle' | 'joining' | 'succeeded' | 'failed',
 *   pendingJoinErrorKind?: 'timeout' | 'generic' | 'invalid-code' | 'pool-full' | 'pool-archived' | null,
 *   onRetryPendingJoin?: (() => void) | null,
 *   retryPendingJoinLoading?: boolean,
 *   emptyAction?: React.ReactNode,
 * }} props
 */
export default function UserPoolsSection({
  pools,
  hasPicksForNextShow = false,
  picksStatusLoading = false,
  listLoading = false,
  pendingJoinState = 'idle',
  pendingJoinErrorKind = null,
  onRetryPendingJoin = null,
  retryPendingJoinLoading = false,
  emptyAction = null,
}) {
  const showJoiningChrome =
    pendingJoinState === 'joining' || pendingJoinState === 'failed';
  const showEmpty =
    !showJoiningChrome && !listLoading && pools.length === 0;
  const showListLoading = listLoading && pools.length === 0 && !showJoiningChrome;

  return (
    <section className="space-y-4">
      {showJoiningChrome ? (
        <PendingPoolJoinBanner
          pendingJoinState={pendingJoinState}
          pendingJoinErrorKind={pendingJoinErrorKind}
          onRetryPendingJoin={onRetryPendingJoin}
          retryPendingJoinLoading={retryPendingJoinLoading}
        />
      ) : null}

      {showListLoading ? (
        <div className="rounded-3xl border border-dashed border-border-muted/60 bg-surface-glass/32 p-8 text-center shadow-inset-glass">
          <p className="font-bold text-content-secondary">Loading your pools…</p>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-3xl border border-dashed border-border-muted/60 bg-surface-glass/32 p-8 text-center shadow-inset-glass">
          <p className="font-bold text-content-secondary">You are not in any pools yet.</p>
          <p className="mt-1 text-sm text-content-secondary/90">
            {emptyAction ? (
              <>
                {emptyAction}
                {', then lock picks on the Picks tab.'}
              </>
            ) : (
              'Join with a code or create a pool, then lock picks on the Picks tab.'
            )}
          </p>
        </div>
      ) : null}

      {pools.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              hasPicksForNextShow={hasPicksForNextShow}
              picksStatusLoading={picksStatusLoading}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

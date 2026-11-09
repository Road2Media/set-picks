import React, { useEffect, useState } from 'react';

import Button from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';

/**
 * Join-by-code form for `/dashboard/pools/join` (#768).
 *
 * @param {{
 *   actionLoading?: 'join' | 'create' | null,
 *   loading?: boolean,
 *   error?: unknown,
 *   initialCode?: string,
 *   autoFocus?: boolean,
 *   onJoin: (code: string) => Promise<{ id?: string, name?: string }>,
 * }} props
 */
export default function PoolJoinCard({
  actionLoading = null,
  /** @deprecated Prefer `actionLoading` (#728). */
  loading = false,
  error,
  initialCode = '',
  autoFocus = false,
  onJoin,
}) {
  const joinBusy = actionLoading === 'join' || (actionLoading == null && loading);
  const [joinCode, setJoinCode] = useState(() => initialCode.trim().toUpperCase());
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const next = initialCode.trim().toUpperCase();
    if (next) setJoinCode(next);
  }, [initialCode]);

  const handleJoinSubmit = async (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setMessage({ text: '', type: '' });

    try {
      const joinedPool = await onJoin(code);
      setJoinCode('');
      setMessage({
        text: `Successfully joined ${joinedPool.name}!`,
        type: 'success',
      });
    } catch (joinError) {
      if (joinError?.code === 'invalid-invite-code') {
        setMessage({ text: 'Invalid invite code', type: 'error' });
        return;
      }
      if (joinError?.code === 'pool-archived') {
        setMessage({
          text: 'That pool is archived and no longer accepts new members.',
          type: 'error',
        });
        return;
      }
      if (joinError?.code === 'already-in-pool') {
        setMessage({ text: "You're already in this pool", type: 'error' });
        return;
      }
      if (joinError?.code === 'pool-full') {
        setMessage({ text: 'This pool is full.', type: 'error' });
        return;
      }
      setMessage({ text: 'Could not join pool', type: 'error' });
    }
  };

  const bannerText = message.text || (error ? 'Something went wrong with pools.' : '');
  const bannerType = message.text ? message.type : 'error';

  return (
    <Panel className="overflow-hidden">
        {bannerText ? (
          <div
            className={`mb-4 rounded-xl p-3 text-center text-sm font-bold ${
              bannerType === 'error'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-brand-primary/10 text-brand-primary'
            }`}
          >
            {bannerText}
          </div>
        ) : null}

        <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="pool-join-code"
              className="mb-2 ml-1 block text-xs font-bold uppercase tracking-widest text-content-secondary"
            >
              Invite code (5 characters)
            </label>
            <Input
              id="pool-join-code"
              maxLength={5}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. A7X9K"
              autoFocus={autoFocus}
              className="text-center font-mono text-xl font-black tracking-widest uppercase"
            />
          </div>
          <Button
            variant="primary"
            type="submit"
            disabled={joinBusy}
            className="w-full text-lg uppercase tracking-widest"
          >
            {joinBusy ? 'Joining...' : 'Join Pool'}
          </Button>
        </form>
    </Panel>
  );
}

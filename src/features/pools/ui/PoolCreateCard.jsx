import React, { useState } from 'react';

import { createPoolInviteLink } from '../../../shared/lib/createPoolInviteLink';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import PoolInviteCodeRow from './PoolInviteCodeRow';
import PoolInviteShareButton from './PoolInviteShareButton';

/**
 * Create-pool form for `/dashboard/pools/create` (#768).
 *
 * @param {{
 *   actionLoading?: 'join' | 'create' | null,
 *   loading?: boolean,
 *   error?: unknown,
 *   onCreate: (name: string) => Promise<{ id?: string, name?: string, inviteCode?: string }>,
 * }} props
 */
export default function PoolCreateCard({
  actionLoading = null,
  /** @deprecated Prefer `actionLoading` (#728). */
  loading = false,
  error,
  onCreate,
  initialName = '',
}) {
  const createBusy =
    actionLoading === 'create' || (actionLoading == null && loading);
  const [createName, setCreateName] = useState(initialName);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [createSuccess, setCreateSuccess] = useState(null);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!createName.trim()) return;
    setMessage({ text: '', type: '' });
    setCreateSuccess(null);

    try {
      const createdPool = await onCreate(createName);
      setCreateName('');
      setCreateSuccess({
        name: createdPool.name,
        inviteCode: createdPool.inviteCode,
      });
    } catch {
      setMessage({ text: 'Could not create pool', type: 'error' });
    }
  };

  const inviteUrl =
    createSuccess?.inviteCode != null
      ? createPoolInviteLink(createSuccess.inviteCode)
      : '';
  const errorText =
    message.type === 'error' && message.text
      ? message.text
      : error
        ? 'Something went wrong with pools.'
        : '';

  return (
    <Card variant="default" padding="none" className="overflow-hidden">
      <div className="p-6">
        {errorText ? (
          <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-center text-sm font-bold text-red-400">
            {errorText}
          </div>
        ) : null}

        {createSuccess ? (
          <div className="flex flex-col gap-4 rounded-xl border border-brand-primary/25 bg-brand-primary/5 p-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-brand-primary">
                Pool created!
              </p>
              <p className="mt-1 text-base font-bold text-white">{createSuccess.name}</p>
              <PoolInviteCodeRow
                inviteCode={createSuccess.inviteCode}
                className="mt-3"
              />
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-content-secondary">
                Your invite link
              </p>
              <p className="mt-1 break-all rounded-lg border border-border-subtle bg-surface-field p-3 font-mono text-xs leading-relaxed text-slate-200">
                {inviteUrl || '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PoolInviteShareButton
                inviteCode={createSuccess.inviteCode}
                poolName={createSuccess.name}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="pool-create-name"
                className="mb-2 ml-1 block text-xs font-bold uppercase tracking-widest text-content-secondary"
              >
                Pool Name
              </label>
              <Input
                id="pool-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
                placeholder="e.g. Denver Crew 2026"
              />
            </div>
            <Button
              variant="primary"
              type="submit"
              disabled={createBusy}
              className="w-full text-lg uppercase tracking-widest"
            >
              {createBusy ? 'Creating...' : 'Create pool'}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

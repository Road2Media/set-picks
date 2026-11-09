import React, { useState } from 'react';

import { createPoolInviteLink } from '../../../shared/lib/createPoolInviteLink';
import Button from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import PoolInviteCodeRow from './PoolInviteCodeRow';
import PoolInviteShareButton from './PoolInviteShareButton';

export default function PoolJoinCreateCard({
  actionLoading = null,
  /** @deprecated Prefer `actionLoading` (#728). */
  loading = false,
  error,
  onJoin,
  onCreate,
}) {
  const joinBusy = actionLoading === 'join' || (actionLoading == null && loading);
  const createBusy = actionLoading === 'create' || (actionLoading == null && loading);
  const [activeTab, setActiveTab] = useState('join');
  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [createSuccess, setCreateSuccess] = useState(null);

  const clearFeedback = () => {
    setMessage({ text: '', type: '' });
    setCreateSuccess(null);
  };

  const handleJoinSubmit = async (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    clearFeedback();

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
      setMessage({ text: 'Could not join pool', type: 'error' });
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!createName.trim()) return;
    clearFeedback();

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

  const bannerText = message.text || (error ? 'Something went wrong with pools.' : '');
  const bannerType = message.text ? message.type : 'error';
  const inviteUrl =
    createSuccess?.inviteCode != null
      ? createPoolInviteLink(createSuccess.inviteCode)
      : '';

  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="flex border-b border-border-muted">
        <Button
          variant="text"
          size="none"
          onClick={() => {
            setActiveTab('join');
            clearFeedback();
          }}
          className={`flex-1 px-4 py-4 text-sm font-black uppercase tracking-widest ${
            activeTab === 'join'
              ? 'border-b-2 border-brand-primary bg-brand-primary/10 text-brand-primary'
              : 'text-content-secondary hover:text-white'
          }`}
        >
          Join Pool
        </Button>
        <Button
          variant="text"
          size="none"
          onClick={() => {
            setActiveTab('create');
            clearFeedback();
          }}
          className={`flex-1 px-4 py-4 text-sm font-black uppercase tracking-widest ${
            activeTab === 'create'
              ? 'border-b-2 border-brand-primary bg-brand-primary/10 text-brand-primary'
              : 'text-content-secondary hover:text-white'
          }`}
        >
          Create Pool
        </Button>
      </div>

      <div className="p-6">
        {activeTab === 'join' && bannerText ? (
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

        {activeTab === 'create' && message.type === 'error' && message.text ? (
          <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-center text-sm font-bold text-red-400">
            {message.text}
          </div>
        ) : null}

        {activeTab === 'join' ? (
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
                className="text-center font-mono text-xl font-black tracking-widest uppercase"
              />
            </div>
            <Button variant="primary" type="submit" disabled={joinBusy} className="w-full text-lg uppercase tracking-widest">
              {joinBusy ? 'Joining...' : 'Join Pool'}
            </Button>
          </form>
        ) : createSuccess ? (
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
                placeholder="e.g. Denver Crew 2026"
              />
            </div>
            <Button variant="primary" type="submit" disabled={createBusy} className="w-full text-lg uppercase tracking-widest">
              {createBusy ? 'Creating...' : 'Create pool'}
            </Button>
          </form>
        )}
      </div>
    </Panel>
  );
}

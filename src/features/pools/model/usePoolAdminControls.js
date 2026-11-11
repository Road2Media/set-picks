import { useCallback, useMemo, useState } from 'react';

import { deletePoolWithCleanup } from '../api/poolDeleteCallable';
import {
  POOL_NAME_MAX_LENGTH,
  updatePoolNameApi,
  updatePoolStatusApi,
} from '../api/poolFirestore';
import { invalidateUserPools } from './userPoolsRefreshBus';

/**
 * @param {string | undefined} poolId
 * @param {{ uid?: string } | null | undefined} user
 * @param {{ ownerId?: string, name?: string, status?: string, members?: string[] } | null} pool
 * @param {{ navigate: (path: string) => void, onReloadPool: () => void | Promise<void> }} callbacks
 */
export function usePoolAdminControls(poolId, user, pool, { navigate, onReloadPool }) {
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(
    /** @type {null | 'archive' | 'delete'} */ (null)
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const canAdmin = Boolean(
    user?.uid && pool?.ownerId != null && user.uid === pool.ownerId
  );

  const isArchived = pool?.status === 'archived';

  const closeConfirm = useCallback(() => {
    if (!busy) setConfirmAction(null);
  }, [busy]);

  const openEditName = useCallback(() => {
    setFormError('');
    setEditNameOpen(true);
  }, []);

  const closeEditName = useCallback(() => {
    if (!busy) {
      setFormError('');
      setEditNameOpen(false);
    }
  }, [busy]);

  const openArchiveConfirm = useCallback(() => {
    setFormError('');
    setConfirmAction('archive');
  }, []);

  const openDeleteConfirm = useCallback(() => {
    setFormError('');
    setConfirmAction('delete');
  }, []);

  const handleSaveName = useCallback(
    async (rawName) => {
      const pid = poolId?.trim();
      if (!pid) return;
      const trimmed = rawName?.trim() ?? '';
      if (!trimmed) {
        setFormError('Pool name is required.');
        return;
      }
      if (trimmed.length > POOL_NAME_MAX_LENGTH) {
        setFormError(`Name must be at most ${POOL_NAME_MAX_LENGTH} characters.`);
        return;
      }
      setBusy(true);
      setFormError('');
      try {
        await updatePoolNameApi(pid, trimmed);
        setEditNameOpen(false);
        await onReloadPool();
        invalidateUserPools();
      } catch (e) {
        setFormError(
          e instanceof Error ? e.message : 'Could not update pool name.'
        );
      } finally {
        setBusy(false);
      }
    },
    [poolId, onReloadPool]
  );

  const handleConfirmArchive = useCallback(async () => {
    const pid = poolId?.trim();
    if (!pid) return;
    setBusy(true);
    setFormError('');
    try {
      await updatePoolStatusApi(pid, 'archived');
      invalidateUserPools();
      setConfirmAction(null);
      navigate('/dashboard/pools');
    } catch (e) {
      setConfirmAction(null);
      setFormError(
        e instanceof Error ? e.message : 'Could not archive this pool.'
      );
    } finally {
      setBusy(false);
    }
  }, [poolId, navigate]);

  const handleConfirmDelete = useCallback(async () => {
    const pid = poolId?.trim();
    const oid = pool?.ownerId?.trim();
    if (!pid || !oid) return;
    setBusy(true);
    setFormError('');
    try {
      // Server (`deletePoolWithCleanup`, issue #138) is the source of truth:
      // it re-checks ownership, activity, and cleans up every member's
      // `users.pools` entry with Admin SDK. Don't duplicate that logic here.
      await deletePoolWithCleanup(pid);
      invalidateUserPools();
      setConfirmAction(null);
      navigate('/dashboard/pools');
    } catch (e) {
      setConfirmAction(null);
      const code = e && typeof e === 'object' && 'code' in e ? e.code : '';
      if (code === 'pool-has-activity') {
        setFormError(
          e instanceof Error
            ? e.message
            : 'This pool has pick history. Archive it instead of deleting.'
        );
      } else if (code === 'permission-denied') {
        setFormError('Only the pool owner can delete this pool.');
      } else {
        setFormError(
          e instanceof Error ? e.message : 'Could not delete this pool.'
        );
      }
    } finally {
      setBusy(false);
    }
  }, [poolId, pool?.ownerId, navigate]);

  const confirmModalProps = useMemo(() => {
    if (confirmAction === 'archive') {
      return {
        title: 'Archive this pool?',
        message:
          'Archived pools disappear from your pool list and new players cannot join. Past picks stay on the record.',
        confirmLabel: 'Archive pool',
        confirmVariant: 'danger',
        onConfirm: handleConfirmArchive,
      };
    }
    if (confirmAction === 'delete') {
      return {
        title: 'Delete this pool?',
        message:
          'This removes the pool and clears it from every member. Only allowed when no picks have been made yet; otherwise archive instead. This cannot be undone.',
        confirmLabel: 'Delete pool',
        confirmVariant: 'danger',
        onConfirm: handleConfirmDelete,
      };
    }
    return null;
  }, [confirmAction, handleConfirmArchive, handleConfirmDelete]);

  return {
    canAdmin,
    isArchived,
    editNameOpen,
    openEditName,
    closeEditName,
    busy,
    formError,
    setFormError,
    poolName: pool?.name != null ? String(pool.name) : '',
    openArchiveConfirm,
    openDeleteConfirm,
    closeConfirm,
    confirmModalOpen: confirmAction != null,
    confirmModalProps,
    handleSaveName,
  };
}

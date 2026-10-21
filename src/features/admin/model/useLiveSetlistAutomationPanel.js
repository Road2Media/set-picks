import { useEffect, useState } from 'react';

import {
  LIVE_SETLIST_DEGRADED_MESSAGE_KEYS,
  playerDegradedMessage,
} from '../../scoring';
import {
  pollLiveSetlistNow,
  setLiveSetlistAutomationState,
  setLiveSetlistServiceStatus,
  subscribeLiveSetlistAutomationState,
  subscribeLiveSetlistPlayerStatus,
} from '../api/liveSetlistAutomationApi';
import {
  deriveAutomationHealth,
  formatAutomationTimestamp,
  truncateAutomationError,
} from './liveSetlistAutomationHealth';

const DEFAULT_MESSAGE_KEY = LIVE_SETLIST_DEGRADED_MESSAGE_KEYS[0] || 'phishnet_stalled';

/**
 * War Room live-automation health, Force poll, and player-banner controls (#644).
 *
 * @param {{ showDate?: string, isAdmin?: boolean }} args
 */
export function useLiveSetlistAutomationPanel({ showDate, isAdmin }) {
  const [automation, setAutomation] = useState(null);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [playerStatus, setPlayerStatus] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [messageKey, setMessageKey] = useState(DEFAULT_MESSAGE_KEY);
  const [clearOnRecovery, setClearOnRecovery] = useState(false);

  useEffect(() => {
    if (!isAdmin || !showDate) {
      setAutomation(null);
      setAutomationLoaded(false);
      setPlayerStatus(null);
      return undefined;
    }
    setAutomation(null);
    setAutomationLoaded(false);
    setStatusText('');
    setErrorText('');
    const unsubAutomation = subscribeLiveSetlistAutomationState(
      showDate,
      (state) => {
        setAutomation(state);
        setAutomationLoaded(true);
      },
      (error) => {
        console.error('Error loading automation state:', error);
        setErrorText(error instanceof Error ? error.message : 'Could not load automation health.');
      },
    );
    const unsubStatus = subscribeLiveSetlistPlayerStatus(
      showDate,
      setPlayerStatus,
      (error) => {
        console.error('Error loading player status:', error);
      },
    );
    return () => {
      unsubAutomation();
      unsubStatus();
    };
  }, [isAdmin, showDate]);

  const handleToggle = async () => {
    if (!showDate || !isAdmin || isToggling || isPolling) return;
    setErrorText('');
    setStatusText('');
    setIsToggling(true);
    const nextEnabled = automation?.enabled === false;
    try {
      await setLiveSetlistAutomationState(showDate, nextEnabled);
      setStatusText(
        nextEnabled
          ? `Automation resumed for ${showDate}.`
          : `Automation paused for ${showDate}.`,
      );
    } catch (error) {
      console.error('Error toggling automation:', error);
      setErrorText(error instanceof Error ? error.message : 'Failed to update automation state.');
    } finally {
      setIsToggling(false);
    }
  };

  const handlePollNow = async () => {
    if (!showDate || !isAdmin || isToggling || isPolling) return;
    setErrorText('');
    setStatusText('');
    setIsPolling(true);
    try {
      const result = await pollLiveSetlistNow(showDate);
      const row = Array.isArray(result?.results) ? result.results[0] : null;
      if (row?.error) {
        setErrorText(`Phish.net Force poll failed for ${showDate}. ${row.error}`);
        return;
      }
      if (row?.changed) {
        const picksUpdated = typeof row.updatedPicks === 'number' ? row.updatedPicks : 0;
        setStatusText(
          `Phish.net Force poll succeeded for ${showDate}. Upstream setlist changed and ${picksUpdated} pick scores were refreshed.`,
        );
      } else {
        setStatusText(
          `Phish.net Force poll succeeded for ${showDate}. Upstream returned no setlist change.`,
        );
      }
    } catch (error) {
      console.error('Error running manual automation poll:', error);
      setErrorText(
        error instanceof Error
          ? `Phish.net Force poll failed. ${error.message}`
          : 'Phish.net Force poll failed.',
      );
    } finally {
      setIsPolling(false);
    }
  };

  const handlePublishBanner = async () => {
    if (!showDate || !isAdmin || isPublishing) return;
    setErrorText('');
    setStatusText('');
    setIsPublishing(true);
    try {
      await setLiveSetlistServiceStatus({
        showDate,
        action: 'publish',
        messageKey,
        clearOnRecovery,
      });
      setStatusText(
        clearOnRecovery
          ? `Player delay message published for ${showDate}. It clears when Phish.net recovers.`
          : `Player delay message pinned for ${showDate}. Clear it here when you are done.`,
      );
    } catch (error) {
      console.error('Error publishing player status:', error);
      setErrorText(error instanceof Error ? error.message : 'Could not publish the player message.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClearBanner = async () => {
    if (!showDate || !isAdmin || isPublishing) return;
    setErrorText('');
    setStatusText('');
    setIsPublishing(true);
    try {
      await setLiveSetlistServiceStatus({ showDate, action: 'clear' });
      setStatusText(`Player delay message cleared for ${showDate}.`);
    } catch (error) {
      console.error('Error clearing player status:', error);
      setErrorText(error instanceof Error ? error.message : 'Could not clear the player message.');
    } finally {
      setIsPublishing(false);
    }
  };

  const bannerVisible = playerStatus?.status === 'degraded' && !playerStatus?.resolvedAt;
  const bannerActivatedBy =
    playerStatus?.activatedBy === 'admin' ? 'manual' : bannerVisible ? 'automatic' : '';

  return {
    enabled: automation?.enabled !== false,
    isToggling,
    isPolling,
    isPublishing,
    statusText,
    errorText,
    health: automationLoaded ? deriveAutomationHealth(automation) : '—',
    lastResult: automation?.lastResult || '—',
    failureCount: automation?.failureCount || 0,
    lastError: truncateAutomationError(automation?.lastError),
    lastPolledAt: formatAutomationTimestamp(automation?.lastPolledAt),
    nextPollAt: formatAutomationTimestamp(automation?.nextPollAt),
    lastSuccessfulPollMode: automation?.lastSuccessfulPollMode || '',
    messageKey,
    setMessageKey,
    clearOnRecovery,
    setClearOnRecovery,
    messageChoices: LIVE_SETLIST_DEGRADED_MESSAGE_KEYS.map((key) => ({
      key,
      label: playerDegradedMessage(key),
    })),
    bannerVisible,
    bannerActivatedBy,
    handleToggle,
    handlePollNow,
    handlePublishBanner,
    handleClearBanner,
  };
}

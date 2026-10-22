import { useEffect, useRef, useState } from 'react';

import { subscribeLiveSetlistServiceStatus } from '../api/liveSetlistServiceStatusApi';
import {
  isDegradedPlayerStatus,
  playerDegradedMessage,
} from './liveSetlistServiceStatus';
import {
  trackLiveSetlistDegradedBannerCleared,
  trackLiveSetlistDegradedBannerView,
} from './standingsAnalytics';

const SHOW_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Subscribe to the sanitized live-setlist status for the selected show.
 * Other dates use a different document, so they cannot see this banner.
 *
 * @param {string | null | undefined} showDate
 * @param {{ enabled?: boolean }} [options]
 */
export function useLiveSetlistServiceStatus(showDate, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const seenView = useRef('');
  const previous = useRef({
    visible: false,
    showDate: '',
    activatedBy: 'automation',
  });

  useEffect(() => {
    if (!enabled || !SHOW_DATE.test(String(showDate || ''))) {
      setData(null);
      return undefined;
    }
    return subscribeLiveSetlistServiceStatus(showDate, setData);
  }, [enabled, showDate]);

  const visible = isDegradedPlayerStatus(data);
  const activatedBy = data?.activatedBy === 'admin' ? 'admin' : 'automation';
  const message = visible ? playerDegradedMessage(data?.messageKey) : '';

  useEffect(() => {
    const prev = previous.current;
    if (prev.visible && (!visible || prev.showDate !== showDate)) {
      trackLiveSetlistDegradedBannerCleared({
        show_date: prev.showDate,
        activated_by: prev.activatedBy,
      });
      seenView.current = '';
    }
    if (visible) {
      const stamp =
        data?.activatedAt && typeof data.activatedAt.toMillis === 'function'
          ? data.activatedAt.toMillis()
          : '';
      const sig = `${showDate}:${activatedBy}:${stamp}`;
      if (seenView.current !== sig) {
        seenView.current = sig;
        trackLiveSetlistDegradedBannerView({
          show_date: showDate,
          activated_by: activatedBy,
        });
      }
    }
    previous.current = {
      visible,
      showDate: String(showDate || ''),
      activatedBy,
    };
  }, [activatedBy, data, showDate, visible]);

  return {
    visible,
    message,
    activatedBy: visible ? activatedBy : '',
  };
}

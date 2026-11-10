import { useCallback, useEffect, useState } from 'react';

import { useSongCatalog } from '../../song-catalog';
import {
  fetchPickDoc,
  fetchPoolsSnapshotForPick,
  resolveHandleForPicks,
  savePickDoc,
} from '../api/picksApi';
import { subscribeShowLockState } from '../api/showLockStateApi';
import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { getShowStatus } from '../../../shared/utils/timeLogic';
import {
  isPicksCardDirty,
  serializePicksCard,
  validatePicksForSave,
} from './picksCatalogUtils';
import { trackEditPicks, trackSubmitPicks } from './picksAnalytics';

function tourLabelForShowDate(selectedDate, showDatesByTour) {
  if (!selectedDate || !Array.isArray(showDatesByTour)) return '';
  const group = showDatesByTour.find((g) =>
    g.shows.some((s) => s.date === selectedDate)
  );
  return group?.tour ?? '';
}

function picksObjectHasAnyValue(picks) {
  return FORM_FIELDS.some((f) => {
    const v = picks?.[f.id];
    return v != null && String(v).trim() !== '';
  });
}

export default function usePicksForm({
  user,
  selectedDate,
  showDates,
  showDatesByTour,
}) {
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  /** True once we've loaded non-empty picks from Firestore for this show (or after first successful save). */
  const [hadPersistedPicksOnServer, setHadPersistedPicksOnServer] = useState(false);
  const [persistedCardSerialized, setPersistedCardSerialized] = useState(() =>
    serializePicksCard({}),
  );
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [pickConstraintMessage, setPickConstraintMessage] = useState(null);
  const { songs } = useSongCatalog();

  const showStatus =
    selectedDate && Array.isArray(showDates) && showDates.length > 0
      ? getShowStatus(selectedDate, showDates)
      : null;
  const [adminLockActive, setAdminLockActive] = useState(false);

  useEffect(() => {
    if (!selectedDate || showStatus !== 'NEXT') {
      setAdminLockActive(false);
      return undefined;
    }

    const unsubscribe = subscribeShowLockState(selectedDate, ({ isLocked }) => {
      setAdminLockActive(isLocked);
    });
    return unsubscribe;
  }, [selectedDate, showStatus]);

  const isLocked = showStatus !== 'NEXT' || adminLockActive;

  const hasExistingPicks =
    Boolean(selectedDate && user?.uid) &&
    !isLoadingPicks &&
    FORM_FIELDS.some((f) => {
      const v = formData[f.id];
      return v != null && String(v).trim() !== '';
    });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.uid || !selectedDate) {
        setFormData({});
        setHadPersistedPicksOnServer(false);
        setPersistedCardSerialized(serializePicksCard({}));
        setIsLoadingPicks(false);
        return;
      }

      setIsLoadingPicks(true);
      try {
        const picks = await fetchPickDoc(selectedDate, user.uid);
        if (!cancelled) {
          setFormData(picks);
          setHadPersistedPicksOnServer(picksObjectHasAnyValue(picks));
          setPersistedCardSerialized(serializePicksCard(picks));
        }
      } catch (err) {
        console.error('Error loading picks:', err);
        if (!cancelled) {
          setFormData({});
          setHadPersistedPicksOnServer(false);
          setPersistedCardSerialized(serializePicksCard({}));
          setSaveFeedback({
            tone: 'error',
            text: 'Error loading picks. Refresh and try again.',
          });
        }
      } finally {
        if (!cancelled) setIsLoadingPicks(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, user?.uid]);

  /**
   * @returns {boolean} `false` when a duplicate title was rejected.
   */
  const handleInput = useCallback((fieldId, value) => {
    let rejectedDuplicate = false;
    setFormData((prev) => {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) {
        return { ...prev, [fieldId]: '' };
      }
      const key = trimmed.toLowerCase();
      for (const f of FORM_FIELDS) {
        if (f.id === fieldId) continue;
        const other = prev[f.id];
        if (other != null && String(other).trim().toLowerCase() === key) {
          rejectedDuplicate = true;
          return prev;
        }
      }
      return { ...prev, [fieldId]: value };
    });
    if (!String(value ?? '').trim()) {
      setPickConstraintMessage(null);
      return true;
    }
    if (rejectedDuplicate) {
      setPickConstraintMessage('Each pick must be a different song.');
      window.setTimeout(() => setPickConstraintMessage(null), 3500);
      return false;
    }
    setPickConstraintMessage(null);
    return true;
  }, []);

  const handleSave = useCallback(
    async (e) => {
      e?.preventDefault?.();

      if (isLocked || isSaving) return;

      if (!user?.uid) {
        setSaveFeedback({
          tone: 'error',
          text: 'Error: You must be logged in to save picks.',
        });
        return;
      }

      const validation = validatePicksForSave(formData, songs);
      if (!validation.ok) {
        setSaveFeedback({
          tone: 'error',
          text: validation.message,
        });
        setTimeout(() => setSaveFeedback(null), 4500);
        return;
      }

      setIsSaving(true);
      setSaveFeedback(null);

      const isUpdateSave = hadPersistedPicksOnServer;
      const tourDate = tourLabelForShowDate(selectedDate, showDatesByTour);

      try {
        const handle = await resolveHandleForPicks(user.uid, user);

        let pools = [];
        try {
          pools = await fetchPoolsSnapshotForPick(user.uid);
        } catch (poolErr) {
          console.error('Error fetching pools for pick snapshot:', poolErr);
          pools = [];
        }

        await savePickDoc({
          userId: user.uid,
          selectedDate,
          picks: formData,
          handle,
          pools,
        });

        if (isUpdateSave) {
          trackEditPicks({ show_id: selectedDate, tour_date: tourDate });
          setSaveFeedback({
            tone: 'success',
            variant: 'updated',
            text: 'Picks updated — you can still change them until showtime.',
          });
        } else {
          trackSubmitPicks({ show_id: selectedDate, tour_date: tourDate });
          setSaveFeedback({
            tone: 'success',
            variant: 'locked',
            text: 'Picks locked in successfully!',
          });
        }
        setHadPersistedPicksOnServer(true);
        setPersistedCardSerialized(serializePicksCard(formData));
      } catch (error) {
        console.error('Error saving picks:', error);
        const code = error?.code;
        const hint =
          code === 'permission-denied'
            ? ' Check that you are signed in, then try again.'
            : '';
        setSaveFeedback({
          tone: 'error',
          text: `Error saving picks. Please try again.${hint}`,
        });
      } finally {
        setIsSaving(false);
        setTimeout(() => setSaveFeedback(null), 3000);
      }
    },
    [
      user,
      selectedDate,
      showDates,
      showDatesByTour,
      formData,
      songs,
      isLocked,
      isSaving,
      hadPersistedPicksOnServer,
    ]
  );

  const isDirty =
    Boolean(user?.uid && selectedDate) &&
    !isLoadingPicks &&
    isPicksCardDirty(formData, persistedCardSerialized);

  return {
    formData,
    handleInput,
    handleSave,
    isSaving,
    isLoadingPicks,
    isLocked,
    hasExistingPicks,
    hadPersistedPicksOnServer,
    isDirty,
    showStatus,
    saveFeedback,
    pickConstraintMessage,
  };
}

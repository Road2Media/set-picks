import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, FlaskConical } from 'lucide-react';

import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_CHEVRON,
  DASHBOARD_CARD_EYEBROW,
  DASHBOARD_CARD_L2_MIN_H,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';
import DashboardJobShell, { DASHBOARD_JOB_ICON } from '../../../shared/ui/DashboardJobShell';
import {
  groupRecommendationsByRiskBand,
  normalizePickTitle,
  selectedTitleKeys,
} from '../model/groupPickRecommendations';
import {
  trackPredictionLabImpression,
  trackPredictionLabOpen,
  trackPredictionLabSelect,
} from '../model/picksAnalytics';

/**
 * Opt-in Prediction Lab — default-collapsed slot recommendations (#651).
 * Parent pages should gate with `isPredictionLabEnabled()` / `VITE_ENABLE_PREDICTION_LAB`
 * (fetch also no-ops in `usePickRecommendations` when the flag is off).
 *
 * @param {object} props
 * @param {string} props.selectedDate
 * @param {object | null} props.artifact
 * @param {boolean} [props.isLoading]
 * @param {Error | null} [props.loadError]
 * @param {Record<string, string>} props.formData
 * @param {boolean} props.isLocked
 * @param {(fieldId: string, value: string) => void} props.onApplySong
 * @param {string} [props.slotInitKey] — reset the active slot when load settles
 *   for a new date; do not reset after a Lab Use (that hid the add).
 * @param {string} [props.className]
 */
export default function PickPredictionPanel({
  selectedDate = '',
  artifact = null,
  isLoading = false,
  loadError = null,
  formData = {},
  isLocked = false,
  onApplySong,
  slotInitKey = '',
  className = '',
}) {
  const targetDate =
    typeof artifact?.targetShow?.date === 'string'
      ? artifact.targetShow.date
      : '';
  const modelVersion =
    typeof artifact?.modelVersion === 'string' ? artifact.modelVersion : '';

  const dateMatches =
    Boolean(selectedDate) &&
    Boolean(targetDate) &&
    selectedDate === targetDate;

  const firstEmptySlot =
    FORM_FIELDS.find((f) => !String(formData?.[f.id] ?? '').trim())?.id ||
    FORM_FIELDS[0].id;

  const [activeSlot, setActiveSlot] = useState(firstEmptySlot);
  const activeSlotSong = String(formData?.[activeSlot] ?? '').trim();

  useEffect(() => {
    if (!slotInitKey || String(slotInitKey).endsWith(':1')) return;
    setActiveSlot(
      FORM_FIELDS.find((f) => !String(formData?.[f.id] ?? '').trim())?.id ||
        FORM_FIELDS[0].id,
    );
  }, [slotInitKey]);

  const excludeKeys = useMemo(
    () => selectedTitleKeys(formData, activeSlot),
    [formData, activeSlot],
  );

  const slotRows = Array.isArray(artifact?.slots?.[activeSlot])
    ? artifact.slots[activeSlot]
    : [];

  const groups = useMemo(
    () => groupRecommendationsByRiskBand(slotRows, excludeKeys),
    [slotRows, excludeKeys],
  );

  const totalVisible = groups.reduce((n, g) => n + g.items.length, 0);

  // Hide entirely when locked or when artifact is unavailable / wrong night.
  if (isLocked) return null;
  if (!isLoading && !dateMatches) return null;
  if (!isLoading && loadError && !artifact) return null;

  const onToggle = (event) => {
    if (!event.currentTarget.open) return;
    trackPredictionLabOpen({
      show_id: selectedDate,
      model_version: modelVersion,
    });
    // Impression: first visible row per band
    for (const g of groups) {
      const top = g.items[0];
      if (!top) continue;
      trackPredictionLabImpression({
        show_id: selectedDate,
        slot: activeSlot,
        model_version: modelVersion,
        risk_band: g.band,
        rank: top.rank ?? 0,
      });
    }
  };

  const apply = (row) => {
    const name = String(row?.name ?? '').trim();
    if (!name || typeof onApplySong !== 'function') return;
    onApplySong(activeSlot, name);
    trackPredictionLabSelect({
      show_id: selectedDate,
      slot: activeSlot,
      model_version: modelVersion,
      risk_band: row.riskBand ?? '',
      rank: row.rank ?? 0,
      song_normalized: row.normalizedName ?? '',
    });
  };

  const shellClass = `mb-4 flex flex-col ${className}`;

  if (isLoading && !artifact) {
    return (
      <DashboardJobShell
        as="section"
        tone="teal"
        pad="label"
        className={`${shellClass} ${DASHBOARD_CARD_L2_MIN_H} justify-center`}
        aria-label="Prediction Lab"
      >
        <p
          className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
        >
          <FlaskConical className={DASHBOARD_JOB_ICON} aria-hidden />
          Prediction Lab
        </p>
        <p className={`mt-1 ${DASHBOARD_CARD_BODY}`}>Loading recommendations…</p>
      </DashboardJobShell>
    );
  }

  if (!dateMatches || !artifact) return null;

  return (
    <DashboardJobShell
      as="details"
      tone="teal"
      pad="label"
      className={`group/lab ${shellClass}`}
      onToggle={onToggle}
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden ${DASHBOARD_CARD_L2_MIN_H}`}
      >
        <div className="min-w-0">
          <p
            className={`inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW} text-brand-primary`}
          >
            <FlaskConical className={DASHBOARD_JOB_ICON} aria-hidden />
            Prediction Lab
          </p>
          <p className={`mt-0.5 ${DASHBOARD_CARD_TITLE}`}>
            Slot-aware picks · opt-in
          </p>
          <p className={`mt-0.5 ${DASHBOARD_CARD_BODY}`}>
            {modelVersion
              ? `Model ${modelVersion} · expand for Safe / Slot fit / Long shot`
              : 'Expand for Safe / Slot fit / Long shot'}
          </p>
        </div>
        <ChevronDown
          className={`${DASHBOARD_CARD_CHEVRON} group-open/lab:rotate-180`}
          aria-hidden
        />
      </summary>

      <div className="mt-3 space-y-3 border-t border-border-subtle/50 pt-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Recommendation slot"
        >
          {FORM_FIELDS.map((field) => {
            const selected = field.id === activeSlot;
            const filled = Boolean(String(formData?.[field.id] ?? '').trim());
            return (
              <button
                key={field.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveSlot(field.id)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  selected
                    ? 'bg-brand-primary/20 text-brand-primary ring-1 ring-brand-primary/40'
                    : 'bg-surface-elevated/40 text-content-secondary hover:text-white'
                }`}
              >
                {filled ? (
                  <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
                ) : null}
                {field.label}
              </button>
            );
          })}
        </div>

        {totalVisible === 0 ? (
          <p className={DASHBOARD_CARD_BODY}>
            No remaining recommendations for this slot (all candidates may
            already be on your card).
          </p>
        ) : (
          groups.map((group) => {
            if (!group.items.length) return null;
            return (
              <div key={group.band}>
                <p
                  className={`mb-1.5 ${DASHBOARD_CARD_EYEBROW} text-content-secondary`}
                >
                  {group.label}
                  {group.hint ? (
                    <span className="font-normal text-content-secondary/80">
                      {' '}
                      · {group.hint}
                    </span>
                  ) : null}
                </p>
                <ul className="space-y-1.5">
                  {group.items.slice(0, 5).map((row) => {
                    const onCard =
                      Boolean(activeSlotSong) &&
                      normalizePickTitle(activeSlotSong) ===
                        (normalizePickTitle(row.normalizedName) ||
                          normalizePickTitle(row.name));
                    return (
                      <li
                        key={`${group.band}-${row.normalizedName || row.name}-${row.rank}`}
                        className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                          onCard
                            ? 'border-brand-primary/45 bg-brand-primary/10'
                            : 'border-border-subtle/80 bg-surface-elevated/30'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {row.name}
                          </p>
                          {Array.isArray(row.reasons) && row.reasons.length ? (
                            <p className={`mt-0.5 ${DASHBOARD_CARD_BODY}`}>
                              {row.reasons.join(' · ')}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => apply(row)}
                          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ring-1 ${
                            onCard
                              ? 'bg-brand-primary/20 text-brand-primary ring-brand-primary/40'
                              : 'bg-brand-primary/15 text-brand-primary ring-brand-primary/35 hover:bg-brand-primary/25'
                          }`}
                        >
                          {onCard ? 'On card' : 'Use'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </DashboardJobShell>
  );
}

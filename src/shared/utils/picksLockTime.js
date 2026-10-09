/**
 * Per-show picks wall-clock lock (#522).
 *
 * When advertised ticket/show time is known (Phish.com `Show Time` →
 * `scheduledStartLocal`): lock = start + PICKS_LOCK_AFTER_START_MIN.
 * Fallback when show time unknown: 19:30 venue-local.
 */

/** @type {{ hour: number, minute: number }} */
export const DEFAULT_PICKS_LOCK_HM = Object.freeze({ hour: 19, minute: 30 });

/** Back-compat aliases for callers that still import fixed hour/minute. */
export const SHOW_PICKS_LOCK_HOUR_LOCAL = DEFAULT_PICKS_LOCK_HM.hour;
export const SHOW_PICKS_LOCK_MINUTE_LOCAL = DEFAULT_PICKS_LOCK_HM.minute;

/** Minutes after published ticket/show time to lock picks. */
export const PICKS_LOCK_AFTER_START_MIN = 20;

/**
 * Known doors times (venue-local 24h `HH:mm`) from Phish.com / tickets.
 * Informational + War Room context; no longer drives the lock formula.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SHOW_DOORS_LOCAL_BY_DATE = Object.freeze({
  '2026-07-18': '17:30', // Merriweather
  '2026-07-19': '17:30',
  '2026-07-21': '17:30', // Syracuse
  '2026-07-22': '18:30', // MSG
  '2026-07-24': '18:30',
  '2026-07-25': '18:30',
  '2026-07-27': '18:30',
  '2026-07-29': '18:30',
  '2026-07-31': '17:00', // Fenway
  '2026-08-01': '17:00',
  '2026-09-04': '18:00', // Dick's
  '2026-09-05': '18:00',
  '2026-09-06': '18:00',
  '2026-10-12': '17:30', // Orion; Sat 10/10 postponed, Phish.com page not moved yet
});

/**
 * Known advertised show/ticket times (venue-local 24h `HH:mm`) from Phish.com.
 * Calendar field `scheduledStartLocal` overrides this seed when present.
 * Ops: extend as future dates publish.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SHOW_SCHEDULED_START_LOCAL_BY_DATE = Object.freeze({
  '2026-07-18': '19:00', // Merriweather
  '2026-07-19': '19:00',
  '2026-07-21': '19:00', // Syracuse
  '2026-07-22': '20:00', // MSG
  '2026-07-24': '20:00',
  '2026-07-25': '20:00',
  '2026-07-27': '20:00',
  '2026-07-29': '20:00',
  '2026-07-31': '19:00', // Fenway
  '2026-08-01': '19:00',
  '2026-09-04': '19:30', // Dick's
  '2026-09-05': '19:30',
  '2026-09-06': '19:30',
  '2026-10-12': '19:00', // Orion; rescheduled from 10/10, show time 7:00pm
});

/**
 * @param {string | null | undefined} value
 * @returns {{ hour: number, minute: number } | null}
 */
export function parseLocalHm(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const h24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    if (
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return { hour, minute };
    }
    return null;
  }

  const h12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!h12) return null;
  let hour = Number(h12[1]);
  const minute = Number(h12[2]);
  const ap = h12[3].toUpperCase();
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  if (ap === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return { hour, minute };
}

/**
 * @param {{ hour: number, minute: number }} hm
 * @returns {string} `HH:mm` 24h
 */
export function formatLocalHm24(hm) {
  return `${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}`;
}

/**
 * @param {{ hour: number, minute: number }} hm
 * @returns {string} e.g. `7:10 PM`
 */
export function formatLockTimeLocalLabel(hm) {
  const hour12 = ((hm.hour + 11) % 12) + 1;
  const suffix = hm.hour >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(hm.minute).padStart(2, '0')} ${suffix}`;
}

/**
 * @param {{ hour: number, minute: number }} start
 * @param {{ afterStartMin?: number }} [opts]
 * @returns {{ hour: number, minute: number }}
 */
export function lockHmFromScheduledStart(
  start,
  { afterStartMin = PICKS_LOCK_AFTER_START_MIN } = {}
) {
  const offset = Math.max(0, afterStartMin);
  const total = start.hour * 60 + start.minute + offset;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

/**
 * Resolve venue-local picks lock for a show.
 *
 * Priority:
 * 1. `show.picksLockLocal` (materialized / override)
 * 2. `show.scheduledStartLocal` or seeded show time for `show.date` → start + 20
 * 3. Default 19:30
 *
 * @param {{
 *   date?: string,
 *   doorsLocal?: string,
 *   scheduledStartLocal?: string,
 *   picksLockLocal?: string,
 * } | null | undefined} show
 * @param {{
 *   startByDate?: Record<string, string>,
 *   doorsByDate?: Record<string, string>,
 *   afterStartMin?: number,
 *   fallback?: { hour: number, minute: number },
 * }} [opts]
 * @returns {{
 *   hour: number,
 *   minute: number,
 *   source: 'picksLockLocal' | 'scheduledStart' | 'fallback',
 *   scheduledStartLocal: string | null,
 *   doorsLocal: string | null,
 * }}
 */
export function resolvePicksLockHm(show, opts = {}) {
  const fallback = opts.fallback ?? DEFAULT_PICKS_LOCK_HM;
  const startByDate = opts.startByDate ?? SHOW_SCHEDULED_START_LOCAL_BY_DATE;
  const doorsByDate = opts.doorsByDate ?? SHOW_DOORS_LOCAL_BY_DATE;

  const date = typeof show?.date === 'string' ? show.date.trim() : '';
  const doorsParsed = parseLocalHm(
    (typeof show?.doorsLocal === 'string' && show.doorsLocal.trim()) ||
      (date && doorsByDate[date]) ||
      null
  );
  const doorsLocal = doorsParsed ? formatLocalHm24(doorsParsed) : null;

  const explicitLock = parseLocalHm(show?.picksLockLocal);
  if (explicitLock) {
    const start = parseLocalHm(
      typeof show?.scheduledStartLocal === 'string'
        ? show.scheduledStartLocal.trim()
        : null
    );
    return {
      ...explicitLock,
      source: 'picksLockLocal',
      scheduledStartLocal: start ? formatLocalHm24(start) : null,
      doorsLocal,
    };
  }

  const start = parseLocalHm(
    (typeof show?.scheduledStartLocal === 'string' &&
      show.scheduledStartLocal.trim()) ||
      (date && startByDate[date]) ||
      null
  );
  if (start) {
    const lock = lockHmFromScheduledStart(start, opts);
    return {
      ...lock,
      source: 'scheduledStart',
      scheduledStartLocal: formatLocalHm24(start),
      doorsLocal,
    };
  }

  return {
    ...fallback,
    source: 'fallback',
    scheduledStartLocal: null,
    doorsLocal,
  };
}

/**
 * Enrich a show row with resolved lock fields (idempotent).
 * @param {{
 *   date: string,
 *   venue?: string,
 *   timeZone?: string,
 *   doorsLocal?: string,
 *   scheduledStartLocal?: string,
 *   picksLockLocal?: string,
 * }} show
 */
export function enrichShowWithPicksLock(show) {
  if (!show || typeof show !== 'object') return show;
  const resolved = resolvePicksLockHm(show);
  if (resolved.source === 'fallback') {
    const out = { ...show };
    if (resolved.doorsLocal && !out.doorsLocal) out.doorsLocal = resolved.doorsLocal;
    return out;
  }

  const enriched = {
    ...show,
    picksLockLocal: show.picksLockLocal || formatLocalHm24(resolved),
    picksLockSource: resolved.source,
  };
  const doorsLocal = show.doorsLocal || resolved.doorsLocal;
  if (doorsLocal) enriched.doorsLocal = doorsLocal;
  const scheduledStartLocal =
    show.scheduledStartLocal || resolved.scheduledStartLocal;
  if (scheduledStartLocal) enriched.scheduledStartLocal = scheduledStartLocal;
  return enriched;
}

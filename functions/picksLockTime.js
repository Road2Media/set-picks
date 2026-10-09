/**
 * Per-show picks wall-clock lock (#522) — CommonJS mirror of
 * `src/shared/utils/picksLockTime.js` (Functions cannot import the ESM client module).
 *
 * Keep in sync with the client module when constants or formula change.
 */

const DEFAULT_PICKS_LOCK_HM = Object.freeze({ hour: 19, minute: 30 });
const PICKS_LOCK_AFTER_START_MIN = 20;

const SHOW_DOORS_LOCAL_BY_DATE = Object.freeze({
  "2026-07-18": "17:30",
  "2026-07-19": "17:30",
  "2026-07-21": "17:30",
  "2026-07-22": "18:30",
  "2026-07-24": "18:30",
  "2026-07-25": "18:30",
  "2026-07-27": "18:30",
  "2026-07-29": "18:30",
  "2026-07-31": "17:00",
  "2026-08-01": "17:00",
  "2026-09-04": "18:00",
  "2026-09-05": "18:00",
  "2026-09-06": "18:00",
  "2026-10-12": "17:30",
});

const SHOW_SCHEDULED_START_LOCAL_BY_DATE = Object.freeze({
  "2026-07-18": "19:00",
  "2026-07-19": "19:00",
  "2026-07-21": "19:00",
  "2026-07-22": "20:00",
  "2026-07-24": "20:00",
  "2026-07-25": "20:00",
  "2026-07-27": "20:00",
  "2026-07-29": "20:00",
  "2026-07-31": "19:00",
  "2026-08-01": "19:00",
  "2026-09-04": "19:30",
  "2026-09-05": "19:30",
  "2026-09-06": "19:30",
  "2026-10-12": "19:00",
});

/**
 * @param {string | null | undefined} value
 * @returns {{ hour: number, minute: number } | null}
 */
function parseLocalHm(value) {
  if (typeof value !== "string") return null;
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
  if (ap === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return { hour, minute };
}

/**
 * @param {{ hour: number, minute: number }} hm
 * @returns {string}
 */
function formatLocalHm24(hm) {
  return `${String(hm.hour).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}`;
}

/**
 * @param {{ hour: number, minute: number }} hm
 * @returns {string}
 */
function formatLockTimeLocalLabel(hm) {
  const hour12 = ((hm.hour + 11) % 12) + 1;
  const suffix = hm.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(hm.minute).padStart(2, "0")} ${suffix}`;
}

/**
 * @param {{ hour: number, minute: number }} start
 * @param {{ afterStartMin?: number }} [opts]
 */
function lockHmFromScheduledStart(
  start,
  { afterStartMin = PICKS_LOCK_AFTER_START_MIN } = {}
) {
  const offset = Math.max(0, afterStartMin);
  const total = start.hour * 60 + start.minute + offset;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

/**
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
 */
function resolvePicksLockHm(show, opts = {}) {
  const fallback = opts.fallback ?? DEFAULT_PICKS_LOCK_HM;
  const startByDate = opts.startByDate ?? SHOW_SCHEDULED_START_LOCAL_BY_DATE;
  const doorsByDate = opts.doorsByDate ?? SHOW_DOORS_LOCAL_BY_DATE;

  const date = typeof show?.date === "string" ? show.date.trim() : "";
  const doorsParsed = parseLocalHm(
    (typeof show?.doorsLocal === "string" && show.doorsLocal.trim()) ||
      (date && doorsByDate[date]) ||
      null
  );
  const doorsLocal = doorsParsed ? formatLocalHm24(doorsParsed) : null;

  const explicitLock = parseLocalHm(show?.picksLockLocal);
  if (explicitLock) {
    const start = parseLocalHm(
      typeof show?.scheduledStartLocal === "string"
        ? show.scheduledStartLocal.trim()
        : null
    );
    return {
      ...explicitLock,
      source: "picksLockLocal",
      scheduledStartLocal: start ? formatLocalHm24(start) : null,
      doorsLocal,
    };
  }

  const start = parseLocalHm(
    (typeof show?.scheduledStartLocal === "string" &&
      show.scheduledStartLocal.trim()) ||
      (date && startByDate[date]) ||
      null
  );
  if (start) {
    const lock = lockHmFromScheduledStart(start, opts);
    return {
      ...lock,
      source: "scheduledStart",
      scheduledStartLocal: formatLocalHm24(start),
      doorsLocal,
    };
  }

  return {
    ...fallback,
    source: "fallback",
    scheduledStartLocal: null,
    doorsLocal,
  };
}

module.exports = {
  DEFAULT_PICKS_LOCK_HM,
  PICKS_LOCK_AFTER_START_MIN,
  SHOW_DOORS_LOCAL_BY_DATE,
  SHOW_SCHEDULED_START_LOCAL_BY_DATE,
  formatLocalHm24,
  formatLockTimeLocalLabel,
  lockHmFromScheduledStart,
  parseLocalHm,
  resolvePicksLockHm,
};

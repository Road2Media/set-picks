/**
 * Pure helpers for scheduled Comms Optimize kickoffs (#778 / #573).
 */

/** @type {string[]} */
export const SHOW_WEEK_GOALS = [
  "picks_lock",
  "email_open",
  "show_recap_uniqueness",
  "tour_retention",
];

/** @type {string[]} */
export const OFF_TOUR_GOALS = ["return_14d", "push_opt_in"];

const SHOW_DATE_RE = /date:\s*'(\d{4}-\d{2}-\d{2})'/g;

/**
 * @param {string} sourceText contents of showDates.js (or similar)
 * @returns {string[]} YYYY-MM-DD sorted unique
 */
export function parseShowDatesFromSource(sourceText) {
  const out = new Set();
  for (const m of String(sourceText).matchAll(SHOW_DATE_RE)) {
    out.add(m[1]);
  }
  return [...out].sort();
}

/**
 * @param {string} ymd
 * @param {string} timeZone
 * @returns {{ y: number, m: number, d: number }}
 */
function partsInTz(ymd, timeZone) {
  // Interpret ymd as a calendar date; format a UTC noon instant in TZ for stable DOW.
  const [y, m, d] = ymd.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(utcNoon).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    weekday: map.weekday,
  };
}

/**
 * @param {Date} now
 * @param {string} timeZone
 * @returns {string} YYYY-MM-DD
 */
export function calendarDateInTz(now, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/**
 * @param {string} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
export function addDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * ISO week number (UTC date parts of the calendar ymd).
 * @param {string} ymd
 * @returns {number}
 */
export function isoWeekNumber(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * @param {string} todayYmd
 * @param {string} timeZone
 * @returns {boolean}
 */
export function isMondayInTz(todayYmd, timeZone) {
  return partsInTz(todayYmd, timeZone).weekday === "Mon";
}

/**
 * @param {string} todayYmd
 * @param {string[]} showDates
 * @returns {boolean}
 */
export function isShowWeek(todayYmd, showDates) {
  const start = addDaysYmd(todayYmd, -7);
  const end = addDaysYmd(todayYmd, 7);
  return showDates.some((d) => d >= start && d <= end);
}

const VALID_GOALS = new Set([
  ...SHOW_WEEK_GOALS,
  ...OFF_TOUR_GOALS,
]);

/**
 * Machine line (not inside a fenced example): `current_override: picks_lock`
 * Empty / missing → null (use ISO-week rotation).
 * @param {string} md
 * @returns {string | null}
 */
export function parseOverrideFromOptimizeForMd(md) {
  for (const line of String(md).split(/\n/)) {
    const m = line.match(/^current_override:\s*(\S+)?\s*$/);
    if (!m) continue;
    const v = (m[1] || "").trim();
    if (!v) return null;
    if (!VALID_GOALS.has(v)) {
      throw new Error(
        `Invalid current_override "${v}". Valid: ${[...VALID_GOALS].join(", ")}`,
      );
    }
    return v;
  }
  return null;
}

/**
 * @param {{
 *   mode: 'auto' | 'weekly' | 'post_show',
 *   todayYmd: string,
 *   timeZone?: string,
 *   showDates: string[],
 *   override?: string | null,
 *   showDate?: string | null,
 * }} input
 * @returns {{
 *   action: 'kickoff' | 'skip',
 *   mode: 'weekly' | 'post_show' | null,
 *   optimize_for: string | null,
 *   window: string,
 *   showDate: string | null,
 *   reason: string,
 * }}
 */
export function resolveOptimizeKickoff({
  mode,
  todayYmd,
  timeZone = "America/Denver",
  showDates,
  override = null,
  showDate = null,
}) {
  const yesterday = addDaysYmd(todayYmd, -1);
  const yesterdayWasShow = showDates.includes(yesterday);

  if (mode === "post_show" || (mode === "auto" && yesterdayWasShow)) {
    const night = showDate || yesterday;
    if (!showDates.includes(night) && mode === "post_show" && showDate) {
      // Allow explicit --show-date even if not in fallback list.
    } else if (mode === "auto" && !yesterdayWasShow) {
      return {
        action: "skip",
        mode: null,
        optimize_for: null,
        window: "last_7_days",
        showDate: null,
        reason: "auto: yesterday was not a show date",
      };
    }
    return {
      action: "kickoff",
      mode: "post_show",
      optimize_for: "show_recap_uniqueness",
      window: "last_7_days",
      showDate: night,
      reason: `post_show after ${night}`,
    };
  }

  if (mode === "weekly" || mode === "auto") {
    if (mode === "auto" && !isMondayInTz(todayYmd, timeZone)) {
      return {
        action: "skip",
        mode: null,
        optimize_for: null,
        window: "last_7_days",
        showDate: null,
        reason: "auto: not Monday and no post-show",
      };
    }

    if (override) {
      return {
        action: "kickoff",
        mode: "weekly",
        optimize_for: override,
        window: "last_7_days",
        showDate: null,
        reason: `weekly override=${override}`,
      };
    }

    const week = isoWeekNumber(todayYmd);
    const onTour = isShowWeek(todayYmd, showDates);
    const optimize_for = onTour
      ? SHOW_WEEK_GOALS[week % SHOW_WEEK_GOALS.length]
      : OFF_TOUR_GOALS[week % OFF_TOUR_GOALS.length];

    return {
      action: "kickoff",
      mode: "weekly",
      optimize_for,
      window: "last_7_days",
      showDate: null,
      reason: onTour
        ? `weekly show-week isoWeek=${week} → ${optimize_for}`
        : `weekly off-tour isoWeek=${week} → ${optimize_for}`,
    };
  }

  return {
    action: "skip",
    mode: null,
    optimize_for: null,
    window: "last_7_days",
    showDate: null,
    reason: `unknown mode ${mode}`,
  };
}

/**
 * @param {{
 *   optimize_for: string,
 *   window: string,
 *   mode: string,
 *   showDate?: string | null,
 *   reason: string,
 *   runDate: string,
 * }} p
 */
export function buildKickoffMarkdown(p) {
  const showLine = p.showDate
    ? `\n**Show date (narrative QA):** \`${p.showDate}\` — follow [#779](https://github.com/pat792/set-picks/issues/779) sample-render checklist when available.`
    : "";

  const agentPrompt = `Using docs/comms-triggers/OPTIMIZE_AUTONOMY.md, docs/comms-triggers/optimize_for.md, and the comms squad skills (comms-orchestration-lead → analyst → triggers → drafter → architect),
run Optimize for goal ${p.optimize_for} covering ${p.window} (GA4 property 527619709)${
    p.showDate ? ` with night context for show ${p.showDate}` : ""
  }.
Produce the PM review pack template, post it on GitHub issue #573,
open a draft PR to staging only if a low-risk copy/catalog change is justified,
and never merge or deploy.`;

  return `## Scheduled Optimize kickoff — ${p.runDate}

**Epic:** #573 · **Scheduler:** #778  
**Mode:** \`${p.mode}\`  
**optimize_for:** \`${p.optimize_for}\`  
**Window:** \`${p.window}\`  
**Reason:** ${p.reason}${showLine}

### Agent prompt (Cloud Agent / Cursor)

\`\`\`text
${agentPrompt}
\`\`\`

### Pipeline reminder

1. GA4 snapshot (recipe \`crew/knowledge/optimize_snapshot_recipe.md\` §§A–C)
2. Leadership \`crew\` optimize → \`SQUAD_KICKOFF\`
3. Cursor squad: analyst → triggers → drafter → architect
4. Pack comment on this epic; draft PR only when justified
5. Never merge / never \`comms:deploy\`

### Scored next action (fill after run)

- [ ] \`DRAFT_PR\` / \`WAIT_EVIDENCE\` / \`CATALOG_HOLD\` / \`MEASUREMENT_ONLY\`
`;
}

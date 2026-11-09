/**
 * Summer Tour 2026 non-opener reminder (#512 Slice B).
 *
 * Editorial draft: `content/comms/lifecycle/summer-tour-2026-reminder.md`
 * Server render: `functions/commsTemplates.js` (`summer-tour-2026-reminder`).
 */

export const SUMMER_TOUR_2026_REMINDER_TEMPLATE_ID = 'summer-tour-2026-reminder';
export const SUMMER_TOUR_2026_REMINDER_TRIGGER_ID = 'marketing_summer_tour_2026_reminder';
export const SUMMER_TOUR_2026_REMINDER_CAMPAIGN_ID = 'summer_tour_2026_reminder';
export const SUMMER_TOUR_2026_REMINDER_PARENT_CAMPAIGN_ID = 'summer_tour_2026';
export const SUMMER_TOUR_2026_REMINDER_SUBJECT =
  'Your six slots for Summer Tour are still open';
export const SUMMER_TOUR_2026_REMINDER_WAIT_HOURS = 48;

/**
 * @param {string | undefined | null} handle
 * @returns {string}
 */
export function reminderGreetingFromHandle(handle) {
  const trimmed = typeof handle === 'string' ? handle.trim() : '';
  return trimmed || 'friend';
}

/**
 * Body paragraphs. Keep in sync with the functions template builder.
 *
 * @param {{ greetingName?: string, openerLabel?: string }} [input]
 * @returns {string[]}
 */
export function buildSummerTour2026ReminderParagraphs(input = {}) {
  const name = reminderGreetingFromHandle(input.greetingName);
  const opener =
    typeof input.openerLabel === 'string' && input.openerLabel.trim()
      ? input.openerLabel.trim()
      : 'Tuesday, July 7';
  return [
    `${name}, the first note about Summer Tour might still be sitting unopened.`,
    `The opener is ${opener}. Six slots a night: openers, closers, encore, and a wildcard. Lock them before the lights go down.`,
  ];
}

import { describe, expect, it } from 'vitest';
import {
  SUMMER_TOUR_2026_REMINDER_CAMPAIGN_ID,
  SUMMER_TOUR_2026_REMINDER_PARENT_CAMPAIGN_ID,
  SUMMER_TOUR_2026_REMINDER_SUBJECT,
  SUMMER_TOUR_2026_REMINDER_TEMPLATE_ID,
  SUMMER_TOUR_2026_REMINDER_TRIGGER_ID,
  SUMMER_TOUR_2026_REMINDER_WAIT_HOURS,
  buildSummerTour2026ReminderParagraphs,
  reminderGreetingFromHandle,
} from './summerTour2026Reminder.js';

describe('summerTour2026Reminder', () => {
  it('exports stable ids that do not reuse the launch campaign', () => {
    expect(SUMMER_TOUR_2026_REMINDER_TEMPLATE_ID).toBe('summer-tour-2026-reminder');
    expect(SUMMER_TOUR_2026_REMINDER_TRIGGER_ID).toBe('marketing_summer_tour_2026_reminder');
    expect(SUMMER_TOUR_2026_REMINDER_CAMPAIGN_ID).toBe('summer_tour_2026_reminder');
    expect(SUMMER_TOUR_2026_REMINDER_PARENT_CAMPAIGN_ID).toBe('summer_tour_2026');
    expect(SUMMER_TOUR_2026_REMINDER_CAMPAIGN_ID).not.toBe(
      SUMMER_TOUR_2026_REMINDER_PARENT_CAMPAIGN_ID,
    );
    expect(SUMMER_TOUR_2026_REMINDER_WAIT_HOURS).toBe(48);
  });

  it('falls back to friend and talks about slots', () => {
    expect(reminderGreetingFromHandle('')).toBe('friend');
    expect(reminderGreetingFromHandle('  HotDog Billy  ')).toBe('HotDog Billy');
    const paragraphs = buildSummerTour2026ReminderParagraphs({
      greetingName: 'Picker1',
      openerLabel: 'Tuesday, July 7',
    });
    const text = paragraphs.join('\n');
    expect(SUMMER_TOUR_2026_REMINDER_SUBJECT).toBe(
      'Your six slots for Summer Tour are still open',
    );
    expect(text).toContain('Picker1, the first note about Summer Tour might still be sitting unopened.');
    expect(text).toContain('Six slots a night: openers, closers, encore, and a wildcard.');
    expect(text.toLowerCase()).not.toContain('chair');
  });
});

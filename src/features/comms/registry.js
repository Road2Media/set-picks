/**
 * Comms template registry — which recap/messaging editions exist and which channels they support.
 * Use this for orchestration (FCM topics, email ESP selection, in-app routing) without importing
 * every implementation up front. See GitHub #272 for push/in-app/email epic.
 *
 * Editorial drafts live under `content/comms/` at repo root; runtime copy stays in feature `model/`
 * modules until a loader is introduced.
 */

import { ANNUAL_WRAP_TEMPLATE_ID, SPHERE_2026_RECAP_ID, TOUR_RECAP_TEMPLATE_ID } from '../tour-recap';
import {
  SUMMER_TOUR_2026_LAUNCH_TEMPLATE_ID,
} from '../marketing-comms/model/summerTour2026Launch.js';

/**
 * @typedef {'inApp' | 'emailAbbreviated' | 'emailFull' | 'push'} CommsChannel
 */

/** Declared channels for type hints and future UI toggles. */
export const COMMS_CHANNELS = /** @type {const} */ ([
  'inApp',
  'emailAbbreviated',
  'emailFull',
  'push',
]);

/**
 * @typedef {object} RecapTemplateDefinition
 * @property {'tour' | 'show' | 'broadcast'} kind
 * @property {string} displayName
 * @property {string} sourceDraftPath Repo-relative Markdown for editors / agents.
 * @property {string} implementationModule Runtime module path (authoritative copy + builders).
 * @property {CommsChannel[]} supportedChannels
 */

/** @type {Record<string, RecapTemplateDefinition>} */
export const RECAP_TEMPLATE_REGISTRY = {
  [ANNUAL_WRAP_TEMPLATE_ID]: {
    kind: 'tour',
    displayName: "Annual wrap — personalized end-of-year note",
    sourceDraftPath: 'content/comms/tours/annual-wrap.md',
    implementationModule: 'src/features/tour-recap/model/annualWrap.js',
    supportedChannels: ['inApp', 'emailAbbreviated', 'emailFull', 'push'],
  },
  [TOUR_RECAP_TEMPLATE_ID]: {
    kind: 'tour',
    displayName: "Tour recap — personalized end-of-tour wrap-up",
    sourceDraftPath: 'content/comms/tours/tour-recap.md',
    implementationModule: 'src/features/tour-recap/model/tourRecap.js',
    supportedChannels: ['inApp', 'emailAbbreviated', 'emailFull', 'push'],
  },
  // Historical edition archive — not the live catalog trigger (#510).
  [SPHERE_2026_RECAP_ID]: {
    kind: 'tour',
    displayName: "Sphere 2026 — inaugural Setlist Pick'em recap (archive / replay)",
    sourceDraftPath: 'content/comms/tours/sphere-2026-inaugural.md',
    implementationModule: 'src/features/tour-recap/model/sphere2026Recap.js',
    supportedChannels: ['inApp', 'emailAbbreviated', 'emailFull', 'push'],
  },
  [SUMMER_TOUR_2026_LAUNCH_TEMPLATE_ID]: {
    kind: 'broadcast',
    displayName: 'Summer Tour 2026 — pre-opener marketing launch',
    sourceDraftPath: 'content/comms/lifecycle/summer-tour-2026-launch.md',
    implementationModule: 'src/features/marketing-comms/model/summerTour2026Launch.js',
    supportedChannels: ['emailFull'],
  },
};

/**
 * @param {string} templateId
 * @returns {RecapTemplateDefinition | undefined}
 */
export function getRecapTemplateDefinition(templateId) {
  return RECAP_TEMPLATE_REGISTRY[templateId];
}

/**
 * @param {string} templateId
 * @param {CommsChannel} channel
 */
export function recapTemplateSupportsChannel(templateId, channel) {
  const def = getRecapTemplateDefinition(templateId);
  if (!def) return false;
  return def.supportedChannels.includes(channel);
}

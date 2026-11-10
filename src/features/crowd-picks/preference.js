/**
 * Public secondary barrel for the hide-crowd preference (#694).
 * Account settings import this instead of the crowd-picks root barrel
 * so the preferences route does not pull the night panels.
 */
export {
  CROWD_PULSE_SURFACES,
  isCrowdPulseSurfaceEnabled,
  resolveHideCrowdPulse,
} from './model/crowdPulsePreference';
export { useHideCrowdPulse } from './model/useHideCrowdPulse';
export { default as HideCrowdPulsePreference } from './ui/HideCrowdPulsePreference';
export { default as CrowdPulseHiddenNotice } from './ui/CrowdPulseHiddenNotice';

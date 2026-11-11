import { useState } from 'react';

import { AD_PREFERENCES_SECTION_ID } from '../adPreferencesPath';
import { useAdConsent } from '../model/useAdConsent';

const RADIO_CLASS = 'mt-1 h-4 w-4 shrink-0 border-border-muted/60 text-brand-primary focus:ring-brand-primary';

/**
 * Account → Preferences. Saves a browser choice for a future ad script.
 * With no CMP configured, allow does not load a partner.
 *
 * @returns {import('react').ReactElement}
 */
export default function AdPreferencesSection() {
  const {
    choice,
    advertisingAllowed,
    cmpEnabled,
    setAdvertisingChoice,
    openPartnerPreferences,
  } = useAdConsent();
  const [partnerNote, setPartnerNote] = useState('');

  const onPartnerClick = () => {
    const result = openPartnerPreferences();
    setPartnerNote(
      result.opened
        ? 'The ad partner window is open.'
        : 'The ad partner window is not available in this browser yet.',
    );
  };

  return (
    <section id={AD_PREFERENCES_SECTION_ID} className="mt-10 border-t border-border-muted/60 pt-8">
      <p className="mb-1 text-xs font-black uppercase tracking-widest text-content-secondary">
        Ad preferences
      </p>
      <p className="mb-6 text-sm font-bold leading-relaxed text-content-secondary">
        Choose whether a future advertising script may load on this browser.
        The choice stays on this device. Sign-in, your picks, and analytics
        stay as they are.
      </p>
      <fieldset className="space-y-4">
        <legend className="sr-only">Third-party ads</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="third-party-ads"
            value="denied"
            className={RADIO_CLASS}
            checked={choice !== 'granted'}
            onChange={() => setAdvertisingChoice('denied')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-black text-white">Keep third-party ads off</span>
            <span className="mt-1 block text-xs font-bold leading-relaxed text-content-secondary">
              An advertising script cannot load. This is the default.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="third-party-ads"
            value="granted"
            className={RADIO_CLASS}
            checked={choice === 'granted'}
            onChange={() => setAdvertisingChoice('granted')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-black text-white">Allow third-party ads later</span>
            <span className="mt-1 block text-xs font-bold leading-relaxed text-content-secondary">
              {cmpEnabled
                ? 'Saves an allow on this browser. An advertising script still waits until the partner window allows it.'
                : 'Saves an allow on this browser. No ad network is connected, so nothing new loads.'}
            </span>
          </span>
        </label>
      </fieldset>
      <p className="mt-4 text-xs font-bold leading-relaxed text-content-secondary" role="status">
        {advertisingAllowed
          ? 'Advertising scripts are allowed on this browser.'
          : 'Advertising scripts are off.'}
      </p>
      {cmpEnabled ? (
        <button
          type="button"
          onClick={onPartnerClick}
          className="mt-3 text-xs font-bold text-content-secondary underline decoration-border-muted/60 underline-offset-2 transition-colors hover:text-white"
        >
          Open the ad partner&apos;s choices
        </button>
      ) : (
        <p className="mt-2 text-xs font-bold leading-relaxed text-content-secondary">
          No ad partner is connected, so there is no partner window to reopen.
        </p>
      )}
      {partnerNote ? (
        <p className="mt-2 text-xs font-bold text-content-secondary" role="status">
          {partnerNote}
        </p>
      ) : null}
    </section>
  );
}

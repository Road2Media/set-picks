import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const visible = vi.hoisted(() => ({ current: false }));

vi.mock('../../ads/model/useAdPreferencesVisible', () => ({
  useAdPreferencesVisible: () => visible.current,
}));

vi.mock('../../auth', () => ({
  useSignOut: () => async () => {},
}));

vi.mock('../../crowd-picks/preference', () => ({
  HideCrowdPulsePreference: () => null,
}));

vi.mock('../../notifications', () => ({
  NotificationPrefsPanel: () => null,
}));

vi.mock('../../install', () => ({
  InstallAppCard: () => null,
  isInstalled: () => false,
}));

vi.mock('./AccountSecurity', () => ({
  default: () => null,
}));

vi.mock('./DeleteAccountSection', () => ({
  default: () => null,
}));

import { AD_PREFERENCES_SECTION_ID } from '../../ads/adPreferencesPath';
import AccountPreferencesScreen from './AccountPreferencesScreen';

function renderScreen() {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AccountPreferencesScreen, {
        user: { uid: 'player' },
      }),
    ),
  );
}

describe('AccountPreferencesScreen ad preferences', () => {
  beforeEach(() => {
    visible.current = false;
  });

  it('does not render Ad preferences with the default gate', () => {
    const html = renderScreen();
    expect(html).not.toContain('Ad preferences');
    expect(html).not.toContain(AD_PREFERENCES_SECTION_ID);
    expect(html).not.toContain('Keep third-party ads off');
    expect(html).toContain('Privacy');
    expect(html).toContain('Terms');
    expect(html).toContain('Notifications');
  });

  it('renders Ad preferences when ads are enabled', () => {
    visible.current = true;
    const html = renderScreen();
    expect(html).toContain(`id="${AD_PREFERENCES_SECTION_ID}"`);
    expect(html).toContain('Ad preferences');
    expect(html).toContain('Keep third-party ads off');
    expect(html).toContain('href="/dashboard/profile/account#ad-preferences"');
  });
});

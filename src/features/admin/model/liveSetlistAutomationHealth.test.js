import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminLiveSetlistAutomationControls from '../ui/AdminLiveSetlistAutomationControls.jsx';
import {
  deriveAutomationHealth,
  listenWarRoomAutomation,
  resolveWarRoomPlayerStatus,
  truncateAutomationError,
} from './liveSetlistAutomationHealth';

describe('live setlist automation health (#644)', () => {
  it('distinguishes paused, backing off, recovered, and healthy', () => {
    expect(deriveAutomationHealth(null)).toBe('Paused');
    expect(deriveAutomationHealth({ enabled: false, failureCount: 0 })).toBe('Paused');
    expect(
      deriveAutomationHealth({ enabled: true, failureCount: 3, lastResult: 'error' }),
    ).toBe('Backing off');
    expect(
      deriveAutomationHealth({
        enabled: true,
        failureCount: 0,
        lastResult: 'changed',
        recoveredAt: { seconds: 1 },
      }),
    ).toBe('Recovered');
    expect(
      deriveAutomationHealth({ enabled: true, failureCount: 0, lastResult: 'no-change' }),
    ).toBe('Healthy');
  });

  it('truncates operational errors for display', () => {
    expect(truncateAutomationError('  HTTP 403:  <b>nope</b>  ')).toBe(
      'HTTP 403: <b>nope</b>',
    );
    expect(truncateAutomationError('x'.repeat(200)).endsWith('…')).toBe(true);
    expect(truncateAutomationError('')).toBe('');
  });
});

function panelMarkup(status) {
  const banner = resolveWarRoomPlayerStatus(status);
  return renderToStaticMarkup(
    createElement(AdminLiveSetlistAutomationControls, {
      enabled: true,
      isToggling: false,
      isPolling: false,
      isPublishing: false,
      statusText: '',
      errorText: '',
      health: '—',
      lastResult: '—',
      failureCount: 0,
      lastError: '',
      lastPolledAt: '—',
      nextPollAt: '—',
      lastSuccessfulPollMode: '',
      messageKey: 'phishnet_stalled',
      messageChoices: [{ key: 'phishnet_stalled', label: 'Delayed' }],
      clearOnRecovery: false,
      bannerVisible: banner.bannerVisible,
      bannerActivatedBy: banner.bannerActivatedBy,
      onToggle: () => {},
      onPollNow: () => {},
      onMessageKey: () => {},
      onClearOnRecovery: () => {},
      onPublishBanner: () => {},
      onClearBanner: () => {},
    }),
  );
}

describe('War Room player status listen (#644)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the banner when the status doc is missing, denied, or missing fields', () => {
    expect(resolveWarRoomPlayerStatus(null)).toEqual({
      playerStatus: null,
      bannerVisible: false,
      bannerActivatedBy: '',
    });
    expect(resolveWarRoomPlayerStatus(undefined).bannerVisible).toBe(false);
    expect(
      resolveWarRoomPlayerStatus({
        status: undefined,
        messageKey: undefined,
        resolvedAt: undefined,
        activatedBy: undefined,
      }),
    ).toMatchObject({ bannerVisible: false, bannerActivatedBy: '' });
    expect(resolveWarRoomPlayerStatus([]).playerStatus).toBeNull();
  });

  it('still shows a real degraded projection', () => {
    expect(
      resolveWarRoomPlayerStatus({
        status: 'degraded',
        messageKey: 'phishnet_stalled',
        activatedBy: 'admin',
      }),
    ).toMatchObject({ bannerVisible: true, bannerActivatedBy: 'manual' });
  });

  it('keeps the War Room listener from throwing on a missing or denied status doc', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const statuses = [];
    const errors = [];
    const denied = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    const stop = listenWarRoomAutomation({
      showDate: '2026-07-17',
      subscribeAutomation: (_showDate, onChange) => {
        onChange(null);
        return () => {
          throw new Error('automation unsubscribe failed');
        };
      },
      subscribeStatus: (_showDate, onChange, onError) => {
        onChange(null);
        onChange({
          status: undefined,
          messageKey: undefined,
        });
        onError(denied);
        return () => {};
      },
      onAutomation: () => {},
      onAutomationError: (error) => {
        errors.push(error);
      },
      onPlayerStatus: (status) => {
        statuses.push(status);
      },
    });

    expect(statuses).toEqual([
      null,
      { status: undefined, messageKey: undefined },
      null,
    ]);
    expect(errors).toEqual([]);
    expect(panelMarkup(null)).toContain('Player banner');
    expect(panelMarkup(null)).toContain('Hidden');
    expect(panelMarkup({ status: undefined, messageKey: undefined })).toContain('Hidden');
    expect(() => stop()).not.toThrow();
  });

  it('reports a subscribe failure as an empty banner instead of throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const statuses = [];
    const errors = [];
    const stop = listenWarRoomAutomation({
      showDate: '2026-07-17',
      subscribeAutomation: () => () => {},
      subscribeStatus: () => {
        throw Object.assign(new Error('Missing or insufficient permissions.'), {
          code: 'permission-denied',
        });
      },
      onAutomation: () => {},
      onAutomationError: (error) => errors.push(error),
      onPlayerStatus: (status) => statuses.push(status),
    });

    expect(statuses).toEqual([null]);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('permission-denied');
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });
});

describe('War Room setlist form effect (#644)', () => {
  it('does not call the removed automation setters that unmounted the page', () => {
    const source = readFileSync(new URL('./useAdminSetlistForm.js', import.meta.url), 'utf8');
    expect(source.includes('setAutomationStatus')).toBe(false);
    expect(source.includes('setAutomationError')).toBe(false);
  });
});
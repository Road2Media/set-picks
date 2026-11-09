import { afterEach, describe, expect, it, vi } from 'vitest';

const initialize = vi.fn();
const send = vi.fn();
const event = vi.fn();

vi.mock('react-ga4', () => ({
  default: {
    initialize,
    send,
    event,
  },
}));

async function freshGa4() {
  vi.resetModules();
  return import('./ga4.js');
}

afterEach(() => {
  initialize.mockClear();
  send.mockClear();
  event.mockClear();
  vi.unstubAllEnvs();
  delete globalThis.window;
});

describe('ga4 queue (#733)', () => {
  it('drops queued hits when the host is not production', async () => {
    const ga = await freshGa4();
    ga.ga4SendPageView('/invite/pat');
    ga.ga4Event('invite_share', { invite_kind: 'site' });
    await expect(ga.initGa4()).resolves.toBe(false);
    expect(ga.ga4IsReady()).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
    ga.ga4Event('later', { invite_kind: 'site' });
    expect(event).not.toHaveBeenCalled();
  });

  it('flushes the latest pageview and queued events after the library loads', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST');
    globalThis.window = { location: { hostname: 'www.setlistpickem.com' } };
    const ga = await freshGa4();
    ga.ga4SendPageView('/join/OLD');
    ga.ga4SendPageView('/invite/pat');
    ga.ga4Event('invite_share', { invite_kind: 'site' });
    expect(ga.ga4IsReady()).toBe(false);
    await expect(ga.initGa4()).resolves.toBe(true);
    expect(initialize).toHaveBeenCalledWith('G-TEST');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ hitType: 'pageview', page: '/invite/pat' });
    expect(event).toHaveBeenCalledWith('invite_share', { invite_kind: 'site' });
    expect(ga.ga4IsReady()).toBe(true);
  });

  it('dedupes an immediate repeat after init', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST');
    globalThis.window = { location: { hostname: 'setlistpickem.com' } };
    const ga = await freshGa4();
    await ga.initGa4();
    ga.ga4Event('invite_share', { invite_kind: 'pool' });
    ga.ga4Event('invite_share', { invite_kind: 'pool' });
    expect(event).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeAdImpression } from './observeAdImpression';

class FakeObserver {
  static latest = null;

  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.disconnected = false;
    FakeObserver.latest = this;
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }

  emit(ratio) {
    this.callback([
      {
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
      },
    ]);
  }
}

describe('observeAdImpression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IntersectionObserver = FakeObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.IntersectionObserver;
    FakeObserver.latest = null;
  });

  it('fires once after the unit stays half visible for 1s', () => {
    const onImpression = vi.fn();
    observeAdImpression({}, { onImpression });
    expect(FakeObserver.latest.options.threshold).toEqual([0, 0.5, 1]);

    FakeObserver.latest.emit(0.5);
    vi.advanceTimersByTime(999);
    expect(onImpression).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(FakeObserver.latest.disconnected).toBe(true);

    FakeObserver.latest.emit(1);
    vi.advanceTimersByTime(2000);
    expect(onImpression).toHaveBeenCalledTimes(1);
  });

  it('does not fire when less than half of the unit is visible', () => {
    const onImpression = vi.fn();
    observeAdImpression({}, { onImpression });
    FakeObserver.latest.emit(0.49);
    vi.advanceTimersByTime(2000);
    expect(onImpression).not.toHaveBeenCalled();
  });

  it('cancels the dwell when the unit scrolls away', () => {
    const onImpression = vi.fn();
    observeAdImpression({}, { onImpression });
    FakeObserver.latest.emit(0.8);
    vi.advanceTimersByTime(500);
    FakeObserver.latest.emit(0);
    vi.advanceTimersByTime(1000);
    expect(onImpression).not.toHaveBeenCalled();
  });

  it('cleanup drops a pending dwell', () => {
    const onImpression = vi.fn();
    const stop = observeAdImpression({}, { onImpression });
    FakeObserver.latest.emit(1);
    stop();
    vi.advanceTimersByTime(2000);
    expect(onImpression).not.toHaveBeenCalled();
    expect(FakeObserver.latest.disconnected).toBe(true);
  });
});

import React from 'react';

import Card from '../../../shared/ui/Card';

/** Dark shell while `VITE_ENABLE_REWIND_MODE` is not `true`. */
export default function RewindComingSoon() {
  return (
    <Card variant="venue" padding="md">
      <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
        Rewind
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold text-content-primary">
        Rewind is not open yet
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-content-secondary">
        One past show a week, same six slots, scored on its own board. It does
        not change live standings. Turn it on with{' '}
        <span className="font-semibold text-content-primary">VITE_ENABLE_REWIND_MODE=true</span>{' '}
        and a fresh build.
      </p>
    </Card>
  );
}

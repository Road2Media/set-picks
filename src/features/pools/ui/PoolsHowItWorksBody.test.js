import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PoolsHowItWorksBody from './PoolsHowItWorksBody.jsx';

describe('PoolsHowItWorksBody', () => {
  it('frames the in-flow panel by default', () => {
    const html = renderToStaticMarkup(React.createElement(PoolsHowItWorksBody));
    expect(html).toContain('private group');
    expect(html).toContain('bg-surface-panel-strong/72');
  });

  it('omits the panel chrome inside the modal', () => {
    const html = renderToStaticMarkup(
      React.createElement(PoolsHowItWorksBody, { framed: false }),
    );
    expect(html).toContain('Invite Friends');
    expect(html).not.toContain('bg-surface-panel-strong/72');
  });
});

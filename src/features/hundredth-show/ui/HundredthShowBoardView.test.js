import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import HundredthShowBoardView from './HundredthShowBoardView.jsx';

function render(props) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(HundredthShowBoardView, props),
    ),
  );
}

describe('HundredthShowBoardView privacy (#1147)', () => {
  it('renders handles and drops emails and private fields', () => {
    const html = render({
      mode: 'production',
      rows: [
        {
          rank: 1,
          handle: 'Fan Handle',
          points: 42,
          exactSlots: 3,
          email: 'fan@example.com',
          uid: 'uid-secret',
          userId: 'uid-secret',
          photoURL: 'https://cdn.example/secret.jpg',
          notificationPrefs: { email: { results: true } },
        },
        {
          rank: 2,
          handle: 'hidden@example.com',
          points: 10,
          exactSlots: 1,
          email: 'hidden@example.com',
        },
      ],
    });
    expect(html).toContain('Fan Handle');
    expect(html).toContain('42 points');
    expect(html).toContain('3 exact slots');
    expect(html).not.toContain('fan@example.com');
    expect(html).not.toContain('hidden@example.com');
    expect(html).not.toContain('uid-secret');
    expect(html).not.toContain('secret.jpg');
    expect(html).not.toContain('notificationPrefs');
    expect(html.toLowerCase()).not.toContain('chair');
  });

  it('keeps a staging dry run off the production date', () => {
    const html = render({
      mode: 'staging',
      search: '?dryRunDate=2026-07-29',
      rows: [],
    });
    expect(html).toContain('2026-07-29');
    expect(html).toContain('Sample Slot');
    expect(html).toContain('Production stays on January 2, 2027');
    expect(html.toLowerCase()).not.toContain('chair');
    expect(html).not.toContain('@');
  });

  it('ignores a dry-run date in production', () => {
    const html = render({
      mode: 'production',
      search: '?dryRunDate=2026-07-29',
      rows: [],
      loaded: true,
    });
    expect(html).not.toContain('Sample Slot');
    expect(html).not.toContain('2026-07-29');
    expect(html).toContain('Email addresses stay off this page');
  });
});

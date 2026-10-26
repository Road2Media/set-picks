import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import StandingsPlayerAvatar from './StandingsPlayerAvatar.jsx';

function markup(props) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(StandingsPlayerAvatar, props),
    ),
  );
}

describe('StandingsPlayerAvatar add affordance (#643)', () => {
  it('links your own unset row to Profile with a dashed add control', () => {
    const html = markup({ avatarId: null, isSelf: true, handle: 'Pat' });
    expect(html).toContain('aria-label="Add a profile avatar"');
    expect(html).toContain('href="/dashboard/profile"');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('/avatars/ticket.svg');
  });

  it('renders the ticket mark when ticket was explicitly chosen', () => {
    const html = markup({ avatarId: 'ticket', isSelf: true, handle: 'Pat' });
    expect(html).not.toContain('Add a profile avatar');
    expect(html).toContain('/avatars/ticket.svg');
    expect(html).toContain('alt="Pat&#x27;s avatar"');
  });

  it('uses an initial chip for someone else who has not picked an avatar', () => {
    const html = markup({ avatarId: null, isSelf: false, handle: 'Pat' });
    expect(html).not.toContain('Add a profile avatar');
    expect(html).not.toContain('/avatars/ticket.svg');
    expect(html).toContain('>P<');
  });
});
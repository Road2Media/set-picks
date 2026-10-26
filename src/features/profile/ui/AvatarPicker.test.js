import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AvatarPicker from './AvatarPicker.jsx';

function markup(props) {
  return renderToStaticMarkup(
    createElement(AvatarPicker, {
      value: null,
      onChange: () => {},
      ...props,
    }),
  );
}

describe('AvatarPicker unset vs ticket (#643)', () => {
  it('shows no selected radio and a dashed placeholder when avatarId is unset', () => {
    const html = markup({ value: null });
    expect(html).toContain('No avatar selected');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('aria-checked="true"');
    expect(html).not.toContain('alt="Ticket stub"');
    expect(html).not.toContain('ring-brand-primary');
  });

  it('does not claim the avatar is unset while the profile is still loading', () => {
    const html = markup({ value: null, pending: true });
    expect(html).not.toContain('No avatar selected');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('aria-checked="true"');
  });

  it('marks ticket selected only when the value is ticket', () => {
    const html = markup({ value: 'ticket' });
    expect(html).not.toContain('No avatar selected');
    expect(html).toContain('alt="Ticket stub"');
    expect(html).toContain('aria-label="Ticket stub"');
    expect(html).toContain('aria-checked="true"');
    expect(html.split('aria-checked="true"').length - 1).toBe(1);
    expect(html).toContain('ring-brand-primary');
  });
});

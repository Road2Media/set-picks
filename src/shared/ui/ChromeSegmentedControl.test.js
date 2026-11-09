import { describe, expect, it } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';

import ChromeSegmentedControl from './ChromeSegmentedControl.jsx';

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe('ChromeSegmentedControl (#765 tertiary chrome)', () => {
  it('renders an equal-width tablist with active ring/fill and aria', () => {
    const html = renderToStaticMarkup(
      React.createElement(ChromeSegmentedControl, {
        ariaLabel: 'Standings view',
        value: 'tour',
        items: [
          { id: 'show', label: 'Show' },
          { id: 'tour', label: 'Tour' },
          { id: 'stats', label: 'Stats' },
          { id: 'pools', label: 'Pools' },
        ],
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Standings view"');
    expect(count(html, 'role="tab"')).toBe(4);
    expect(count(html, 'aria-selected="true"')).toBe(1);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('flex-1');
    expect(count(html, 'flex-1')).toBe(4);
    expect(html).toContain('uppercase');
    expect(html).toContain('ring-brand-primary/35');
    expect(html).toContain('bg-brand-primary/15');
    expect(html).not.toContain('rounded-full');
    expect(html).toContain('Show');
    expect(html).toContain('Tour');
    expect(html).toContain('Stats');
    expect(html).toContain('Pools');
  });

  it('still renders a tablist when scrollToTop is disabled (in-page trays)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ChromeSegmentedControl, {
        ariaLabel: 'Personal stats scope',
        value: 'allTime',
        scrollToTop: false,
        items: [
          { id: 'allTime', label: 'All-time' },
          { id: 'tour', label: 'This tour' },
        ],
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('All-time');
    expect(html).toContain('This tour');
    expect(html).toContain('shadow-inset-glass');
  });

  it('wrap layout sizes each label instead of forcing one equal row', () => {
    const html = renderToStaticMarkup(
      React.createElement(ChromeSegmentedControl, {
        ariaLabel: 'Global ranking board',
        value: 'averageVintage',
        scrollToTop: false,
        tone: 'inset',
        layout: 'wrap',
        items: [
          { id: 'pointsPerShow', label: 'PPS' },
          { id: 'pickingAverage', label: 'Picking Avg' },
          { id: 'sluggingPercentage', label: 'SLG' },
          { id: 'averageVintage', label: 'Vintage' },
          { id: 'bustoutBoosts', label: 'Bustout' },
        ],
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('flex-wrap');
    expect(count(html, 'flex-1')).toBe(0);
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('Vintage');
    expect(html).toContain('Bustout');
  });

  it('inset tone keeps the equal-width tray without chrome glass + brand ring', () => {
    const html = renderToStaticMarkup(
      React.createElement(ChromeSegmentedControl, {
        ariaLabel: 'Global ranking board',
        value: 'shows',
        scrollToTop: false,
        tone: 'inset',
        items: [
          { id: 'pointsPerShow', label: 'PPS' },
          { id: 'pickingAverage', label: 'Picking Avg' },
          { id: 'shows', label: 'Shows' },
        ],
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(count(html, 'flex-1')).toBe(3);
    expect(html).toContain('bg-surface-field');
    expect(html).toContain('bg-surface-panel-strong');
    expect(html).not.toContain('shadow-inset-glass');
    expect(html).not.toContain('ring-brand-primary/35');
    expect(html).not.toContain('bg-brand-primary/15');
  });

  it('renders a nav of equal-width NavLinks for route clusters', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/dashboard/profile'] },
        React.createElement(ChromeSegmentedControl, {
          ariaLabel: 'Account sections',
          items: [
            { to: '/dashboard/profile', label: 'Profile', end: true },
            {
              to: '/dashboard/profile/notifications',
              label: 'Messages',
              end: true,
            },
            { to: '/dashboard/profile/account', label: 'Preferences', end: true },
          ],
        }),
      ),
    );

    expect(html).toContain('aria-label="Account sections"');
    expect(html).toContain('<nav');
    expect(html).not.toContain('role="tablist"');
    expect(count(html, 'flex-1')).toBe(3);
    expect(html).toContain('uppercase');
    expect(html).toContain('ring-brand-primary/35');
    expect(html).toContain('Profile');
    expect(html).toContain('Messages');
    expect(html).toContain('Preferences');
  });
});

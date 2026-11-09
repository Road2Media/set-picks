'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildEmailTrackedCtaUrl,
  buildEmailClickRedirectUrl,
  normalizeDestinationPath,
} = require('./emailLinks.cjs');

describe('emailLinks', () => {
  it('buildEmailTrackedCtaUrl maps picks CTA to click host with trigger metadata', () => {
    const url = buildEmailTrackedCtaUrl('https://www.setlistpickem.com/dashboard/picks', {
      triggerId: 'picks_lock_reminder',
      templateId: 'picks-lock-reminder',
      cta: 'Make Your Picks',
    });
    assert.equal(
      url,
      'https://click.setlistpickem.com/dashboard/picks?tid=picks_lock_reminder&tpl=picks-lock-reminder&cta=Make+Your+Picks'
    );
  });

  it('buildEmailClickRedirectUrl adds UTM params on www', () => {
    const dest = buildEmailClickRedirectUrl('/dashboard/picks', {
      tid: 'picks_lock_reminder',
      tpl: 'picks-lock-reminder',
      cta: 'Make Your Picks',
    });
    const u = new URL(dest);
    assert.equal(u.hostname, 'www.setlistpickem.com');
    assert.equal(u.pathname, '/dashboard/picks');
    assert.equal(u.searchParams.get('utm_source'), 'email');
    assert.equal(u.searchParams.get('utm_medium'), 'comms');
    assert.equal(u.searchParams.get('utm_campaign'), 'picks_lock_reminder');
    assert.equal(u.searchParams.get('utm_content'), 'picks-lock-reminder');
    assert.equal(u.searchParams.get('utm_term'), 'Make Your Picks');
  });

  it('normalizeDestinationPath rejects external hosts', () => {
    assert.equal(normalizeDestinationPath('https://evil.example/phish'), null);
    assert.equal(normalizeDestinationPath('/dashboard/picks'), '/dashboard/picks');
  });

  it('normalizeDestinationPath allows /login /invite /setup (#830)', () => {
    assert.equal(normalizeDestinationPath('/login'), '/login');
    assert.equal(normalizeDestinationPath('/login?signup=1'), '/login?signup=1');
    assert.equal(normalizeDestinationPath('/invite/pat'), '/invite/pat');
    assert.equal(normalizeDestinationPath('/setup'), '/setup');
    assert.equal(normalizeDestinationPath('/how-scoring-changed'), '/how-scoring-changed');
  });
});

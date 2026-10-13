'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { fanDateBadge, formatFanShowDate } = require('./fanShowDate.cjs');

test('formatFanShowDate locks 2026-10-07 → 10/07/26', () => {
  assert.equal(formatFanShowDate('2026-10-07'), '10/07/26');
  assert.equal(formatFanShowDate(' 2026-07-10 '), '07/10/26');
});

test('fanDateBadge is empty unless the value is a storage date', () => {
  assert.equal(fanDateBadge('2026-10-07'), '10/07/26');
  assert.equal(fanDateBadge('Tonight'), '');
  assert.equal(fanDateBadge(''), '');
});

test('formatFanShowDate returns invalid input unchanged', () => {
  assert.equal(formatFanShowDate('nope'), 'nope');
  assert.equal(formatFanShowDate('2026-02-31'), '2026-02-31');
  assert.equal(formatFanShowDate('2026-10-7'), '2026-10-7');
  assert.equal(formatFanShowDate(''), '');
  assert.equal(formatFanShowDate(null), null);
});

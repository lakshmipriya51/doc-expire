'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STATUS,
  daysUntil,
  getExpiryStatus,
  humaniseRemaining,
  parseDateOnly,
  totalValidityDays,
} = require('../utils/expiry');
const { getReminder } = require('../utils/reminders');

test('parseDateOnly accepts valid dates and rejects impossible ones', () => {
  assert.equal(parseDateOnly('2025-01-31').toISOString(), '2025-01-31T00:00:00.000Z');
  assert.equal(parseDateOnly('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(parseDateOnly('2023-02-29'), null, 'non-leap year February 29 is invalid');
  assert.equal(parseDateOnly('2025-13-01'), null, 'month 13 is invalid');
  assert.equal(parseDateOnly('15-01-2025'), null, 'wrong format is rejected');
  assert.equal(parseDateOnly(''), null);
  assert.equal(parseDateOnly(undefined), null);
});

test('parseDateOnly normalises an ISO timestamp to its UTC calendar day', () => {
  // This is the shape a value takes after request-body sanitisation, so the
  // cross-field "expiry after issue" check depends on it being parseable.
  assert.equal(
    parseDateOnly('2026-12-16T00:00:00.000Z').toISOString(),
    '2026-12-16T00:00:00.000Z',
  );
  assert.equal(
    parseDateOnly('2026-12-16T23:45:00.000Z').toISOString(),
    '2026-12-16T00:00:00.000Z',
    'the time of day is discarded',
  );
  assert.equal(parseDateOnly(new Date('2026-12-16T12:00:00.000Z')).toISOString(), '2026-12-16T00:00:00.000Z');
  assert.equal(parseDateOnly('not-a-date'), null);
});

test('daysUntil is timezone stable and has no off-by-one error', () => {
  // Times that are late in the day in one timezone must still map to the
  // correct calendar day.
  assert.equal(daysUntil(parseDateOnly(dateOffset(0))), 0, 'today is 0 days away');
  assert.equal(daysUntil(parseDateOnly(dateOffset(1))), 1);
  assert.equal(daysUntil(parseDateOnly(dateOffset(-1))), -1);

  const lateToday = new Date(`${dateOffset(0)}T23:45:00.000Z`);
  assert.equal(daysUntil(lateToday), 0, 'a late-evening timestamp is still today');
  const earlyToday = new Date(`${dateOffset(0)}T00:05:00.000Z`);
  assert.equal(daysUntil(earlyToday), 0, 'an early-morning timestamp is still today');
});

test('getExpiryStatus classifies active, expiring soon and expired documents', () => {
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(200))).status, STATUS.ACTIVE);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(31))).status, STATUS.ACTIVE);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(30))).status, STATUS.EXPIRING_SOON);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(15))).status, STATUS.EXPIRING_SOON);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(1))).status, STATUS.EXPIRING_SOON);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(0))).status, STATUS.EXPIRING_SOON);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(-1))).status, STATUS.EXPIRED);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(-400))).status, STATUS.EXPIRED);
});

test('getExpiryStatus honours a custom expiring-soon window', () => {
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(20)), 10).status, STATUS.ACTIVE);
  assert.equal(getExpiryStatus(parseDateOnly(dateOffset(10)), 10).status, STATUS.EXPIRING_SOON);
});

test('humaniseRemaining produces user friendly labels', () => {
  assert.equal(humaniseRemaining(0), 'Expires today');
  assert.equal(humaniseRemaining(1), 'Expires tomorrow');
  assert.equal(humaniseRemaining(7), '7 days left');
  assert.equal(humaniseRemaining(-1), 'Expired 1 day ago');
  assert.equal(humaniseRemaining(-12), 'Expired 12 days ago');
  assert.equal(humaniseRemaining(null), 'Unknown');
});

test('totalValidityDays measures the document lifetime', () => {
  assert.equal(
    totalValidityDays(parseDateOnly(dateOffset(-365)), parseDateOnly(dateOffset(0))),
    365,
  );
  assert.equal(totalValidityDays('bad', parseDateOnly(dateOffset(0))), null);
});

test('getReminder fires only on the configured thresholds', () => {
  assert.equal(getReminder(parseDateOnly(dateOffset(31)), 'Passport'), null);
  assert.equal(getReminder(parseDateOnly(dateOffset(30)), 'Passport').level, 30);
  assert.equal(getReminder(parseDateOnly(dateOffset(15)), 'Passport').level, 15);
  assert.equal(getReminder(parseDateOnly(dateOffset(7)), 'Passport').level, 7);
  assert.equal(getReminder(parseDateOnly(dateOffset(1)), 'Passport').level, 1);
  assert.equal(getReminder(parseDateOnly(dateOffset(12)), 'Passport'), null, 'no reminder mid-window');
});

test('getReminder handles expiry day and already expired documents', () => {
  const today = getReminder(parseDateOnly(dateOffset(0)), 'Insurance');
  assert.equal(today.level, 0);
  assert.equal(today.type, 'EXPIRY_TODAY');
  assert.equal(today.message, 'Insurance expires today.');

  const tomorrow = getReminder(parseDateOnly(dateOffset(1)), 'Insurance');
  assert.equal(tomorrow.message, 'Insurance expires tomorrow.');
  const expired = getReminder(parseDateOnly(dateOffset(-3)), 'Vehicle RC');
  assert.equal(expired.level, -1);
  assert.equal(expired.type, 'EXPIRED');
  assert.equal(expired.message, 'Vehicle RC has expired (3 days ago).');
});

function dateOffset(days) {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
};

/**
 * Converts a date (or date-only string) into a timestamp for UTC midnight of
 * that calendar day. Working in UTC day boundaries is what keeps the
 * "days remaining" maths free of timezone off-by-one errors: two dates are
 * compared by their calendar day, never by their clock time.
 */
function toUtcDay(value) {
  if (value === null || value === undefined || value === '') return null;

  // "YYYY-MM-DD" is parsed as UTC midnight by the JS engine already.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Timestamp of UTC midnight for the current day. */
function todayUtcDay(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Whole days from today until the expiry date.
 * Negative when the document has already expired, 0 when it expires today.
 */
function daysUntil(expiryDate, now = new Date()) {
  const target = toUtcDay(expiryDate);
  if (target === null) return null;
  return Math.round((target - todayUtcDay(now)) / MS_PER_DAY);
}

/** Total lifetime of a document in days, measured from its issue date. */
function totalValidityDays(issueDate, expiryDate) {
  const start = toUtcDay(issueDate);
  const end = toUtcDay(expiryDate);
  if (start === null || end === null) return null;
  return Math.round((end - start) / MS_PER_DAY);
}

function pluraliseDays(count) {
  return count === 1 ? '1 day' : `${count} days`;
}

function humaniseRemaining(days) {
  if (days === null) return 'Unknown';
  if (days < 0) {
    const overdue = Math.abs(days);
    return `Expired ${pluraliseDays(overdue)} ago`;
  }
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${pluraliseDays(days)} left`;
}

/**
 * Short relative phrase for a number of days remaining, suitable for
 * embedding in a sentence: "today", "tomorrow", "in 7 days", "3 days ago".
 */
function describeRemaining(days) {
  if (days === null) return 'on an unknown date';
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? '1 day ago' : `${overdue} days ago`;
  }
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${pluraliseDays(days)}`;
}

/**
 * Dynamically derives the lifecycle status of a document. Status is never
 * persisted - it is always recalculated from the expiry date so that the value
 * stays correct as time passes without a background job.
 */
function getExpiryStatus(expiryDate, expiringSoonDays = 30, now = new Date()) {
  const days = daysUntil(expiryDate, now);

  let status = STATUS.ACTIVE;
  if (days !== null) {
    if (days < 0) status = STATUS.EXPIRED;
    else if (days <= expiringSoonDays) status = STATUS.EXPIRING_SOON;
  }

  return {
    status,
    daysRemaining: days,
    isExpired: status === STATUS.EXPIRED,
    isExpiringSoon: status === STATUS.EXPIRING_SOON,
    remainingLabel: humaniseRemaining(days),
    totalValidityDays: null,
  };
}

/**
 * Parses a date into UTC midnight of the intended calendar day.
 *
 * Accepts "YYYY-MM-DD" (strictly validated, so 2023-02-30 is rejected) as well
 * as a full ISO 8601 timestamp, which is what the value becomes after the
 * request body has been sanitised. Returns null for anything unparseable.
 */
function parseDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(toUtcDay(value));
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (match) {
    const [, year, month, day] = match.map(Number);
    const timestamp = Date.UTC(year, month - 1, day);

    // Reject roll-over dates such as 2023-02-30.
    const check = new Date(timestamp);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }

    return new Date(timestamp);
  }

  // Already an ISO 8601 timestamp (e.g. after sanitisation) - take its day.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(toUtcDay(parsed));
}

module.exports = {
  STATUS,
  MS_PER_DAY,
  toUtcDay,
  todayUtcDay,
  daysUntil,
  totalValidityDays,
  humaniseRemaining,
  describeRemaining,
  getExpiryStatus,
  parseDateOnly,
};

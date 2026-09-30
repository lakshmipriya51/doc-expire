'use strict';

const { daysUntil, describeRemaining } = require('./expiry');

/**
 * Reminder thresholds, expressed in days remaining before the expiry date.
 * A reminder is emitted when the document sits exactly on a threshold, so a
 * user receives at most one reminder per threshold per document.
 */
const REMINDER_LEVELS = [30, 15, 7, 1];

const NOTIFICATION_TYPE = {
  REMINDER: 'REMINDER',
  EXPIRY_TODAY: 'EXPIRY_TODAY',
  EXPIRED: 'EXPIRED',
};

/**
 * Returns the reminder that applies to a document right now, or null when the
 * document is not near expiry.
 */
function getReminder(expiryDate, documentName, now = new Date()) {
  const days = daysUntil(expiryDate, now);
  if (days === null) return null;

  if (days < 0) {
    return {
      level: -1,
      type: NOTIFICATION_TYPE.EXPIRED,
      message: `${documentName} has expired (${describeRemaining(days)}).`,
    };
  }

  if (days === 0) {
    return {
      level: 0,
      type: NOTIFICATION_TYPE.EXPIRY_TODAY,
      message: `${documentName} expires today.`,
    };
  }

  if (REMINDER_LEVELS.includes(days)) {
    return {
      level: days,
      type: NOTIFICATION_TYPE.REMINDER,
      message: `${documentName} expires ${describeRemaining(days)}.`,
    };
  }

  return null;
}

module.exports = { REMINDER_LEVELS, NOTIFICATION_TYPE, getReminder };

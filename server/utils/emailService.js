'use strict';

const config = require('../config');
const { NOTIFICATION_TYPE } = require('./reminders');

/**
 * Optional email delivery for reminders.
 *
 * Email is opt-in through EMAIL_ENABLED and only sends metadata (document
 * name, type, expiry date) - never the uploaded file or document number.
 * Credentials come from environment variables only.
 */
async function sendExpiryEmail({ to, name, documentName, documentType, expiryDate, type }) {
  if (!config.email.enabled) return { sent: false, reason: 'disabled' };
  if (!config.email.host || !config.email.user) {
    return { sent: false, reason: 'not-configured' };
  }

  const heading =
    type === NOTIFICATION_TYPE.EXPIRED
      ? 'A document has expired'
      : type === NOTIFICATION_TYPE.EXPIRY_TODAY
        ? 'A document expires today'
        : 'A document is nearing expiry';

  const subject = `DocExpire: ${documentName} - ${heading}`;
  const text = [
    `Hi ${name},`,
    '',
    `${documentName} (${documentType}) expires on ${new Date(expiryDate).toDateString()}.`,
    '',
    'Sign in to DocExpire to view or update this document.',
  ].join('\n');

  try {
    // Loaded lazily so the project runs with no mail provider installed.
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.pass },
    });

    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
    });

    return { sent: true };
  } catch (error) {
    console.error('[email] Failed to send reminder email:', error.message);
    return { sent: false, reason: 'send-failed' };
  }
}

module.exports = { sendExpiryEmail };

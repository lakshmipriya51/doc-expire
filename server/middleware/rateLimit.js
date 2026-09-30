'use strict';

const rateLimit = require('express-rate-limit');

const isDisabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase(),
);

const passthrough = (req, res, next) => next();

const jsonMessage = (message) => ({ success: false, message });

/** Throttles credential endpoints to slow down brute-force attempts. */
const authLimiter = isDisabled
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: jsonMessage('Too many attempts. Please try again in a few minutes.'),
    });

/** Broad safety net for the rest of the API. */
const apiLimiter = isDisabled
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: jsonMessage('Too many requests. Please slow down.'),
    });

module.exports = { authLimiter, apiLimiter };

'use strict';

const ApiError = require('../utils/ApiError');
const config = require('../config');

/** Terminal 404 handler for unmatched routes. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found.`));
}

/* eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature */
function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Something went wrong.';
  let details = error.details;

  // Translate driver-level errors into meaningful HTTP responses.
  if (error.name === 'ValidationError' && error.errors) {
    statusCode = 400;
    details = Object.fromEntries(
      Object.entries(error.errors).map(([field, fieldError]) => [field, fieldError.message]),
    );
    message = 'Please correct the highlighted fields.';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'The supplied identifier is not valid.';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'An account with that email already exists.';
    details = { email: 'This email is already registered.' };
  }

  if (statusCode >= 500) {
    console.error('[error]', error);
    // Never send stack traces or driver internals to a client.
    message = config.isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : message;
    details = undefined;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
  });
}

module.exports = { notFound, errorHandler };

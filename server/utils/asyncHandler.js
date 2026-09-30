'use strict';

/**
 * Wraps an async route handler so rejected promises reach the Express error
 * handler instead of becoming unhandled rejections.
 */
function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

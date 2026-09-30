'use strict';

const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');

/**
 * Verifies the bearer token and attaches the user document to the request.
 * A deleted or tampered account can no longer use an old token.
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      throw ApiError.unauthorized('Please log in to continue.');
    }

    const payload = verifyToken(token);
    const User = require('../models/User');
    const user = await User.findById(payload.sub);

    if (!user) {
      throw ApiError.unauthorized('Your account no longer exists.');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { protect };

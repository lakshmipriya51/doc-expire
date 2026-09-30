'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Turns express-validator failures into a 400 with a field -> message map. */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = {};
  for (const error of result.array()) {
    if (!details[error.path]) details[error.path] = error.msg;
  }

  // Flags the request so an already-uploaded temp file can be discarded
  // instead of being left behind as an orphan on disk.
  req.validationFailed = true;

  return next(ApiError.badRequest('Please correct the highlighted fields.', details));
}

module.exports = validate;

'use strict';

const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');
const { DOCUMENT_TYPES } = require('../utils/documentTypes');
const { parseDateOnly } = require('../utils/expiry');
const { STATUS } = require('../utils/expiry');

const SORT_OPTIONS = ['expiry-asc', 'expiry-desc', 'newest', 'oldest'];
const STATUS_OPTIONS = ['all', 'active', 'expiring-soon', 'expired'];

const dateField = (field, label) =>
  body(field)
    .custom((value) => parseDateOnly(value) !== null)
    .withMessage(`${label} must be a valid date (YYYY-MM-DD).`)
    .customSanitizer((value) => {
      const parsed = parseDateOnly(value);
      return parsed ? parsed.toISOString() : value;
    });

const documentBodyRules = [
  body('documentName')
    .trim()
    .notEmpty()
    .withMessage('Document name is required.')
    .isLength({ max: 80 })
    .withMessage('Document name must be at most 80 characters.'),
  body('documentType')
    .notEmpty()
    .withMessage('Document type is required.')
    .isIn(DOCUMENT_TYPES)
    .withMessage(`Document type must be one of: ${DOCUMENT_TYPES.join(', ')}.`),
  body('documentNumber')
    .trim()
    .notEmpty()
    .withMessage('Document number is required.')
    .isLength({ max: 40 })
    .withMessage('Document number must be at most 40 characters.')
    .matches(/^[A-Za-z0-9][A-Za-z0-9\-/ ]*$/)
    .withMessage('Document number may only contain letters, numbers, spaces, - and /.'),
  dateField('issueDate', 'Issue date'),
  dateField('expiryDate', 'Expiry date'),
  body('expiryDate').custom((value, { req }) => {
    const issueDate = parseDateOnly(req.body.issueDate);
    const expiryDate = parseDateOnly(req.body.expiryDate);
    if (!issueDate || !expiryDate) return true;
    if (expiryDate.getTime() < issueDate.getTime()) {
      throw new Error('Expiry date cannot be earlier than the issue date.');
    }
    return true;
  }),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters.'),
];

const documentUpdateRules = documentBodyRules;

const documentIdRules = [
  param('id').custom((value) => mongoose.isValidObjectId(value))
    .withMessage('Invalid document id.'),
];

const listQueryRules = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 80 })
    .withMessage('Search term is too long.'),
  query('status')
    .optional()
    .isIn(STATUS_OPTIONS)
    .withMessage(`Status must be one of: ${STATUS_OPTIONS.join(', ')}.`),
  query('type')
    .optional()
    .isIn(DOCUMENT_TYPES)
    .withMessage('Unknown document type filter.'),
  query('sort')
    .optional()
    .isIn(SORT_OPTIONS)
    .withMessage(`Sort must be one of: ${SORT_OPTIONS.join(', ')}.`),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be 1 or greater.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];

module.exports = {
  documentBodyRules,
  documentUpdateRules,
  documentIdRules,
  listQueryRules,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  STATUS,
  DOCUMENT_TYPES,
};

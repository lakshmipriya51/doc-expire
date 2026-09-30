'use strict';

const { body } = require('express-validator');

const PASSWORD_RULE =
  'Password must be at least 8 characters and include a letter and a number.';

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage(PASSWORD_RULE)
    .matches(/[A-Za-z]/)
    .withMessage(PASSWORD_RULE)
    .matches(/\d/)
    .withMessage(PASSWORD_RULE),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password.')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Password is required.'),
];

const updateProfileRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required.')
    .isLength({ min: 8 })
    .withMessage(PASSWORD_RULE)
    .matches(/[A-Za-z]/)
    .withMessage(PASSWORD_RULE)
    .matches(/\d/)
    .withMessage(PASSWORD_RULE),
];

module.exports = { registerRules, loginRules, updateProfileRules, changePasswordRules };

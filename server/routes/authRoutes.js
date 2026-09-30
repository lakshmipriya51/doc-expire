'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const controller = require('../controllers/authController');
const {
  registerRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, registerRules, validate, controller.register);
router.post('/login', authLimiter, loginRules, validate, controller.login);

router.get('/profile', protect, controller.getProfile);
router.put('/profile', protect, updateProfileRules, validate, controller.updateProfile);
router.put('/password', protect, changePasswordRules, validate, controller.changePassword);

module.exports = router;

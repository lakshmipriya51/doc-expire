'use strict';

const express = require('express');
const { param } = require('express-validator');
const mongoose = require('mongoose');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

const router = express.Router();

const idRule = param('id')
  .custom((value) => mongoose.isValidObjectId(value))
  .withMessage('Invalid notification id.');

router.use(protect);

router.get('/', controller.listNotifications);
router.put('/read-all', controller.markAllAsRead);
router.put('/:id/read', idRule, validate, controller.markAsRead);

module.exports = router;

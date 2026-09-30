'use strict';

const express = require('express');
const { protect } = require('../middleware/auth');
const controller = require('../controllers/dashboardController');

const router = express.Router();

router.get('/stats', protect, controller.getStats);

module.exports = router;

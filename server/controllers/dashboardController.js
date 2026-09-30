'use strict';

const Document = require('../models/Document');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');
const { getExpiryStatus, toUtcDay } = require('../utils/expiry');
const { syncNotificationsForUser } = require('../utils/notificationService');

const UPCOMING_LIMIT = 5;

const getStats = asyncHandler(async (req, res) => {
  await syncNotificationsForUser(req.user._id);

  const documents = await Document.find({ userId: req.user._id }).lean();

  const counts = { total: documents.length, active: 0, expiringSoon: 0, expired: 0 };
  const upcoming = [];

  for (const document of documents) {
    const status = getExpiryStatus(document.expiryDate, config.expiringSoonDays);

    if (status.status === 'EXPIRED') counts.expired += 1;
    else if (status.status === 'EXPIRING_SOON') counts.expiringSoon += 1;
    else counts.active += 1;

    upcoming.push({
      id: document._id.toString(),
      documentName: document.documentName,
      documentType: document.documentType,
      expiryDate: document.expiryDate,
      status: status.status,
      daysRemaining: status.daysRemaining,
      remainingLabel: status.remainingLabel,
    });
  }

  // Nearest expiry first, and always surface expired documents so they cannot
  // be missed.
  upcoming.sort((a, b) => toUtcDay(a.expiryDate) - toUtcDay(b.expiryDate));

  res.json({
    success: true,
    data: {
      stats: {
        totalDocuments: counts.total,
        activeDocuments: counts.active,
        expiringSoon: counts.expiringSoon,
        expiredDocuments: counts.expired,
      },
      upcomingExpiry: upcoming.slice(0, UPCOMING_LIMIT),
      unreadNotifications: await Notification.countDocuments({ userId: req.user._id, isRead: false }),
    },
  });
});

module.exports = { getStats };

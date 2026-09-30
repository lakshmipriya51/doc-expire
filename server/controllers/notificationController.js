'use strict';

const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { syncNotificationsForUser } = require('../utils/notificationService');

function toApiNotification(notification) {
  return {
    id: notification._id.toString(),
    documentId: notification.documentId ? notification.documentId.toString() : null,
    documentName: notification.documentName,
    expiryDate: notification.expiryDate,
    message: notification.message,
    type: notification.type,
    level: notification.level,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

/**
 * Notifications are derived from the current expiry dates rather than pushed by
 * a scheduler, so they are re-synced on every read. That keeps the feed correct
 * after a day rolls over and means a reminder disappears automatically once a
 * document is renewed or deleted.
 */
const listNotifications = asyncHandler(async (req, res) => {
  await syncNotificationsForUser(req.user._id);

  const filter = { userId: req.user._id };
  if (req.query.unreadOnly === 'true') filter.isRead = false;

  const notifications = await Notification.find(filter)
    .sort({ level: 1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: {
      notifications: notifications.map((item) => ({ ...toApiNotification(item), id: item._id.toString() })),
      unreadCount: await Notification.countDocuments({ userId: req.user._id, isRead: false }),
    },
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });

  if (!notification) throw ApiError.notFound('Notification not found.');

  notification.isRead = true;
  await notification.save();

  res.json({
    success: true,
    message: 'Notification marked as read.',
    data: {
      notification: toApiNotification(notification),
      unreadCount: await Notification.countDocuments({ userId: req.user._id, isRead: false }),
    },
  });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { $set: { isRead: true } },
  );

  res.json({
    success: true,
    message: 'All notifications marked as read.',
    data: { updated: result.modifiedCount },
  });
});

module.exports = { listNotifications, markAsRead, markAllAsRead };

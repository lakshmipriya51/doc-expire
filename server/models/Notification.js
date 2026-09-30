'use strict';

const mongoose = require('mongoose');
const { NOTIFICATION_TYPE } = require('../utils/reminders');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    documentName: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(NOTIFICATION_TYPE),
    },
    /**
     * Days remaining when the reminder fired (-1 for expired, 0 for today,
     * otherwise one of the thresholds). Together with userId + documentId it
     * forms a unique key so reminders are never duplicated.
     */
    level: { type: Number, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, documentId: 1, level: 1 }, { unique: true });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

'use strict';

const config = require('../config');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getReminder } = require('./reminders');
const { sendExpiryEmail } = require('./emailService');

/**
 * Recomputes the reminder feed for a user.
 *
 * The feed is derived from the current expiry dates rather than pushed by a
 * scheduler, so it stays correct after a day rolls over without needing a
 * background job. Each (document, level) pair is upserted, which keeps
 * reminders idempotent and preserves the read/unread state.
 */
async function syncNotificationsForUser(userId) {
  const userObjectId = new (require('mongoose').Types.ObjectId)(String(userId));
  const documents = await Document.find({ userId: userObjectId }).select(
    'documentName documentType expiryDate',
  );

  const desired = [];
  for (const document of documents) {
    const reminder = getReminder(document.expiryDate, document.documentName);
    if (!reminder) continue;

    desired.push({
      userId: userObjectId,
      documentId: document._id,
      documentName: document.documentName,
      documentType: document.documentType,
      expiryDate: document.expiryDate,
      message: reminder.message,
      type: reminder.type,
      level: reminder.level,
    });
  }

  const newlyCreated = [];
  for (const reminder of desired) {
    const result = await Notification.updateOne(
      { userId: reminder.userId, documentId: reminder.documentId, level: reminder.level },
      {
        $set: {
          documentName: reminder.documentName,
          expiryDate: reminder.expiryDate,
          message: reminder.message,
          type: reminder.type,
        },
        $setOnInsert: { isRead: false },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (result.upsertedCount) newlyCreated.push(reminder);
  }

  // Drop reminders that no longer apply (document deleted, or the expiry date
  // was edited so the old threshold is irrelevant).
  const documentIds = documents.map((document) => document._id);
  const levels = desired.map((reminder) => reminder.level);

  await Notification.deleteMany({
    userId: userObjectId,
    $or: [
      { documentId: { $nin: documentIds } },
      { documentId: { $nin: [] }, level: { $nin: levels } },
    ],
  });

  await dispatchEmailsForNewReminders(newlyCreated);

  return Notification.countDocuments({ userId: userObjectId, isRead: false });
}

/**
 * Emails only reminders that were just created, so re-running the sync never
 * re-sends a notice the user has already received. No-ops unless the optional
 * email integration is switched on.
 */
async function dispatchEmailsForNewReminders(reminders) {
  if (!config.email.enabled || reminders.length === 0) return;

  const user = await User.findById(reminders[0].userId).select('name email');
  if (!user) return;

  for (const reminder of reminders) {
    await sendExpiryEmail({
      to: user.email,
      name: user.name,
      documentName: reminder.documentName,
      documentType: reminder.documentType,
      expiryDate: reminder.expiryDate,
      type: reminder.type,
    });
  }
}

async function removeNotificationsForDocument(userId, documentId) {
  await Notification.deleteMany({ userId, documentId });
}

module.exports = { syncNotificationsForUser, removeNotificationsForDocument };

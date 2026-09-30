'use strict';

/**
 * Seeds a demo account with realistic-looking but entirely fictional documents.
 *
 * Run with: npm run seed   (from the server folder)
 * All document numbers below are placeholders - no real identifiers are used.
 */

const config = require('../config');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const User = require('../models/User');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const { syncNotificationsForUser } = require('./notificationService');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Date-only value `days` from today, normalised to UTC midnight. */
function dateFromToday(days) {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc + days * MS_PER_DAY);
}

const SAMPLE_DOCUMENTS = [
  {
    documentName: 'Passport',
    documentType: 'Passport',
    documentNumber: 'X0000000',
    issueDate: dateFromToday(-3650),
    expiryDate: dateFromToday(412),
    description: 'Sample passport copy. Number is a placeholder for development only.',
  },
  {
    documentName: 'Driving License',
    documentType: 'Driving License',
    documentNumber: 'DL0000000000000',
    issueDate: dateFromToday(-1800),
    expiryDate: dateFromToday(28),
    description: 'Sample driving licence record.',
  },
  {
    documentName: 'Vehicle Insurance',
    documentType: 'Insurance',
    documentNumber: 'POL-0000-0000-0000',
    issueDate: dateFromToday(-364),
    expiryDate: dateFromToday(1),
    description: 'Sample motor insurance policy.',
  },
  {
    documentName: 'College ID',
    documentType: 'College ID',
    documentNumber: 'STU0000000',
    issueDate: dateFromToday(-330),
    expiryDate: dateFromToday(120),
    description: 'Sample student identity card.',
  },
  {
    documentName: 'PAN Card',
    documentType: 'PAN',
    documentNumber: 'AAAAA0000A',
    issueDate: dateFromToday(-2000),
    expiryDate: dateFromToday(-45),
    description: 'Sample PAN record, already expired to demonstrate the expired state.',
  },
  {
    documentName: 'Aadhaar Card',
    documentType: 'Aadhaar',
    documentNumber: '0000 0000 0000',
    issueDate: dateFromToday(-2500),
    expiryDate: dateFromToday(7),
    description: 'Sample Aadhaar record. Number is a placeholder for development only.',
  },
];

async function seed() {
  await connectDatabase();

  const { email, password, name } = config.seed;
  const existing = await User.findOne({ email });

  const user = existing || (await User.create({ name, email, password }));

  if (existing) {
    console.log(`[seed] Reusing existing demo user ${email}`);
  } else {
    console.log(`[seed] Created demo user ${email}`);
  }

  await Document.deleteMany({ userId: user._id });
  await Notification.deleteMany({ userId: user._id });

  const created = await Document.insertMany(
    SAMPLE_DOCUMENTS.map((document) => ({ ...document, userId: user._id })),
  );

  await syncNotificationsForUser(user._id);

  const notifications = await Notification.countDocuments({ userId: user._id });

  console.log(`[seed] Inserted ${created.length} sample documents.`);
  console.log(`[seed] Generated ${notifications} reminders.`);
  console.log('[seed] Sign in with:');
  console.log(`       email:    ${email}`);
  console.log(`       password: ${password}`);

  await disconnectDatabase();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error('[seed] Failed:', error.message);
      await disconnectDatabase().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seed, SAMPLE_DOCUMENTS };

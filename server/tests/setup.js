'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';
process.env.CLIENT_URL = 'http://localhost:5173';
// The suite fires far more requests per 15 minutes than a real user would.
process.env.RATE_LIMIT_DISABLED = 'true';

const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const { connectDatabase, disconnectDatabase, mongoose } = require('../config/db');

let memoryServer = null;

async function startTestDatabase() {
  memoryServer = await MongoMemoryServer.create();
  await connectDatabase(memoryServer.getUri());
}

async function stopTestDatabase() {
  await disconnectDatabase();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/** Empties every collection so each test starts from a known state. */
async function resetDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

/** Minimal but structurally valid PDF used for upload tests. */
function samplePdfBuffer(text = 'DocExpire test file') {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
      `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
      `trailer<</Root 1 0 R>>\n% ${text}\n%%EOF\n`,
    'utf8',
  );
}

async function registerUser(app, overrides = {}) {
  const password = overrides.password || 'Passw0rd123';
  const payload = {
    name: 'Test User',
    email: 'test.user@example.com',
    confirmPassword: password,
    ...overrides,
    password,
  };

  const response = await request(app)
    .post('/api/auth/register')
    .send(payload);

  return {
    payload,
    token: response.body?.data?.token,
    user: response.body?.data?.user,
    response,
  };
}

async function loginUser(app, credentials) {
  const response = await request(app).post('/api/auth/login').send(credentials);
  return { token: response.body?.data?.token, response };
}

function authHeader(token) {
  return `Bearer ${token}`;
}

/** Builds a YYYY-MM-DD string `offsetDays` from today (UTC). */
function dateOnly(offsetDays) {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const documentPayload = (overrides = {}) => ({
  documentName: 'Passport',
  documentType: 'Passport',
  documentNumber: 'X1234567',
  issueDate: dateOnly(-365),
  expiryDate: dateOnly(400),
  description: 'Sample document',
  ...overrides,
});

module.exports = {
  startTestDatabase,
  stopTestDatabase,
  resetDatabase,
  samplePdfBuffer,
  registerUser,
  loginUser,
  authHeader,
  dateOnly,
  documentPayload,
};

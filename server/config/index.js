'use strict';

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function readPort() {
  const raw = process.env.PORT;
  if (!raw) return 5000;
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : 5000;
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readOrigins() {
  const configured = process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173';
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in the environment for production.');
  }
  // A random development-only secret keeps local runs working without ever
  // falling back to a hardcoded value that could leak into production.
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET not set - using a random development secret (sessions reset on restart).');
}

// The value shipped in .env.example is public knowledge, so it must never be
// accepted where it matters. Any token signed with it could be forged by
// anyone who has read the repository.
const PLACEHOLDER_SECRETS = new Set([
  'replace_this_with_a_long_random_string',
  'your_jwt_secret',
  'change_me',
  'secret',
]);

if (isProduction && PLACEHOLDER_SECRETS.has(String(jwtSecret).trim().toLowerCase())) {
  throw new Error('JWT_SECRET is still the example placeholder. Set a long random value before deploying.');
}

if (isProduction && String(jwtSecret).length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

if (isProduction && (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('your_mongodb'))) {
  throw new Error('MONGODB_URI must be set to a real connection string for production.');
}

const config = {
  nodeEnv,
  isProduction,
  port: readPort(),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/docexpire',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: readOrigins(),
  bcryptSaltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads'),
  maxUploadBytes: Number.parseInt(process.env.MAX_UPLOAD_MB || '5', 10) * 1024 * 1024,
  allowedUploadMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  expiringSoonDays: Number.parseInt(process.env.EXPIRING_SOON_DAYS || '30', 10),
  seed: {
    email: process.env.SEED_USER_EMAIL || 'demo@docexpire.dev',
    password: process.env.SEED_USER_PASSWORD || 'Demo@12345',
    name: process.env.SEED_USER_NAME || 'Demo User',
  },
  email: {
    // Email delivery is optional. Without a provider configured the app simply
    // keeps notifications in-app, which is the default for local development.
    enabled: readBoolean(process.env.EMAIL_ENABLED, false),
    host: process.env.EMAIL_HOST || '',
    port: Number.parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'DocExpire <no-reply@docexpire.dev>',
  },
};

module.exports = config;

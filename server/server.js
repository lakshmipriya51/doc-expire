'use strict';

const config = require('./config');
const { connectDatabase, disconnectDatabase, mongoose } = require('./config/db');
const createApp = require('./app');

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];

function assertRequiredEnv() {
  if (config.isProduction) return;
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(
      `[config] ${missing.join(', ')} not set. Falling back to development defaults. ` +
        'Copy server/.env.example to server/.env before deploying.',
    );
  }
}

async function start() {
  assertRequiredEnv();

  try {
    await connectDatabase();
  } catch (error) {
    // The process exits rather than serving requests that would all fail.
    console.error(`[startup] ${error.message}`);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[startup] DocExpire API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  // Without this a busy port kills the process with a raw stack trace, which is
  // a confusing way to learn that something else already owns the port.
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[startup] Port ${config.port} is already in use. ` +
          'Stop the other process, or set PORT to a free port in server/.env.',
      );
    } else {
      console.error(`[startup] Server error: ${error.message}`);
    }
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] ${signal} received, closing server...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Do not hang forever if a connection refuses to close.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start, createApp, assertRequiredEnv, mongoose };

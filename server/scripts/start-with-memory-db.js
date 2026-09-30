'use strict';

/**
 * Starts the DocExpire API backed by an in-memory MongoDB.
 *
 * This is a development convenience for people who have not installed MongoDB
 * yet. Data is discarded when the process stops, so it must never be used for
 * real documents.
 *
 *   npm run dev:memory
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../config');
const { connectDatabase } = require('../config/db');
const createApp = require('../app');

async function start() {
  if (!config.isProduction) {
    console.log('[dev-memory] Starting an in-memory MongoDB. Data is not persisted.');
  }

  const memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri('docexpire');
  await connectDatabase(uri);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[startup] DocExpire API listening on http://localhost:${config.port} (in-memory db)`);
  });

  // Without this a busy port kills the process with a raw stack trace, which is
  // a confusing way to learn that something else already owns the port.
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[dev-memory] Port ${config.port} is already in use. ` +
          'Stop the other process, or set PORT to a free port in server/.env.',
      );
    } else {
      console.error(`[dev-memory] Server error: ${error.message}`);
    }
    process.exit(1);
  });

  const shutdown = async () => {
    server.close(async () => {
      await memoryServer.stop();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`[dev-memory] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { start };

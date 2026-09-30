'use strict';

const mongoose = require('mongoose');
const config = require('./index');

mongoose.set('strictQuery', true);

let connectionPromise = null;

/**
 * Connects to MongoDB. Rejects with a sanitised message so connection strings
 * (which may embed credentials) are never surfaced to API clients.
 */
async function connectDatabase(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    mongoose.connection.removeListener('error', handleConnectionError);

    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
        autoIndex: !config.isProduction,
      })
      .then((instance) => {
        console.log(`[db] Connected to MongoDB (${instance.connection.name})`);
        return instance.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw new Error(`Database connection failed: ${error.message}`);
      });

    mongoose.connection.on('error', handleConnectionError);
  }

  return connectionPromise;
}

function handleConnectionError(error) {
  console.error('[db] Connection error:', error.message);
}

async function disconnectDatabase() {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[db] Disconnected from MongoDB');
  }
}

module.exports = { connectDatabase, disconnectDatabase, mongoose };

'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const config = require('./config');
const { apiLimiter } = require('./middleware/rateLimit');
const { serveClient } = require('./middleware/serveClient');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API is consumed cross-origin by the Vite dev server; CSP is
      // applied per-response for document files instead.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin/non-browser callers (health checks, curl, tests).
        if (!origin) return callback(null, true);

        // Deployed web frontends.
        if (config.clientUrls.includes(origin)) return callback(null, true);

        // The packaged Capacitor app. It runs on the device, so its origin is a
        // shell origin rather than the deployed web URL, and it would otherwise
        // be rejected by CORS the moment the API is deployed.
        if (config.nativeOrigins.includes(origin)) return callback(null, true);

        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', apiLimiter);

  app.get('/api/health', (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'docexpire-api',
        environment: config.nodeEnv,
        database: states[mongoose.connection.readyState] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Serves the built client when it exists. Mounted after the API routes, and
  // it skips /api itself, so it can never shadow an endpoint or turn an unknown
  // API route into an HTML page.
  serveClient(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

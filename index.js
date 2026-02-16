/**
 * BENXI Backend — Main Entry Point
 *
 * Zero-metadata private messaging server.
 * Created by Omar Ben Sabyh.
 *
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('ws');

const { connectDB }    = require('./db/connection');
const { connectRedis } = require('./cache/redis');
const { setupWebSocket } = require('./websocket/relay');
const rateLimiter      = require('./middleware/rateLimit');
const authRoutes       = require('./api/auth');
const keyRoutes        = require('./api/keys');
const messageRoutes    = require('./api/messages');

const PORT = process.env.PORT || 3001;

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'"],
      imgSrc:      ["'self'", "data:"],
      connectSrc:  ["'self'", "wss:"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Privacy: Do not expose server info
app.disable('x-powered-by');

// Only accept requests from configured domain in production
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: `https://${process.env.DOMAIN}`,
    credentials: true,
  }));
} else {
  app.use(cors());
}

app.use(express.json({ limit: '512kb' }));
app.use(rateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/api/v1/accounts', authRoutes);
app.use('/api/v1/keys',     keyRoutes);
app.use('/api/v1/messages', messageRoutes);

// 404 handler — no information leakage
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Error handler — minimal information exposed
app.use((err, req, res, next) => {
  if (process.env.LOG_LEVEL !== 'none') {
    console.error('[error]', err.message);
  }
  res.status(500).json({ error: 'internal_error' });
});

// ─── WebSocket Relay ──────────────────────────────────────────────────────────

const server = http.createServer(app);
const wss    = new Server({ server, path: '/ws' });
setupWebSocket(wss);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  try {
    await connectDB();
    await connectRedis();

    server.listen(PORT, '0.0.0.0', () => {
      if (process.env.LOG_LEVEL !== 'none') {
        console.log(`[benxi] Server running on port ${PORT}`);
      }
    });
  } catch (err) {
    console.error('[benxi] Failed to start:', err.message);
    process.exit(1);
  }
}

start();

/**
 * BENXI — Rate Limiting Middleware
 *
 * Protects against abuse without logging user identities.
 * Keyed on a session-derived token, NOT on IP address.
 */

'use strict';

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs:         60 * 1000,                             // 1 minute
  max:              parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10),
  standardHeaders:  true,
  legacyHeaders:    false,
  // Key by Authorization header hash, not IP — privacy design
  keyGenerator: (req) => {
    const auth = req.headers['authorization'] || 'anonymous';
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(auth).digest('hex');
  },
  handler: (req, res) => {
    res.status(429).json({ error: 'rate_limit_exceeded' });
  },
  skip: (req) => req.path === '/api/v1/health',
});

module.exports = limiter;

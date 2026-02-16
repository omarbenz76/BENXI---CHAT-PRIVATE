/**
 * BENXI — Authentication Middleware
 */

'use strict';

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.account_id = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { requireAuth };

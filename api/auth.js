/**
 * BENXI — Authentication Routes
 *
 * Anonymous challenge-response authentication.
 * No passwords. No emails. No phone numbers.
 * Identity = cryptographic key ownership.
 */

'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sodium = require('libsodium-wrappers');
const jwt    = require('jsonwebtoken');
const { query } = require('../db/connection');
const { redis }  = require('../cache/redis');

const router = express.Router();

// ─── POST /api/v1/accounts/register ──────────────────────────────────────────
// Create a new anonymous account.
// Body: { public_key: hex, registration_id: number, signed_prekey: {...}, one_time_prekeys: [...] }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    await sodium.ready;

    const { public_key, registration_id, signed_prekey, one_time_prekeys } = req.body;

    if (!public_key || !registration_id || !signed_prekey || !one_time_prekeys) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Validate key lengths
    const pubKeyBytes = Buffer.from(public_key, 'hex');
    if (pubKeyBytes.length !== sodium.crypto_sign_PUBLICKEYBYTES) {
      return res.status(400).json({ error: 'invalid_key_length' });
    }

    // Verify signed prekey signature
    const spkPubKey   = Buffer.from(signed_prekey.public_key, 'hex');
    const spkSig      = Buffer.from(signed_prekey.signature, 'hex');
    const sigValid    = sodium.crypto_sign_verify_detached(spkSig, spkPubKey, pubKeyBytes);

    if (!sigValid) {
      return res.status(400).json({ error: 'invalid_signed_prekey_signature' });
    }

    // Store account (no IP, no timestamp linkable to identity)
    const account = await query(
      `INSERT INTO accounts (public_key, registration_id)
       VALUES ($1, $2)
       RETURNING id`,
      [pubKeyBytes, registration_id]
    );

    const accountId = account.rows[0].id;

    // Store signed prekey
    await query(
      `INSERT INTO signed_prekeys (account_id, key_id, public_key, signature)
       VALUES ($1, $2, $3, $4)`,
      [accountId, signed_prekey.key_id, spkPubKey, spkSig]
    );

    // Store one-time prekeys
    for (const otpk of one_time_prekeys) {
      await query(
        `INSERT INTO one_time_prekeys (account_id, key_id, public_key)
         VALUES ($1, $2, $3)`,
        [accountId, otpk.key_id, Buffer.from(otpk.public_key, 'hex')]
      );
    }

    return res.status(201).json({ account_id: accountId });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'key_already_registered' });
    }
    if (process.env.LOG_LEVEL !== 'none') console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── POST /api/v1/accounts/challenge ─────────────────────────────────────────
// Request an authentication challenge.
// Body: { public_key: hex }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/challenge', async (req, res) => {
  try {
    const { public_key } = req.body;

    if (!public_key) return res.status(400).json({ error: 'missing_fields' });

    const pubKeyBytes = Buffer.from(public_key, 'hex');

    // Verify account exists
    const result = await query(
      'SELECT id FROM accounts WHERE public_key = $1',
      [pubKeyBytes]
    );

    if (result.rows.length === 0) {
      // Return same response as success to prevent enumeration
      const fakeNonce = require('crypto').randomBytes(32).toString('hex');
      return res.json({ nonce: fakeNonce });
    }

    // Generate challenge nonce (random, single-use)
    const nonce = require('crypto').randomBytes(32).toString('hex');
    const challengeKey = `challenge:${public_key}`;

    // Store nonce in Redis for 2 minutes
    await redis.set(challengeKey, nonce, 'EX', 120);

    return res.json({ nonce });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[auth/challenge]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── POST /api/v1/accounts/verify ────────────────────────────────────────────
// Verify challenge response and issue session token.
// Body: { public_key: hex, signature: hex }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/verify', async (req, res) => {
  try {
    await sodium.ready;

    const { public_key, signature } = req.body;
    if (!public_key || !signature) return res.status(400).json({ error: 'missing_fields' });

    const pubKeyBytes = Buffer.from(public_key, 'hex');
    const sigBytes    = Buffer.from(signature, 'hex');
    const challengeKey = `challenge:${public_key}`;

    // Retrieve and immediately delete the challenge nonce (single-use)
    const nonce = await redis.getdel(challengeKey);
    if (!nonce) return res.status(401).json({ error: 'invalid_or_expired_challenge' });

    // Verify signature
    const nonceBytes = Buffer.from(nonce, 'hex');
    const valid = sodium.crypto_sign_verify_detached(sigBytes, nonceBytes, pubKeyBytes);
    if (!valid) return res.status(401).json({ error: 'invalid_signature' });

    // Fetch account
    const result = await query(
      'SELECT id FROM accounts WHERE public_key = $1',
      [pubKeyBytes]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'account_not_found' });

    const accountId = result.rows[0].id;
    const jti = uuidv4();

    // Issue JWT
    const token = jwt.sign(
      { sub: accountId, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    return res.json({ token, account_id: accountId });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[auth/verify]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

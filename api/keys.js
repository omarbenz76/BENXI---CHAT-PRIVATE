/**
 * BENXI — Key Distribution Routes
 *
 * Manages public prekey bundles for X3DH key agreement.
 * Only public keys are stored. Private keys never leave the client.
 */

'use strict';

const express = require('express');
const sodium  = require('libsodium-wrappers');
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/v1/keys/:account_id ────────────────────────────────────────────
// Fetch a prekey bundle to initiate an X3DH session with a user.
// Consumes one one-time prekey.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:account_id', requireAuth, async (req, res) => {
  try {
    const { account_id } = req.params;

    // Fetch identity key
    const accountResult = await query(
      'SELECT public_key, registration_id FROM accounts WHERE id = $1',
      [account_id]
    );
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'account_not_found' });
    }

    const { public_key, registration_id } = accountResult.rows[0];

    // Fetch signed prekey
    const spkResult = await query(
      'SELECT key_id, public_key, signature FROM signed_prekeys WHERE account_id = $1',
      [account_id]
    );
    if (spkResult.rows.length === 0) {
      return res.status(404).json({ error: 'no_signed_prekey' });
    }

    // Fetch and consume one one-time prekey (if available)
    const otpkResult = await query(
      `DELETE FROM one_time_prekeys
       WHERE id = (
           SELECT id FROM one_time_prekeys
           WHERE account_id = $1
           ORDER BY id ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
       )
       RETURNING key_id, public_key`,
      [account_id]
    );

    const spk  = spkResult.rows[0];
    const otpk = otpkResult.rows[0] || null;

    const bundle = {
      registration_id,
      identity_key: public_key.toString('hex'),
      signed_prekey: {
        key_id:    spk.key_id,
        public_key: spk.public_key.toString('hex'),
        signature:  spk.signature.toString('hex'),
      },
      one_time_prekey: otpk ? {
        key_id:    otpk.key_id,
        public_key: otpk.public_key.toString('hex'),
      } : null,
    };

    // Check if prekey pool is running low — signal client to upload more
    const countResult = await query(
      'SELECT COUNT(*) as count FROM one_time_prekeys WHERE account_id = $1',
      [account_id]
    );
    const remainingPrekeys = parseInt(countResult.rows[0].count, 10);

    return res.json({
      bundle,
      prekey_count: remainingPrekeys,
      needs_prekey_refresh: remainingPrekeys < (process.env.PREKEY_REFILL_THRESHOLD || 10),
    });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[keys/get]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PUT /api/v1/keys/prekeys ─────────────────────────────────────────────────
// Upload a batch of new one-time prekeys.
// Called when client is running low.
// Body: { one_time_prekeys: [{ key_id, public_key }] }
// ─────────────────────────────────────────────────────────────────────────────

router.put('/prekeys', requireAuth, async (req, res) => {
  try {
    const accountId = req.account_id;
    const { one_time_prekeys } = req.body;

    if (!Array.isArray(one_time_prekeys) || one_time_prekeys.length === 0) {
      return res.status(400).json({ error: 'missing_prekeys' });
    }

    if (one_time_prekeys.length > 200) {
      return res.status(400).json({ error: 'too_many_prekeys' });
    }

    for (const key of one_time_prekeys) {
      await query(
        `INSERT INTO one_time_prekeys (account_id, key_id, public_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (account_id, key_id) DO NOTHING`,
        [accountId, key.key_id, Buffer.from(key.public_key, 'hex')]
      );
    }

    const countResult = await query(
      'SELECT COUNT(*) as count FROM one_time_prekeys WHERE account_id = $1',
      [accountId]
    );

    return res.json({
      uploaded: one_time_prekeys.length,
      total:    parseInt(countResult.rows[0].count, 10),
    });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[keys/prekeys]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PUT /api/v1/keys/signed ──────────────────────────────────────────────────
// Rotate the signed prekey.
// Body: { key_id, public_key, signature }
// ─────────────────────────────────────────────────────────────────────────────

router.put('/signed', requireAuth, async (req, res) => {
  try {
    await sodium.ready;

    const accountId = req.account_id;
    const { key_id, public_key, signature } = req.body;

    if (!key_id || !public_key || !signature) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Verify signature
    const accountResult = await query(
      'SELECT public_key FROM accounts WHERE id = $1',
      [accountId]
    );
    const identityKey = accountResult.rows[0].public_key;
    const spkBytes    = Buffer.from(public_key, 'hex');
    const sigBytes    = Buffer.from(signature, 'hex');

    const valid = sodium.crypto_sign_verify_detached(sigBytes, spkBytes, identityKey);
    if (!valid) return res.status(400).json({ error: 'invalid_signature' });

    // Replace signed prekey
    await query(
      `INSERT INTO signed_prekeys (account_id, key_id, public_key, signature)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id)
       DO UPDATE SET key_id = $2, public_key = $3, signature = $4, created_at = NOW()`,
      [accountId, key_id, spkBytes, sigBytes]
    );

    return res.json({ updated: true });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[keys/signed]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

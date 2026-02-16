/**
 * BENXI — Message Routes
 *
 * Message relay: encrypted blobs only.
 * Server cannot read content — zero-knowledge relay.
 * Sealed sender: server does not know who sends to whom.
 */

'use strict';

const express = require('express');
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { broadcastToAccount } = require('../websocket/relay');

const router = express.Router();

// ─── POST /api/v1/messages/send ──────────────────────────────────────────────
// Deliver an encrypted message blob to a recipient's queue.
// Body: { recipient_id: uuid, ciphertext: hex, message_type: number }
// The sender identity is NOT stored — sealed sender architecture.
// ─────────────────────────────────────────────────────────────────────────────

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { recipient_id, ciphertext, message_type = 1 } = req.body;

    if (!recipient_id || !ciphertext) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Validate ciphertext size (max 256KB per message)
    const ciphertextBytes = Buffer.from(ciphertext, 'hex');
    if (ciphertextBytes.length > 262144) {
      return res.status(413).json({ error: 'message_too_large' });
    }

    // Verify recipient exists
    const recipient = await query(
      'SELECT id FROM accounts WHERE id = $1',
      [recipient_id]
    );
    if (recipient.rows.length === 0) {
      return res.status(404).json({ error: 'recipient_not_found' });
    }

    // Store encrypted blob — no sender, no plaintext timestamp
    const result = await query(
      `INSERT INTO message_queue (recipient_id, ciphertext, message_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [recipient_id, ciphertextBytes, message_type]
    );

    const messageId = result.rows[0].id;

    // Attempt real-time delivery via WebSocket
    broadcastToAccount(recipient_id, {
      type: 'new_message',
      message_id: messageId,
    });

    return res.status(201).json({ message_id: messageId });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[messages/send]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── GET /api/v1/messages/receive ────────────────────────────────────────────
// Fetch pending messages for the authenticated account.
// Returns encrypted blobs. Client decrypts locally.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/receive', requireAuth, async (req, res) => {
  try {
    const accountId = req.account_id;

    const result = await query(
      `SELECT id, ciphertext, message_type
       FROM message_queue
       WHERE recipient_id = $1
       ORDER BY id ASC
       LIMIT 100`,
      [accountId]
    );

    const messages = result.rows.map(row => ({
      id:           row.id,
      ciphertext:   row.ciphertext.toString('hex'),
      message_type: row.message_type,
      // No sender_id, no timestamp returned
    }));

    return res.json({ messages });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[messages/receive]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── DELETE /api/v1/messages/:id ─────────────────────────────────────────────
// Delete a message from the queue after client has received and decrypted it.
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.account_id;

    // Only delete messages belonging to authenticated account
    const result = await query(
      `DELETE FROM message_queue
       WHERE id = $1 AND recipient_id = $2
       RETURNING id`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'message_not_found' });
    }

    return res.json({ deleted: true });

  } catch (err) {
    if (process.env.LOG_LEVEL !== 'none') console.error('[messages/delete]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

/**
 * BENXI — WebSocket Message Relay
 *
 * Real-time delivery of encrypted message notifications.
 * Server sees only account IDs and opaque payloads.
 * No message content passes through this relay in plaintext.
 */

'use strict';

const jwt = require('jsonwebtoken');

// Map of accountId -> Set of WebSocket connections
const connections = new Map();

function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    let accountId = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // First message must be authentication
        if (!accountId) {
          if (message.type !== 'auth' || !message.token) {
            ws.close(4001, 'auth_required');
            return;
          }

          try {
            const payload = jwt.verify(message.token, process.env.JWT_SECRET);
            accountId = payload.sub;

            // Register connection
            if (!connections.has(accountId)) {
              connections.set(accountId, new Set());
            }
            connections.get(accountId).add(ws);

            ws.send(JSON.stringify({ type: 'auth_ok' }));
          } catch {
            ws.close(4002, 'invalid_token');
          }
          return;
        }

        // Authenticated: only ping/pong allowed — no relay of raw messages
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }

      } catch {
        // Ignore malformed messages — no logging to preserve privacy
      }
    });

    ws.on('close', () => {
      if (accountId && connections.has(accountId)) {
        connections.get(accountId).delete(ws);
        if (connections.get(accountId).size === 0) {
          connections.delete(accountId);
        }
      }
    });

    ws.on('error', () => {
      // Silently handle errors — no logging
    });
  });
}

/**
 * Notify a connected account that a new message is waiting.
 * Does NOT send message content — only a delivery notification.
 * Client will fetch and decrypt via REST API.
 */
function broadcastToAccount(accountId, payload) {
  const sockets = connections.get(accountId);
  if (!sockets || sockets.size === 0) return;

  const data = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === 1) { // OPEN
      socket.send(data);
    }
  }
}

module.exports = { setupWebSocket, broadcastToAccount };

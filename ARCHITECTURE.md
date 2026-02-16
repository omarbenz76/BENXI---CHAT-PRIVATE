# BENXI — Architecture

## Overview

BENXI is a zero-knowledge, zero-metadata private messaging platform. The architecture is designed around a single constraint: **the server must never be able to learn anything meaningful about its users or their communications.**

This document describes the system's technical design across all components: backend, web client, mobile client, and infrastructure.

---

## Architectural Principles

### 1. Zero-Knowledge Server
The BENXI server is a dumb relay. It holds only the minimum data required to deliver encrypted blobs from one client to another. It cannot read content, resolve identities, or reconstruct communication graphs.

### 2. Client-Side Encryption Only
All cryptographic operations happen on the client. Keys are generated, stored, and used exclusively on user devices. The server never handles plaintext or private keys.

### 3. Metadata Minimization
Every design decision is evaluated against the question: *does this leak metadata?* Timing attacks, traffic analysis, and contact graph inference are treated as first-class threats.

### 4. No Persistent Logs
The server retains no access logs, no IP addresses, no message timestamps, and no delivery receipts beyond the minimum required for ephemeral relay.

---

## System Components

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                        │
│                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│   │  Web Client  │  │ Android App  │  │   iOS App   │  │
│   │   (React)    │  │(React Native)│  │(React Native│  │
│   └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│          │                 │                  │         │
│          └─────────────────┼──────────────────┘         │
│                            │ HTTPS / WSS (TLS 1.3)      │
└────────────────────────────┼────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                     SERVER LAYER                        │
│                            │                            │
│   ┌─────────────────────────────────────────────────┐   │
│   │              Nginx (Reverse Proxy)              │   │
│   │          TLS Termination + Rate Limiting        │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│   ┌──────────────────────┴──────────────────────────┐   │
│   │           BENXI Backend (Node.js)               │   │
│   │                                                 │   │
│   │   ┌─────────────┐     ┌─────────────────────┐   │   │
│   │   │  REST API   │     │   WebSocket Relay   │   │   │
│   │   │  /register  │     │   (message relay)   │   │   │
│   │   │  /keys      │     │                     │   │   │
│   │   │  /messages  │     └─────────────────────┘   │   │
│   │   └─────────────┘                               │   │
│   └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│   ┌──────────────────────┴──────────────────────────┐   │
│   │         PostgreSQL (Encrypted at Rest)          │   │
│   │                                                 │   │
│   │   accounts      — anonymous IDs only            │   │
│   │   prekeys       — public keys only              │   │
│   │   message_queue — encrypted blobs only          │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Cryptography

BENXI implements the **Signal Protocol** for end-to-end encryption.

### Key Exchange: X3DH (Extended Triple Diffie-Hellman)
Used to establish a shared secret between two parties who may not be simultaneously online.

```
Alice's Keys:                    Bob's Keys (stored on server):
IK_A  — Identity Key (long-term) IK_B  — Identity Key
EK_A  — Ephemeral Key (per session) SPK_B — Signed PreKey
                                 OPK_B — One-Time PreKey (consumed)

Shared Secret = KDF(
    DH(IK_A, SPK_B) ||
    DH(EK_A, IK_B)  ||
    DH(EK_A, SPK_B) ||
    DH(EK_A, OPK_B)
)
```

### Message Encryption: Double Ratchet Algorithm
Provides perfect forward secrecy and break-in recovery. Each message uses a new derived key.

```
Chain Key → Message Key → Encrypt(plaintext + padding)
     ↓
New Chain Key (ratchet forward)
```

### Algorithms
- Elliptic Curve: **Curve25519** (ECDH), **Ed25519** (signatures)
- Symmetric Encryption: **AES-256-GCM**
- Key Derivation: **HKDF-SHA256**
- Random padding applied to all messages to prevent size-based inference

### Sealed Sender
The sender's identity is encrypted inside the message envelope. The server sees only a destination identifier — it cannot determine who sent the message.

```
Envelope = Encrypt_RecipientKey({
    sender_certificate: Sign(sender_identity),
    message: DoubleRatchet_Encrypt(plaintext)
})
```

---

## Backend Architecture

### Technology Stack
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **Database:** PostgreSQL 15 (with pgcrypto for at-rest encryption)
- **WebSockets:** ws library
- **Auth:** Anonymous challenge-response (no passwords stored)
- **Rate Limiting:** express-rate-limit + Redis

### Database Schema

```sql
-- Accounts: anonymous by design
CREATE TABLE accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key  BYTEA NOT NULL UNIQUE,  -- Ed25519 identity key
    created_at  TIMESTAMPTZ DEFAULT NOW()
    -- No email. No phone. No name. No IP.
);

-- PreKey bundle for X3DH
CREATE TABLE prekeys (
    account_id      UUID REFERENCES accounts(id) ON DELETE CASCADE,
    key_id          INTEGER NOT NULL,
    public_key      BYTEA NOT NULL,
    key_type        TEXT CHECK(key_type IN ('signed', 'onetime')),
    signature       BYTEA,  -- for signed prekeys only
    PRIMARY KEY (account_id, key_id, key_type)
);

-- Message queue: server stores only encrypted blobs
CREATE TABLE message_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
    ciphertext      BYTEA NOT NULL,  -- fully opaque to server
    expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
    -- No sender_id. No timestamp readable by server. No metadata.
);

-- Automatic cleanup
CREATE INDEX ON message_queue (expires_at);
```

### API Endpoints

```
POST   /api/v1/accounts/register     — Create anonymous account
POST   /api/v1/accounts/challenge    — Auth challenge
POST   /api/v1/accounts/verify       — Verify challenge response

GET    /api/v1/keys/:account_id      — Fetch prekey bundle
PUT    /api/v1/keys/prekeys          — Upload new prekeys
PUT    /api/v1/keys/signed           — Upload signed prekey

POST   /api/v1/messages/send         — Send encrypted message
GET    /api/v1/messages/receive      — Fetch pending messages
DELETE /api/v1/messages/:id          — Delete after delivery

WS     /ws                           — Real-time message relay
```

---

## Web Client Architecture

### Technology Stack
- **Framework:** React 18
- **State Management:** Zustand
- **Crypto:** libsodium-wrappers + custom Signal Protocol implementation
- **Storage:** IndexedDB (encrypted, in-browser)
- **Build:** Vite

### Key Management (Client-Side)
```javascript
// Keys never leave the device
const keyStore = {
    identityKeyPair: await generateIdentityKeyPair(),    // Ed25519
    registrationId:  generateRegistrationId(),
    preKeys:         await generatePreKeys(100),          // batch
    signedPreKey:    await generateSignedPreKey(identity)
};

// Stored encrypted in IndexedDB with device-derived key
await encryptedStorage.set('keyStore', keyStore, deviceKey);
```

---

## Mobile Architecture (Android + iOS)

### Technology Stack
- **Framework:** React Native 0.73
- **Crypto:** react-native-sodium (libsodium bindings)
- **Storage:** react-native-encrypted-storage (Keychain/Keystore)
- **Navigation:** React Navigation 6
- **Push Notifications:** Silent pushes only (no content in notification payload)

### Platform Security
- **Android:** Keys stored in Android Keystore system
- **iOS:** Keys stored in iOS Secure Enclave / Keychain
- **Both:** Screen capture disabled for message screens
- **Both:** Background app snapshot blurred

### Directory Structure
```
mobile/src/
├── screens/
│   ├── Welcome.tsx
│   ├── Register.tsx
│   ├── ConversationList.tsx
│   ├── Chat.tsx
│   └── Settings.tsx
├── crypto/
│   ├── identity.ts      — Key generation & management
│   ├── sessions.ts      — Signal session management
│   ├── ratchet.ts       — Double Ratchet implementation
│   └── sealed.ts        — Sealed sender
├── api/
│   ├── client.ts        — HTTP client
│   └── websocket.ts     — WS connection manager
├── storage/
│   ├── keys.ts          — Secure key storage
│   └── messages.ts      — Local message store
└── navigation/
    └── index.tsx
```

---

## Infrastructure

### VPS Requirements (Minimum)
- 1 vCPU, 2GB RAM, 20GB SSD
- Ubuntu 22.04 LTS
- Static IP address
- Domain name with DNS A record

### Software Stack
- **Docker** + **Docker Compose**
- **Nginx** (reverse proxy, TLS)
- **Certbot** (Let's Encrypt SSL)
- **PostgreSQL 15** (containerized)
- **Redis** (rate limiting, session tokens)

### Network Architecture
```
Internet → Nginx (443) → Backend (3001) → PostgreSQL (5432)
                     ↘ WebSocket (3001/ws)
                     ↘ Redis (6379)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup instructions.

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Server compromise | Server holds only encrypted blobs; no keys, no plaintext |
| Network surveillance | TLS 1.3 + Sealed Sender hides sender identity |
| Metadata analysis | No IP logging, no timestamps, random padding |
| Legal compulsion | Nothing to hand over — by architectural design |
| Brute-force on keys | Curve25519 keys (128-bit security) |
| Replay attacks | Message counters + one-time prekeys |
| Forward secrecy violation | Double Ratchet ratchets every message |
| Account enumeration | Anonymous registration, no linkable identifiers |

---

## What BENXI Does NOT Protect Against

- **Device compromise** — If your device is seized and unlocked, messages are readable
- **Screenshot by recipient** — Content shared is content shared
- **Traffic analysis at ISP level** — Timing correlation attacks at scale
- **Social engineering** — No cryptography protects against human deception

These are acknowledged limitations, not design failures. Users should be informed.

---

*Architecture version: 1.0 | Maintainer: Omar Ben Sabyh*

-- ============================================================
-- BENXI Database Schema
-- Zero-metadata design: no IPs, no user-linkable timestamps,
-- no contact graphs, no names, no emails.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Accounts ────────────────────────────────────────────────────────────────
-- Anonymous by design.
-- No email. No phone number. No real name. No IP address.
-- Identity is established solely by cryptographic key ownership.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key      BYTEA NOT NULL UNIQUE,          -- Ed25519 identity public key
    registration_id INTEGER NOT NULL,               -- Signal protocol registration ID
    created_at      TIMESTAMPTZ DEFAULT NOW()       -- Not linked to identity, used for key rotation scheduling only
);

CREATE INDEX IF NOT EXISTS idx_accounts_public_key ON accounts (public_key);


-- ─── Signed PreKeys ──────────────────────────────────────────────────────────
-- One signed prekey per account at a time.
-- Used in X3DH key agreement as the medium-term key.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signed_prekeys (
    id          SERIAL PRIMARY KEY,
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  BYTEA NOT NULL,
    signature   BYTEA NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id)
);


-- ─── One-Time PreKeys ────────────────────────────────────────────────────────
-- A pool of one-time prekeys per account.
-- Each key is consumed once and deleted.
-- Provides additional forward secrecy in X3DH.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS one_time_prekeys (
    id          SERIAL PRIMARY KEY,
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  BYTEA NOT NULL,
    UNIQUE (account_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_otpk_account ON one_time_prekeys (account_id);


-- ─── Message Queue ────────────────────────────────────────────────────────────
-- Encrypted message blobs awaiting delivery.
-- The server holds ONLY the ciphertext — it is completely opaque.
-- Sender identity is NOT stored here (sealed sender architecture).
-- Messages are auto-deleted after TTL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    ciphertext      BYTEA NOT NULL,     -- Fully opaque encrypted blob
    message_type    SMALLINT NOT NULL DEFAULT 1,  -- 1=prekey, 2=signal
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    -- No sender_id — sealed sender
    -- No plaintext timestamp — only expiry for cleanup
    -- No content-type metadata
);

CREATE INDEX IF NOT EXISTS idx_queue_recipient    ON message_queue (recipient_id);
CREATE INDEX IF NOT EXISTS idx_queue_expires      ON message_queue (expires_at);


-- ─── Session Tokens ───────────────────────────────────────────────────────────
-- Short-lived JWT tokens are validated server-side via Redis.
-- This table exists only for emergency revocation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti         UUID PRIMARY KEY,
    revoked_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL   -- Auto-cleanup when past expiry
);

CREATE INDEX IF NOT EXISTS idx_revoked_expires ON revoked_tokens (expires_at);


-- ─── Automatic Cleanup ────────────────────────────────────────────────────────
-- Periodic cleanup of expired data.
-- Scheduled via pg_cron or cron job calling cleanup functions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    DELETE FROM message_queue  WHERE expires_at < NOW();
    DELETE FROM revoked_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Uncomment if pg_cron is available on your PostgreSQL instance:
-- SELECT cron.schedule('0 * * * *', 'SELECT cleanup_expired_data()');

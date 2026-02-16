# BENXI — Security Policy

## Our Security Philosophy

BENXI is built on a principle that is uncommon in modern software: **the server is treated as an adversary.**

Every architectural decision assumes that the server may be compromised, subpoenaed, or operated by a malicious actor. The system is designed so that even in these scenarios, user privacy is preserved — not by policy, but by the impossibility of access.

This is not a legal guarantee. It is a mathematical and architectural one.

---

## Supported Versions

| Version | Security Updates |
|---------|-----------------|
| 1.x     | ✅ Active        |
| < 1.0   | ❌ Not supported |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through GitHub Issues.**

If you discover a security vulnerability in BENXI, please report it responsibly:

1. **Email:** security@benxi.org *(or open a private GitHub Security Advisory)*
2. **Encrypt your report** using our PGP key (see below)
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested remediation if known

We will acknowledge your report within **72 hours** and provide a detailed response within **7 days**.

We do not offer a paid bug bounty program at this time, but we will publicly credit researchers who responsibly disclose vulnerabilities (unless they prefer anonymity).

---

## Cryptographic Design

### Algorithms in Use

| Purpose | Algorithm | Key Size | Security Level |
|---------|-----------|----------|----------------|
| Key Agreement | X25519 (Curve25519 ECDH) | 256-bit | ~128-bit |
| Signatures | Ed25519 | 256-bit | ~128-bit |
| Symmetric Encryption | AES-256-GCM | 256-bit | 256-bit |
| Key Derivation | HKDF-SHA-256 | — | — |
| Hash | SHA-256 / SHA-512 | — | — |

### Protocol: Signal Protocol (X3DH + Double Ratchet)

BENXI implements the Signal Protocol, which provides:

- **Authentication** — Messages are cryptographically authenticated to sender identity keys
- **Confidentiality** — AES-256-GCM encryption, server cannot decrypt
- **Forward Secrecy** — Compromise of current keys does not expose past messages
- **Break-in Recovery** — After key compromise, future messages become secure again
- **Deniability** — Messages are not cryptographically bound to sender in a way provable to third parties

---

## Zero-Metadata Architecture

The BENXI server is architecturally prevented from knowing:

| Data Point | Server Knowledge |
|------------|-----------------|
| Message content | ❌ Never accessible (E2E encrypted) |
| Sender identity | ❌ Sealed sender — server sees only recipient |
| Sender IP address | ❌ Not logged by design |
| Recipient IP address | ❌ Not logged by design |
| Message timestamps | ❌ Not stored in retrievable form |
| Contact relationships | ❌ No contact graph maintained |
| Message frequency | ❌ Not logged |
| User location | ❌ Not collected |
| Device fingerprint | ❌ Not collected |

### What the Server Does Store

| Data | Retention | Purpose |
|------|-----------|---------|
| Public identity key | Until account deletion | Message delivery routing |
| Public prekeys | Until consumed or rotated | X3DH key exchange |
| Encrypted message blobs | Max 30 days | Async message delivery |
| Session tokens (hashed) | Until logout/expiry | Authentication |

All stored data is encrypted at rest using PostgreSQL `pgcrypto`.

---

## Authentication Model

BENXI uses a **challenge-response authentication** scheme based on public key cryptography. There are no passwords.

```
1. Client sends: { public_key }
2. Server responds: { challenge: random_nonce }
3. Client responds: { signature: Sign(challenge, private_key) }
4. Server verifies signature against stored public_key
5. Server issues short-lived session token (JWT, 24h expiry)
```

No password is ever transmitted or stored. The server cannot impersonate users.

---

## Transport Security

- **Protocol:** TLS 1.3 (TLS 1.2 disabled)
- **Cipher Suites:** AEAD only (AES-256-GCM, ChaCha20-Poly1305)
- **HSTS:** Strict-Transport-Security with preload
- **Certificate:** Let's Encrypt (auto-renewed)
- **Certificate Pinning:** Implemented in mobile apps

---

## Server Hardening (Deployment)

The deployment configuration enforces:

- Nginx access logging disabled (`access_log off`)
- Server version hidden (`server_tokens off`)
- No IP forwarding headers to backend
- Fail2ban rate limiting
- UFW firewall (ports 22, 80, 443 only)
- Non-root service user
- Docker network isolation (services not exposed externally)

---

## Client Security

### Web
- All keys stored in IndexedDB, encrypted with a device-derived key
- Service Worker intercepts no message content
- Content Security Policy headers enforced
- No third-party scripts, analytics, or tracking
- No cookies beyond session authentication

### Android
- Keys stored in Android Keystore (hardware-backed where available)
- Screen capture disabled on message screens
- Background snapshot blurred
- APK signed with release keystore

### iOS
- Keys stored in iOS Secure Enclave / Keychain
- Screen recording notifications
- Background app refresh limited
- App Transport Security enforced

---

## Known Limitations

BENXI does not protect against:

1. **Device compromise:** If an attacker has physical or software access to an unlocked device, they can read decrypted messages. Full-disk encryption and strong device PINs are recommended.

2. **Traffic analysis at scale:** A powerful adversary monitoring a significant portion of internet traffic may infer communication patterns through timing correlation, even without decrypting content.

3. **Recipient behavior:** Once a message is delivered and decrypted, the recipient controls it. There is no technical enforcement of confidentiality by the recipient.

4. **Compelled disclosure:** If a user is legally compelled to unlock their device, local message content may be accessed.

5. **Implementation bugs:** This software is provided as-is. See LICENSE. We make no warranty of fitness for high-risk use cases.

---

## Responsible Disclosure Policy

We ask security researchers to:

- Notify us before public disclosure
- Give us reasonable time (90 days) to remediate before disclosure
- Avoid accessing, modifying, or deleting user data during research
- Not perform denial-of-service testing on production infrastructure

We commit to:

- Respond promptly and transparently
- Not pursue legal action against good-faith researchers
- Credit researchers who wish to be credited

---

## PGP Key for Security Reports

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[PLACEHOLDER — Replace with actual PGP key before deployment]
-----END PGP PUBLIC KEY BLOCK-----
```

---

*Security policy version: 1.0 | BENXI by Omar Ben Sabyh*

# BENXI

> *"A world where no one holds total control, no one profits from your words, and no trace of you remains."*
> — Omar Ben Sabyh, Founder & Ideologist

---

## What is BENXI?

**BENXI** is a free, open-source, end-to-end encrypted private messaging platform built on a single radical principle: **your communication belongs to you — and only you.**

No metadata. No surveillance. No profit extraction. No backdoors. No social control by the powerful.

BENXI is not a product. It is a statement.

---

## Core Philosophy

BENXI was conceived by **Omar Ben Sabyh** as a response to a world in which the most intimate form of human expression — private conversation — has become a commodity, a surveillance vector, and a tool of social control.

The ideology behind BENXI rests on four pillars:

**1. Absolute Privacy**
No entity — not a government, not a corporation, not even the developers of BENXI — should have the ability to read, intercept, or reconstruct your communications.

**2. Zero Metadata**
Metadata is data. Who you speak to, when, how often, and from where reveals more about you than the content of your messages. BENXI is architected from the ground up to collect, store, and transmit zero metadata.

**3. No Monetization of Human Connection**
Human communication is not a resource to be mined. BENXI generates no revenue from its users, sells no data, serves no advertisements, and builds no behavioral profiles.

**4. Abolition of Social Control Vectors**
Platforms that accumulate user data become instruments of power. BENXI eliminates this possibility by design — there is nothing to seize, subpoena, or weaponize.

---

## Features

- **End-to-end encryption** (Signal Protocol / X3DH + Double Ratchet)
- **Zero metadata architecture** — no IP logs, no timestamps stored, no contact graphs
- **Anonymous accounts** — no phone number, no email required
- **Self-destructing messages** — configurable ephemeral messaging
- **Sealed sender** — the server cannot determine who is messaging whom
- **Forward secrecy** — compromise of one key does not expose past messages
- **Open source & auditable** — every line of code is public
- **Self-hostable** — run your own BENXI server on any VPS
- **Cross-platform** — Web, Android, iOS

---

## Project Status

> 🚧 **Alpha — Under Active Development**

| Component | Status |
|-----------|--------|
| Backend API | 🟡 In Progress |
| Web Client | 🟡 In Progress |
| Android App | 🟡 In Progress |
| iOS App | 🟡 In Progress |
| VPS Deployment | 🟢 Ready |
| Documentation | 🟢 Ready |

---

## Quick Start

### Run with Docker (Recommended)

```bash
git clone https://github.com/[your-org]/benxi.git
cd benxi
cp .env.example .env
docker-compose up -d
```

Visit `http://localhost:3000`

### Manual Setup

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full VPS deployment instructions.

---

## Repository Structure

```
benxi/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── api/          # Route handlers
│   │   ├── crypto/       # Encryption layer
│   │   ├── db/           # Database models
│   │   └── middleware/   # Auth, rate limiting
│   ├── Dockerfile
│   └── package.json
├── web/                  # React web client
│   ├── src/
│   │   ├── components/
│   │   ├── crypto/       # Client-side encryption
│   │   └── store/
│   └── package.json
├── mobile/               # React Native (Android + iOS)
│   ├── src/
│   │   ├── screens/
│   │   ├── crypto/
│   │   └── navigation/
│   └── package.json
├── docs/                 # Extended documentation
├── .github/              # CI/CD, issue templates
├── docker-compose.yml
├── ARCHITECTURE.md
├── DEPLOYMENT.md
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture and system design |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | VPS setup, Docker, Nginx, SSL |
| [SECURITY.md](./SECURITY.md) | Security model and threat analysis |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards |

---

## Attribution

BENXI was created by **Omar Ben Sabyh**.

If you use, fork, or build upon BENXI, a mention of the creator is appreciated but not required. The spirit of this project is freedom — including freedom from obligation.

> *"Take it. Use it. Make it yours. That is the point."*

---

## License

BENXI is dual-licensed under the **MIT License** and the **Apache License 2.0**.
You may choose either license when using or distributing this software.

See [LICENSE](./LICENSE) for full terms.

---

## Contributing

We welcome contributions from anyone who shares the values of this project.
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

---

*BENXI — because silence should be a choice, not an impossibility.*

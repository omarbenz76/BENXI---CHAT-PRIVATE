# Contributing to BENXI

Thank you for your interest in BENXI. This project exists because people who care about privacy chose to build and improve it. Your contribution — whether code, documentation, translation, or feedback — matters.

---

## Before You Start

Please read:
- [README.md](./README.md) — Project overview and philosophy
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical design
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Community standards
- [SECURITY.md](./SECURITY.md) — For security-related contributions

---

## Ways to Contribute

### Code
- Bug fixes
- New features aligned with project philosophy
- Performance improvements
- Cryptography improvements (requires peer review)

### Non-Code
- Documentation improvements
- Translations
- Bug reports
- Design and UX feedback
- Security audits

---

## Development Setup

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose
- Git

### Local setup

```bash
# Clone
git clone https://github.com/[omarbenz76]/benxi.git
cd benxi

# Backend
cd backend
npm install
cp ../.env.example .env
docker compose -f docker-compose.dev.yml up -d
npm run db:migrate
npm run dev

# Web client (new terminal)
cd ../web
npm install
npm run dev

# Mobile (new terminal)
cd ../mobile
npm install
npx react-native start
```

---

## Contribution Process

1. **Open an issue first** for significant changes — describe what you want to build and why
2. **Fork the repository**
3. **Create a branch:** `git checkout -b feature/your-feature-name`
4. **Make your changes**
5. **Write or update tests**
6. **Run the test suite:** `npm test`
7. **Commit** using conventional commits (see below)
8. **Open a Pull Request** — reference the related issue

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `security`

Examples:
```
feat(backend): add prekey rotation endpoint
fix(web): correct Double Ratchet ratchet step counter
docs(deployment): add UFW configuration step
security(crypto): upgrade to libsodium 1.0.20
```

---

## Code Standards

- **No telemetry, analytics, or tracking code** — ever, under any circumstances
- **No third-party services** that could leak user data
- **No external CDNs** for runtime dependencies
- **Privacy impact assessment** required for any new data handling
- JavaScript/TypeScript: ESLint + Prettier (configs included)
- Tests required for cryptographic functions

---

## Pull Request Guidelines

A good PR:
- Has a clear title and description
- References the related issue
- Includes tests for new functionality
- Updates documentation if needed
- Does not break existing tests
- Passes all CI checks

---

## Security Contributions

If your contribution touches cryptography or the security model, it will receive additional scrutiny and may require review from multiple maintainers. This is not a barrier — it is a sign that we take it seriously.

**Do not submit security vulnerabilities as public PRs.** See [SECURITY.md](./SECURITY.md) for responsible disclosure.

---

## A Note on Philosophy

BENXI has a specific ideological position: privacy is a right, not a privilege; metadata is data; and no entity should profit from or control human communication.

Contributions that undermine these principles — even in small ways — will not be merged, regardless of technical quality. This is not a technical project that happens to care about privacy. It is a privacy project that happens to be technical.

---

*BENXI by Omar Ben Sabyh — Contributions welcome, philosophy non-negotiable.*

# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies only (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/
COPY db/  ./db/

# ─── Production Stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 benxi && \
    adduser  -u 1001 -G benxi -s /bin/sh -D benxi

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=benxi:benxi /app .

USER benxi

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

EXPOSE 3001

CMD ["node", "src/index.js"]

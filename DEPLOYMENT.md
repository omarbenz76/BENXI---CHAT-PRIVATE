# BENXI — VPS Deployment Guide

Complete instructions for deploying BENXI on a VPS running **Ubuntu 22.04 LTS**.

Estimated setup time: 30–45 minutes.

---

## Prerequisites

- A VPS with Ubuntu 22.04 LTS (minimum 1 vCPU / 2GB RAM / 20GB SSD)
- A domain name pointed at your VPS IP (A record)
- SSH access to your server as root or sudo user

---

## Step 1 — Initial Server Setup

Connect to your VPS:

```bash
ssh root@YOUR_SERVER_IP
```

Update the system:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban
```

Create a non-root user:

```bash
adduser benxi
usermod -aG sudo benxi
```

Configure the firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Switch to the new user:

```bash
su - benxi
```

---

## Step 2 — Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | bash

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## Step 3 — Install Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Step 4 — Clone BENXI

```bash
cd /opt
sudo mkdir benxi
sudo chown benxi:benxi benxi
git clone https://github.com/[your-org]/benxi.git benxi
cd benxi
```

---

## Step 5 — Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit the following values:

```env
# === BENXI CONFIGURATION ===

# Domain
DOMAIN=yourdomain.com

# Backend
NODE_ENV=production
PORT=3001
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_64_CHARS_MIN

# Database
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=benxi
POSTGRES_USER=benxi_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD

# Message queue
MESSAGE_TTL_DAYS=30

# Rate limiting
MAX_REQUESTS_PER_MINUTE=60

# Logging — set to 'none' to disable all logging
LOG_LEVEL=error
```

Generate secure secrets:

```bash
# Generate JWT secret
openssl rand -hex 64

# Generate DB password
openssl rand -hex 32

# Generate Redis password
openssl rand -hex 32
```

---

## Step 6 — Build and Start Services

```bash
cd /opt/benxi
docker compose -f docker-compose.prod.yml up -d --build
```

Verify all services are running:

```bash
docker compose ps
```

Expected output:

```
NAME                STATUS          PORTS
benxi-backend-1     Up              0.0.0.0:3001->3001/tcp
benxi-db-1          Up              5432/tcp
benxi-redis-1       Up              6379/tcp
```

---

## Step 7 — Configure Nginx

Create the Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/benxi
```

Paste the following (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL — Certbot will fill these in
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "DENY" always;
    add_header X-XSS-Protection          "1; mode=block" always;
    add_header Referrer-Policy           "no-referrer" always;
    add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;

    # No server tokens (hide Nginx version)
    server_tokens off;

    # No access logs (privacy by design)
    access_log off;
    error_log /var/log/nginx/benxi_error.log crit;

    # API reverse proxy
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;

        # Do NOT forward real IP — privacy design
        proxy_set_header   X-Real-IP "";
        proxy_set_header   X-Forwarded-For "";
    }

    # WebSocket relay
    location /ws {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "Upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 86400;

        # Do NOT forward real IP
        proxy_set_header   X-Real-IP "";
        proxy_set_header   X-Forwarded-For "";
    }

    # Web client (static files)
    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/benxi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 8 — Obtain SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com \
    --non-interactive --agree-tos --email admin@yourdomain.com
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## Step 9 — Run Database Migrations

```bash
docker compose exec backend npm run db:migrate
```

---

## Step 10 — Verify Deployment

```bash
# Check backend health
curl https://yourdomain.com/api/v1/health

# Expected response:
# {"status":"ok","version":"1.0.0"}
```

---

## Docker Compose Configuration

The file `docker-compose.prod.yml` used in production:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - internal

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB:       ${POSTGRES_DB}
      POSTGRES_USER:     ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5
    networks:
      - internal

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --loglevel warning
    volumes:
      - redis_data:/data
    networks:
      - internal

volumes:
  pg_data:
  redis_data:

networks:
  internal:
    driver: bridge
```

---

## Maintenance

### View logs

```bash
# Backend logs
docker compose logs -f backend

# Database logs
docker compose logs -f db
```

### Update BENXI

```bash
cd /opt/benxi
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose exec backend npm run db:migrate
```

### Backup database

```bash
docker compose exec db pg_dump -U benxi_user benxi > backup_$(date +%Y%m%d).sql
```

### Restore database

```bash
cat backup_20250101.sql | docker compose exec -T db psql -U benxi_user benxi
```

---

## Fail2ban Configuration

Protect your SSH and Nginx from brute force:

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/benxi_error.log
maxretry = 10
```

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

---

## Mobile App Build

### Android

```bash
cd mobile
npm install
npx react-native run-android --mode=release
```

Or build APK:

```bash
cd mobile/android
./gradlew assembleRelease
# Output: mobile/android/app/build/outputs/apk/release/app-release.apk
```

### iOS (requires macOS + Xcode)

```bash
cd mobile
npm install
cd ios && pod install && cd ..
npx react-native run-ios --configuration Release
```

---

## Security Checklist

Before going live, verify:

- [ ] `.env` file is not committed to git (check `.gitignore`)
- [ ] JWT_SECRET is at least 64 characters, randomly generated
- [ ] Database password is strong and unique
- [ ] Redis password is set
- [ ] UFW firewall is active, only ports 22/80/443 open
- [ ] SSL certificate is valid
- [ ] Nginx access logs are disabled
- [ ] Server tokens are hidden (`server_tokens off`)
- [ ] Fail2ban is running
- [ ] Database backups are scheduled
- [ ] Regular OS updates are scheduled (`unattended-upgrades`)

---

*Deployment guide version: 1.0 | BENXI by Omar Ben Sabyh*

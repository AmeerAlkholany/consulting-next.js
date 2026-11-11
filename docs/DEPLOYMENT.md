# Production Deployment Guide

This guide describes how to deploy, configure, and maintain the psychological consultation platform in production.

---

## 1. Prerequisites & Hosting Architecture

- **Runtime:** Node.js 20.9+ (LTS) or Docker container (see [Dockerfile](file:///c:/Users/Ameer%20Al.kholany/Desktop/consulting-next.js/Dockerfile)).
- **Database:** PostgreSQL 16+ with `btree_gist` extension enabled (required for overlap exclusion constraints).
- **Cache/Rate Limiting:** Redis 7+ (optional; falls back safely to in-memory store if `REDIS_URL` is omitted).
- **Email Delivery:** SMTP service or Resend.

---

## 2. Environment Variables & Secret Configuration

Copy `.env.example` to `.env.production` and populate values:

- `DATABASE_URL`: Connection string with pooling.
- `DIRECT_URL`: Direct non-pooled connection for migrations (`prisma migrate deploy`).
- `SESSION_SECRET`: 64-character high-entropy secret for opaque token HMAC signing.
- `NOTES_ENCRYPTION_KEY`: 32-byte AES-256-GCM encryption key.
- `CRON_SECRET`: Secret token securing `/api/cron/*` endpoints against unauthorized execution.
- `NEXT_PUBLIC_APP_URL`: Canonical public URL (e.g. `https://consulting.example.com`).

---

## 3. Database Migration Pipeline

Before starting the application, run:

```bash
# Apply pending migrations using privileged migration credentials
pnpm prisma migrate deploy
```

---

## 4. Containerized Deployment (Docker)

```bash
# Build the optimized standalone container
docker build -t consulting-platform:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  --env-file .env.production \
  --name consulting-app \
  consulting-platform:latest
```

---

## 5. Health Checks & Monitoring

The platform exposes an automated health probe at:

```http
GET /api/health
```

- Returns `200 OK` with latency details when healthy.
- Returns `503 Service Unavailable` if database connectivity is lost.

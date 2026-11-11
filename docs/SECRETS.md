# Secrets & Sensitive Configuration Management

This document defines the secrets inventory, entropy requirements, and access controls for the platform.

---

## 1. Secrets Inventory

| Variable Name | Purpose | Minimum Entropy | Storage & Visibility |
|---|---|---|---|
| `DATABASE_URL` | Pooled PostgreSQL connection string | N/A (Secret URL) | Server runtime only |
| `DIRECT_URL` | Direct connection for migrations | N/A (Secret URL) | Migration pipeline only |
| `SESSION_SECRET` | Signing opaque session authentication tokens | 256 bits (64 hex / 44 base64 chars) | Server runtime only |
| `NOTES_ENCRYPTION_KEY` | AES-256-GCM clinical notes key | 256 bits (32 bytes) | Server runtime only |
| `CRON_SECRET` | Timing-safe authorization token for cron jobs | 256 bits | Server runtime only |
| `SMTP_PASSWORD` / `RESEND_API_KEY` | Mail transport credentials | Provider standard | Server runtime only |

---

## 2. Leakage Prevention Policies

1. **Static Linting:** ESLint rule `no-restricted-properties` strictly bans `process.env` access outside of `config/env.ts`.
2. **Log Redaction:** Pino is configured with `server/security/redaction.ts` to automatically mask `password`, `token`, `authorization`, `noteBody`, and `clientNote`.
3. **Zero Secrets in Git:** `.gitignore` and `.dockerignore` prevent accidental check-ins of `.env` files.

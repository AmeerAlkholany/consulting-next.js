# Operational Runbook

Operational procedures, incident recovery runbooks, and database backup/restore drills.

---

## 1. Database Backup & Restore Drill

### 1.1 Automated Backup Execution

```bash
# Snapshot complete platform database schema and data
pg_dump -Fc --no-acl --no-owner -h $DB_HOST -U $DB_USER -d $DB_NAME > "backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 1.2 Disaster Recovery / Restore Procedure

1. Verify target database has the `btree_gist` extension enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```
2. Restore snapshot into fresh or recovered database:
   ```bash
   pg_restore --clean --if-exists --no-acl --no-owner -h $DB_HOST -U $DB_USER -d $DB_NAME "backup_file.dump"
   ```
3. Run post-restore sanity check:
   ```bash
   pnpm prisma migrate status
   ```
4. Verify `/api/health` returns `{"status":"healthy"}`.

---

## 2. Cron Jobs & Outbox Drainage

Scheduled jobs execute via `/api/cron/*` endpoints guarded by `Authorization: Bearer <CRON_SECRET>`:

- `/api/cron/complete-appointments`: Closes past appointments.
- `/api/cron/send-reminders`: Sends 24-hour and 1-hour email notifications.
- `/api/cron/drain-outbox`: Dispatches queued email outbox messages.
- `/api/cron/prune`: Cleans up expired sessions, unverified tokens, and auto-cancels pending bookings.

---

## 3. Secret Rotation Procedures

- **`SESSION_SECRET`:** Rotating immediately invalidates all active sessions, requiring users to log in again.
- **`CRON_SECRET`:** Rotate concurrently in the hosting platform environment variables and scheduler config.
- **`NOTES_ENCRYPTION_KEY`:** Must be performed through an offline migration script re-encrypting existing ciphertext records.

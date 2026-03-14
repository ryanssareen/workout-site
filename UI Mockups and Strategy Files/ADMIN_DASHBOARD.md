# CoachTrack — Admin Dashboard & Backup System Plan

*March 14, 2026 · The Daily Athlete · Confidential*

---

## Overview

Two workstreams:
1. Update project docs to reflect bug fixes shipped to production
2. Design and build a hidden, Firebase-auth-gated admin dashboard for system backups and user management

---

## Part 1: Documentation Updates

### CLAUDE.md
- Remove closed issues: push notifications cross-user (#74), reports refresh loop (#76)
- Add admin page and backup system to architecture sections
- Safe-area fix note: use inline `style={{ paddingTop: 'env(safe-area-inset-top)' }}` only — Tailwind arbitrary classes unreliable on physical devices
- Notes filtering: tagged `tags: ['note']`, type `'other'` — filtered from workouts page before time/type tabs

### PRODUCT_STRATEGY.md — Add to "What's Done"
- Push notification cross-user fix (#74) — subscriptions scoped to logged-in user, cleanup on logout/switch
- Reports page refresh loop fix (#76) — stable `useCallback` deps (`user?.username` not full `user` object)
- Calendar UTC timezone fix (#73 bug 1) — use `start_date_local` not `start_date` from Strava
- Calendar merge UI fix (#73 bug 2) — optimistic removal of deleted Strava workout from state
- Safe-area inline style fix for iOS PWA (#67) — inline styles in landing page nav/main/footer
- Notes hidden from workouts page — filtered before time/type tabs

### DESIGN.md
- Add `/admin` page spec to Page Architecture section
- Update references to now-closed GitHub issues

---

## Part 2: Admin Dashboard Plan

### Security

**Layer 1 — Hidden URL**
- `/admin` is never linked anywhere in the app (no nav item, no footer, no page link)
- Only accessible by typing the URL directly

**Layer 2 — Firebase Auth + UID Allowlist**
- Admins log in with their existing Firebase credentials (no separate shared password)
- `ADMIN_UIDS=uid1,uid2` env var — gate checks if the authenticated user's UID is in the allowlist
- Per-person audit trail: every admin action is stamped with the acting UID
- Revoke access by removing a UID from the env var, no shared secret to rotate
- Server issues a signed JWT session cookie after validating the UID; cookie uses `jose` library (standard in Next.js projects) with expiry baked in — avoids rolling custom HMAC which is easy to get subtly wrong

**Rate Limiting on `/api/admin/verify`**
- 5 attempts per IP per 15 minutes — return `429 Too Many Requests` after limit hit
- Minimum 2-second delay added to all failure responses (exponential backoff preferred)
- Prevents brute-force if `/admin` URL is discovered

**CSRF Protection**
- All mutating routes (POST/DELETE/PATCH) validate the `Origin` header matches the app domain
- Prevents a malicious page from tricking an admin's browser into hitting e.g. `POST /api/admin/backup/[id]` (restore) with the session cookie present

---

### Admin Dashboard Layout

Single route: `/admin` — password/auth gate shown as a modal overlay on first visit. No separate `/admin/dashboard` route; simpler routing, no redirect logic needed.

**Section 1 — Overview**
- Total users, total workouts, active today
- Last backup timestamp, next scheduled backup
- Firestore read/write quota estimate (derived from internal counters)
- Strava API quota remaining (tracked in `system/stravaQuota` counter doc)
- Last successful cron run per job type (daily/weekly/monthly)
- Error rate in the last 24h
- Server health ping (green/red)

**Section 2 — Backups**
- Table: Daily (last 7), Weekly (last 4), Monthly (last 12) snapshots
- Each row: timestamp, type, user count, workout count, integrity status, Restore button, Restore User button
- "Trigger Manual Backup" button → `POST /api/admin/backup`
- Restore: confirmation modal → auto-snapshot current state first → batch write snapshot back to Firestore
- Per-user restore: "Restore User" opens a picker to select a user and a backup; calls `POST /api/admin/backup/[id]/restore-user?uid=...`

**Section 3 — Users**
- Paginated table: username, email, role, joined date, workout count, status (active/deleted)
- Per-row actions: View (side panel), Delete (soft-delete), Restore (re-enable), Export JSON (GDPR data portability)
- Search by email or username
- Bulk export: "Export All Users CSV" button (username, email, role, joined, workout count, status)

**Section 4 — System Actions**
- Force Strava Sync All — shows confirmation dialog with: user count, estimated Strava API calls, rate limit math (100 req/15min, 1000 req/day), estimated time. Disabled during active sync.
- Clear orphaned workouts
- Log viewer (two tabs):
  - **Cron Logs** — last 50 scheduled job runs from `adminLogs`
  - **Admin Actions** — all manual admin actions (backup triggered, restore triggered, user deleted, user restored, sync forced) with acting UID and timestamp

---

### Route Structure

```
src/app/admin/
  layout.tsx                   Standalone layout (no dashboard chrome)
  page.tsx                     Auth gate modal + dashboard in one route

src/app/api/admin/
  verify/route.ts              POST: validate Firebase token + UID allowlist, issue JWT cookie
  backup/route.ts              GET: list | POST: create backup
  backup/[id]/route.ts         GET: detail | POST: restore (full)
  backup/[id]/restore-user/    POST: restore single user's data from snapshot
    route.ts
  users/route.ts               GET: list all users | GET ?export=csv: download CSV
  users/[uid]/route.ts         DELETE: soft-delete | PATCH: restore | GET ?export=json: download JSON

src/app/api/cron/
  backup/route.ts              Scheduled backup (?type=daily|weekly|monthly)
```

---

### Backup System — Plan A (Firebase Storage)

**Storage:** `backups/{type}/{ISO-timestamp}.json` in Firebase Storage
**Format:** `{ users: [...], workouts: [...], personalRecords: [...] }`

**Cron schedules (`vercel.json`):**
```
Daily:    0 2 * * *    2am UTC every day
Weekly:   0 3 * * 1    Monday 3am UTC
Monthly:  0 4 1 * *    1st of month 4am UTC
```

**Backup process:**
1. Fetch all users from Firestore (Admin SDK)
2. Fetch workouts subcollection per user (incremental: filter by `updatedAt > lastBackupAt` for daily backups — see cost note below)
3. Fetch personalRecords
4. Serialize to JSON
5. Upload to Firebase Storage
6. **Integrity check:** verify `backup.users.length === expectedUserCount` before marking complete; throw on mismatch
7. Write metadata to Firestore `backups` collection: `{ type, createdAt, userCount, workoutCount, storagePath, integrityPassed }`
8. Prune old: keep last 7 daily, 4 weekly, 12 monthly

**Firestore read cost — important:**
Full backup reads every workout ever created. Cost scales linearly:
- 10 users × 500 workouts = 5,000 reads/backup → fine on Spark (50K/day limit)
- 100 users × 1,000 workouts = 100K reads/backup → hits daily Spark limit in one backup run

Mitigation: add `updatedAt: Timestamp` to all workout docs. Daily backups use incremental mode (only docs with `updatedAt > lastBackupAt`). Weekly/monthly do full snapshots. Document the threshold: go incremental before 50 users with heavy usage.

**Restore process:**
1. **Pre-restore snapshot:** auto-trigger a full backup of current state first; label it `pre-restore-{ISO-timestamp}`. Only proceed after this completes.
2. Read backup metadata from `backups/{id}`
3. Download JSON from Firebase Storage
4. Batch write users + workouts + records back to Firestore (update, not overwrite — data created after the backup is preserved)
5. Return `{ restored: { users, workouts, records } }`

**Per-user restore:**
- Accepts `?uid=` param; restores only that user's documents from the snapshot
- Covers the common case: one user reports data loss vs. full disaster recovery

---

### Admin Action Logging

Every admin action writes to `adminLogs` Firestore collection:

```ts
{
  action: 'backup_triggered' | 'restore_triggered' | 'user_deleted' | 'user_restored' | 'strava_sync_forced' | 'user_restore_triggered',
  adminUid: string,
  targetUid?: string,      // for user-scoped actions
  backupId?: string,       // for backup/restore actions
  timestamp: Timestamp,
  details?: Record<string, unknown>
}
```

Cron job runs also log here with `action: 'cron_backup'`.

---

### User Delete & Restore

**Delete (soft):**
```ts
await adminAuth.updateUser(uid, { disabled: true });
await adminDb.collection('users').doc(uid).update({ deletedAt: FieldValue.serverTimestamp() });
```

**Restore:**
```ts
await adminAuth.updateUser(uid, { disabled: false });
await adminDb.collection('users').doc(uid).update({ deletedAt: FieldValue.delete() });
```

---

### New Environment Variables (add to Vercel)

| Variable | Purpose |
|----------|---------|
| `ADMIN_UIDS` | Comma-separated Firebase UIDs allowed as admins (e.g. `uid1,uid2`) |
| `ADMIN_SECRET` | 32-char random string to sign JWT session cookies (via `jose`) |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket for backup file uploads |

> `ADMIN_PASSWORD` is **not** used — replaced by Firebase Auth + UID allowlist for per-person audit logs and easy revocation.

---

## Alternative: Plan B — Firestore-Only Backups

Use Firestore subcollections instead of Firebase Storage (for Spark plan short-term):
- `backups/{id}/users/{uid}` — user snapshot
- `backups/{id}/workouts/{wid}` — workout snapshot

| Factor | Plan B (Firestore) |
|--------|--------------------|
| Storage bucket needed | No |
| Backup speed | Slower (many small writes) |
| Quota impact | Yes — counts against 50K reads/day Spark limit |
| Best for | < 500 users, < 10K workouts |
| Security model | Same — UID allowlist gate unchanged |

> **Recommendation:** Use Plan A after upgrading to Blaze (pay-as-you-go, near-zero cost at small scale). Use Plan B short-term on Spark plan.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/admin/layout.tsx` | Create — standalone layout |
| `src/app/admin/page.tsx` | Create — auth gate modal + dashboard (single route) |
| `src/app/api/admin/verify/route.ts` | Create — Firebase token validation + UID allowlist + JWT cookie |
| `src/app/api/admin/backup/route.ts` | Create — list + create backups |
| `src/app/api/admin/backup/[id]/route.ts` | Create — detail + full restore |
| `src/app/api/admin/backup/[id]/restore-user/route.ts` | Create — per-user restore |
| `src/app/api/admin/users/route.ts` | Create — list all users + CSV export |
| `src/app/api/admin/users/[uid]/route.ts` | Create — delete, restore, JSON export |
| `src/app/api/cron/backup/route.ts` | Create — scheduled backup handler |
| `vercel.json` | Modify — add 3 cron schedules |
| `CLAUDE.md` | Update |
| `PRODUCT_STRATEGY.md` | Update |
| `DESIGN.md` | Update |

---

## Verification Checklist

- [ ] `/admin` shows auth gate modal, not linked from any nav or page
- [ ] Non-admin Firebase user → blocked with error message
- [ ] UID not in `ADMIN_UIDS` → denied even with valid Firebase token
- [ ] 6+ failed auth attempts from same IP → `429` response
- [ ] Admin UID → dashboard loads (single route, no redirect)
- [ ] Manual backup → file in Firebase Storage + metadata in `backups` collection + integrity flag set
- [ ] Restore triggers pre-restore snapshot before proceeding
- [ ] Per-user restore only touches that user's documents
- [ ] Delete test user → Auth disabled, `deletedAt` set in Firestore
- [ ] Restore test user → Auth re-enabled, `deletedAt` cleared
- [ ] All admin actions appear in `adminLogs` with correct `adminUid`
- [ ] CSRF: POST from different origin → rejected
- [ ] Strava Sync All shows rate limit math before proceeding
- [ ] CSV and JSON exports download correctly
- [ ] Cron backup jobs run on schedule (check Vercel cron dashboard)

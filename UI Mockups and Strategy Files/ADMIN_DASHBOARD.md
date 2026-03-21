# CoachTrack — Admin Dashboard & Backup System Plan

*March 14, 2026 · The Daily Athlete · Confidential*

> **STATUS: ✅ FULLY IMPLEMENTED** — All features built and deployed to production. Actual implementation deviates from the original plan in several areas (noted below with ⚠️ markers).

---

## Overview:

Two workstreams:
1. Update project docs to reflect bug fixes shipped to production ✅
2. Design and build a hidden, Firebase-auth-gated admin dashboard for system backups and user management ✅

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
- ⚠️ **Actual route:** `/youwillneverguessthisistheadmin` (not `/admin` as originally planned — `/admin` route was removed)
- Never linked anywhere in the app (no nav item, no footer, no page link)
- Only accessible by typing the URL directly

**Layer 2 — Password + Firebase Auth UID Allowlist**
- ⚠️ **Actual auth:** Password-based gate + HMAC-SHA256 signed session cookie (not jose JWT as originally planned)
- `ADMIN_PASSWORD` env var for auth gate login
- `ADMIN_UIDS` env var — additional UID allowlist check for Firebase Auth users
- `ADMIN_SECRET` env var — 32-char random string for HMAC-SHA256 cookie signing
- Per-person audit trail: every admin action is stamped with the acting UID
- Session token format: `timestamp:hmac` with `httpOnly` cookie (4h expiry, `sameSite=strict`)
- Uses constant-time comparison (`timingSafeEqual`) for HMAC verification

**Rate Limiting on `/api/admin/verify`**
- 5 attempts per IP per 15 minutes — return `429 Too Many Requests` after limit hit
- Minimum 2-second delay added to all failure responses (exponential backoff preferred)
- Prevents brute-force if `/admin` URL is discovered

**CSRF Protection**
- All mutating routes (POST/DELETE/PATCH) validate the `Origin` header matches the app domain
- Prevents a malicious page from tricking an admin's browser into hitting e.g. `POST /api/admin/backup/[id]` (restore) with the session cookie present

---

### Admin Dashboard Layout

Single route: `/youwillneverguessthisistheadmin` — password/auth gate shown as a modal overlay on first visit. No separate redirect needed.

**Tab 1 — Overview** ✅
- Total users, total workouts, last backup timestamp + integrity flag, server health

**Tab 2 — Backups** ✅
- ⚠️ **Actual storage:** Vercel Blob (not Firebase Storage as originally planned — avoids Blaze plan requirement)
- Daily metadata-only (delta) + weekly full snapshots
- Manual backup button, download-on-demand
- Restore from file upload (auto pre-restore snapshot first)
- Per-user restore with username input
- Seed backup upload (gzip)
- Auto-pruning: daily 7, weekly 4, monthly 6, manual 10, pre-restore 5

**Tab 3 — Users** ✅
- Table with search by username/email
- Per-row: Download JSON (GDPR export), Disable (soft-delete) / Re-enable
- Bulk CSV export

**Tab 4 — System Actions** ✅
- Force Strava Sync All — shows confirmation dialog with: user count, estimated Strava API calls, rate limit math (100 req/15min, 1000 req/day), estimated time. Disabled during active sync.
- Log viewer (two tabs):
  - **Admin Actions** — all manual admin actions with acting UID and timestamp
  - **Cron Logs** — scheduled job runs from `adminLogs`

**Tab 5 — API Playground** ✅ (not in original plan)
- ⚠️ **New section** — not part of original plan, added during implementation
- Route: `/youwillneverguessthisistheadmin/api` (also accessible at `/admin/api`)
- Execute any of 88+ registered API endpoints with custom params
- Response timing display
- API Registry: catalog of endpoints grouped by 14 categories (admin, cron, AI, auth, strava, webhooks, workouts, import, templates, email, reports, export, push, other) with search/filter
- Defined in `src/lib/api-registry.ts`

---

### Route Structure (As Implemented)

```
src/app/youwillneverguessthisistheadmin/
  layout.tsx                   Standalone layout (no dashboard chrome, noindex robots meta)
  page.tsx                     Auth gate modal + 5-tab dashboard in one route
  api/page.tsx                 API playground page

src/app/api/admin/
  verify/route.ts              GET: check session | POST: exchange password for HMAC cookie | DELETE: logout
  backup/route.ts              GET: list | POST: create backup (Vercel Blob)
  backup/[id]/route.ts         GET: detail | POST: restore (full, auto pre-restore snapshot)
  backup/[id]/restore-user/    POST: restore single user's data from snapshot
    route.ts
  backup/download/route.ts     GET: download latest backup
  backup/seed/route.ts         POST: upload seed backup (gzip)
  users/route.ts               GET: list all users | GET ?export=csv: download CSV
  users/[uid]/route.ts         DELETE: soft-delete | PATCH: restore | GET ?export=json: download JSON
  logs/route.ts                GET: fetch admin logs (?type=actions|cron)
  assign-athletes/route.ts     POST: manually assign athletes (legacy)
  migrate-merged-workouts/     POST: run merge migration
    route.ts

src/app/api/cron/
  backup/route.ts              Scheduled backup (?type=daily|weekly|monthly)

src/lib/
  admin-auth.ts                HMAC-SHA256 session signing, verifyPasswordSessionToken, checkOrigin, logAdminAction
  backup.ts                    createBackup — Vercel Blob storage, shared between manual trigger + cron
  api-registry.ts              Catalog of 88+ API endpoints grouped by 14 categories
```

---

### Backup System — ⚠️ Implemented with Vercel Blob (not Firebase Storage)

**Storage:** `backups/{type}/{ISO-timestamp}.json` in **Vercel Blob** (via `@vercel/blob` package — `put`, `del`, `list`, `get` operations)
**Format:** `{ users: [...], workouts: [...], personalRecords: [...] }`
**Env var:** `BLOB_READ_WRITE_TOKEN` (not `FIREBASE_STORAGE_BUCKET`)

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
5. Upload to Vercel Blob
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
3. Download JSON from Vercel Blob
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

### Environment Variables (on Vercel)

| Variable | Purpose |
|----------|---------|
| `ADMIN_UIDS` | Comma-separated Firebase UIDs allowed as admins (e.g. `uid1,uid2`) |
| `ADMIN_SECRET` | 32-char random string for HMAC-SHA256 session cookie signing |
| `ADMIN_PASSWORD` | Password for admin dashboard auth gate |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage access for backups |

> ⚠️ Original plan said `ADMIN_PASSWORD` would not be used, but actual implementation uses password-based auth + HMAC-SHA256 (not jose JWT). `FIREBASE_STORAGE_BUCKET` is not needed — backups use Vercel Blob instead.

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

## Files Created / Modified (All Done ✅)

| File | Status |
|------|--------|
| `src/app/youwillneverguessthisistheadmin/layout.tsx` | ✅ Created — standalone layout with noindex robots meta |
| `src/app/youwillneverguessthisistheadmin/page.tsx` | ✅ Created — auth gate modal + 5-tab dashboard |
| `src/app/youwillneverguessthisistheadmin/api/page.tsx` | ✅ Created — API playground (not in original plan) |
| `src/app/api/admin/verify/route.ts` | ✅ Created — password + HMAC-SHA256 session cookie |
| `src/app/api/admin/backup/route.ts` | ✅ Created — list + create backups (Vercel Blob) |
| `src/app/api/admin/backup/[id]/route.ts` | ✅ Created — detail + full restore |
| `src/app/api/admin/backup/[id]/restore-user/route.ts` | ✅ Created — per-user restore |
| `src/app/api/admin/backup/download/route.ts` | ✅ Created — download latest backup |
| `src/app/api/admin/backup/seed/route.ts` | ✅ Created — upload seed backup (gzip) |
| `src/app/api/admin/users/route.ts` | ✅ Created — list all users + CSV export |
| `src/app/api/admin/users/[uid]/route.ts` | ✅ Created — delete, restore, JSON export |
| `src/app/api/admin/logs/route.ts` | ✅ Created — admin/cron log viewer |
| `src/app/api/cron/backup/route.ts` | ✅ Created — scheduled backup handler |
| `src/lib/admin-auth.ts` | ✅ Created — HMAC-SHA256 signing, session verification, CSRF, audit logging |
| `src/lib/backup.ts` | ✅ Created — Vercel Blob backup logic |
| `src/lib/api-registry.ts` | ✅ Created — 88+ endpoint catalog |
| `vercel.json` | ✅ Modified — added 5 cron schedules |
| `CLAUDE.md` | ✅ Updated |
| `PRODUCT_STRATEGY.md` | ✅ Updated |
| `DESIGN.md` | ✅ Updated |

---

## Verification Checklist (All Passing ✅)

- [x] `/youwillneverguessthisistheadmin` shows auth gate modal, not linked from any nav or page
- [x] Non-admin user → blocked with error message
- [x] Wrong password → denied with 2s delay
- [x] 6+ failed auth attempts from same IP → `429` response
- [x] Valid password → dashboard loads (single route, 5 tabs)
- [x] Manual backup → file in Vercel Blob + metadata in `backups` collection + integrity flag set
- [x] Restore triggers pre-restore snapshot before proceeding
- [x] Per-user restore only touches that user's documents
- [x] Delete test user → Auth disabled, `deletedAt` set in Firestore
- [x] Restore test user → Auth re-enabled, `deletedAt` cleared
- [x] All admin actions appear in `adminLogs` with correct `adminUid`
- [x] CSRF: POST from different origin → rejected
- [x] Strava Sync All shows rate limit math before proceeding
- [x] CSV and JSON exports download correctly
- [x] Cron backup jobs run on schedule (daily/weekly/monthly via Vercel cron)
- [x] API Playground can execute endpoints with custom params
- [x] API Registry shows 88+ endpoints with search/filter

# CoachTrack — Admin Dashboard & Backup System Plan

*March 14, 2026 · The Daily Athlete · Confidential*

---

## Overview

Two workstreams:
1. Update project docs to reflect bug fixes shipped to production
2. Design and build a hidden, password-protected admin dashboard for system backups and user management

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
- Calendar UTC timezone fix (#73 bug 1) — use `start_date` not `start_date_local` from Strava
- Calendar merge UI fix (#73 bug 2) — optimistic removal of deleted Strava workout from state
- Safe-area inline style fix for iOS PWA (#67) — inline styles in landing page nav/main/footer
- Notes hidden from workouts page — filtered before time/type tabs

### DESIGN.md
- Add `/admin` page spec to Page Architecture section
- Update references to now-closed GitHub issues

---

## Part 2: Admin Dashboard Plan

### Security (Two-Layer)

**Layer 1 — Hidden URL**
- `/admin` is never linked anywhere in the app (no nav item, no footer, no page link)
- Only accessible by typing the URL directly

**Layer 2 — Password Gate**
- Separate from Firebase Auth — a standalone password prompt (no username field)
- `POST /api/admin/verify` → checks `ADMIN_PASSWORD` env var → sets signed `httpOnly` cookie
- Cookie: `admin_session`, 4-hour expiry, signed with `ADMIN_SECRET` env var
- All admin API routes validate this cookie before processing
- Wrong password: generic error only, no detail

---

### Admin Dashboard Layout

**Section 1 — Overview**
- Total users, total workouts, active today
- Last backup timestamp, next scheduled backup
- Server health ping (green/red)

**Section 2 — Backups**
- Table: Daily (last 7), Weekly (last 4), Monthly (last 12) snapshots
- Each row: timestamp, type, user count, workout count, Restore button
- "Trigger Manual Backup" button → `POST /api/admin/backup`
- Restore: confirmation modal → batch write snapshot back to Firestore

**Section 3 — Users**
- Paginated table: username, email, role, joined date, workout count, status (active/deleted)
- Per-row actions: View (side panel), Delete (soft-delete), Restore (re-enable)
- Search by email or username

**Section 4 — System Actions**
- Force Strava Sync All
- Clear orphaned workouts
- Log viewer: last 50 cron runs from `adminLogs` Firestore collection

---

### Route Structure

```
src/app/admin/
  layout.tsx                   Standalone layout (no dashboard chrome)
  page.tsx                     Password gate UI
  dashboard/page.tsx           Main admin dashboard

src/app/api/admin/
  verify/route.ts              POST: check password, set cookie
  backup/route.ts              GET: list | POST: create backup
  backup/[id]/route.ts         GET: detail | POST: restore
  users/route.ts               GET: list all users
  users/[uid]/route.ts         DELETE: soft-delete | PATCH: restore

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
2. Fetch workouts subcollection per user
3. Fetch personalRecords
4. Serialize to JSON
5. Upload to Firebase Storage
6. Write metadata to Firestore `backups` collection: `{ type, createdAt, userCount, workoutCount, storagePath }`
7. Prune old: keep last 7 daily, 4 weekly, 12 monthly

**Restore process:**
1. Read backup metadata from `backups/{id}`
2. Download JSON from Firebase Storage
3. Batch write users + workouts + records back to Firestore (update, not overwrite)
4. Return `{ restored: { users, workouts, records } }`

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
| `ADMIN_PASSWORD` | Password to enter the admin panel |
| `ADMIN_SECRET` | 32-char random string to sign the session cookie |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket for backup file uploads |

---

## Alternative: Plan B — Firestore-Only Backups

Use Firestore subcollections instead of Firebase Storage (for Spark plan):
- `backups/{id}/users/{uid}` — user snapshot
- `backups/{id}/workouts/{wid}` — workout snapshot

| Factor | Plan B (Firestore) |
|--------|--------------------|
| Storage bucket needed | No |
| Backup speed | Slower (many small writes) |
| Quota impact | Yes — counts against 50K reads/day Spark limit |
| Best for | < 500 users, < 10K workouts |
| Security model | Same — password gate unchanged |

> **Recommendation:** Use Plan A after upgrading to Blaze (pay-as-you-go, near-zero cost at small scale). Use Plan B short-term on Spark plan.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/admin/layout.tsx` | Create — standalone layout |
| `src/app/admin/page.tsx` | Create — password gate UI |
| `src/app/admin/dashboard/page.tsx` | Create — main admin dashboard |
| `src/app/api/admin/verify/route.ts` | Create — password check + cookie |
| `src/app/api/admin/backup/route.ts` | Create — list + create backups |
| `src/app/api/admin/backup/[id]/route.ts` | Create — detail + restore |
| `src/app/api/admin/users/route.ts` | Create — list all users |
| `src/app/api/admin/users/[uid]/route.ts` | Create — delete + restore user |
| `src/app/api/cron/backup/route.ts` | Create — scheduled backup handler |
| `vercel.json` | Modify — add 3 cron schedules |
| `CLAUDE.md` | Update |
| `PRODUCT_STRATEGY.md` | Update |
| `DESIGN.md` | Update |

---

## Verification Checklist

- [ ] `/admin` shows password gate, not linked from any nav or page
- [ ] Wrong password → error shown, no dashboard access
- [ ] Correct password → `/admin/dashboard` loads
- [ ] Direct visit to `/admin/dashboard` without cookie → redirect to `/admin`
- [ ] Manual backup → file in Firebase Storage + metadata in Firestore `backups` collection
- [ ] Delete test user → Auth disabled, `deletedAt` set in Firestore
- [ ] Restore test user → Auth re-enabled, `deletedAt` cleared
- [ ] Cron backup jobs run on schedule (check Vercel cron dashboard)

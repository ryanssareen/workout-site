---
title: "feat: Push notification enrichment, account isolation, and coach fan-out"
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/2026-04-20-push-notification-summary-requirements.md
---

# feat: Push Notification Enrichment, Account Isolation & Coach Fan-Out

## Overview

Three layered improvements to the push notification system, addressing issue #78 and extending it to a coach-aware architecture:

1. **Enrich notification bodies** — Strava webhook notifications currently say "A new workout was synced from Strava". Show workout name, sport emoji, distance, and duration instead.
2. **Verify account isolation** — Confirm no cross-athlete leakage exists; document the guarantee explicitly.
3. **Coach fan-out** — When any linked athlete's Strava activity is processed, the coach also receives a push notification that includes the athlete's name.

## Problem Statement

- **Notification bodies are generic** (issue #78): athletes can't tell what was synced without opening the app.
- **Coaches are blind to real-time athlete activity**: they only receive a notification when an athlete manually marks a coach-assigned workout as completed. Strava sync events, which represent actual training, are invisible to coaches.
- **No explicit account-isolation guarantee**: while the underlying `sendPushNotification` is correctly scoped, the contract is undocumented and should be verified as coach fan-out adds cross-account sends.

## Proposed Solution

### Part 1 — Enrich notification bodies (origin: docs/brainstorms/2026-04-20-push-notification-summary-requirements.md)

Extend `processActivity`'s return type to carry `workoutName`, `workoutType`, `distanceMeters`, and `durationSeconds`. Add a `formatWorkoutBody()` helper and use it in the webhook notification sender.

**Decision carried from origin:** Carry details in the return value — NOT via an extra Firestore read — because the data is already in scope at every success return site.

### Part 2 — Account isolation

No code changes needed. The current system is secure:
- `sendPushNotification(username, payload)` reads only `users/{username}.pushSubscriptions` — no cross-user reads.
- Webhook finds the target athlete via `where('stravaId', '==', ownerId)` — maps one Strava account to one app user.
- Push subscription scoping (issue #74) removes prior-user subscriptions on device switch.

The only new cross-account send introduced by this plan is coach←athlete, which is an explicit opt-in relationship via `coachUsername`.

### Part 3 — Coach fan-out

When the Strava webhook successfully processes an activity, check if the athlete has a `coachUsername`. If so, send a second notification to the coach with the athlete's name prepended to the body.

**Zero extra Firestore reads** in the webhook path — `userDoc.data()` (line 386, webhook route) already contains `coachUsername`.

Manual sync adds **one** Firestore read to fetch `coachUsername` if not already in scope.

## Technical Approach

### Files to Modify

| File | Change |
|------|--------|
| `src/app/api/webhooks/strava/route.ts` | Extend return type, add `formatWorkoutBody()`, add coach fan-out in `.then()` |
| `src/app/api/strava/sync/route.ts` | Add coach fan-out after sync notification (one Firestore read) |

No other notification paths (weekly wrap, coach/route.ts, PushNotificationManager) require changes.

### Webhook Route Changes (`src/app/api/webhooks/strava/route.ts`)

#### 1. Extend the return type (line 369)

```typescript
// Before
Promise<{ success: boolean; message: string }>

// After
Promise<{
  success: boolean;
  message: string;
  workoutName?: string;
  workoutType?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  coachUsername?: string;   // ← new: fan-out target
  athleteDisplayName?: string; // ← new: for coach notification body
}>
```

#### 2. Add `formatWorkoutBody()` helper (near top of file, after `mapStravaType`)

```typescript
const SPORT_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '⚡',
};

function formatWorkoutBody(
  name?: string,
  type?: string,
  distanceMeters?: number,
  durationSeconds?: number,
): string {
  const parts: string[] = [];
  if (name) parts.push(`${SPORT_EMOJI[type ?? ''] ?? '🏅'} ${name}`);
  if (distanceMeters && distanceMeters > 0)
    parts.push(`${(distanceMeters / 1000).toFixed(1)} km`);
  if (durationSeconds && durationSeconds > 0) {
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.floor((durationSeconds % 3600) / 60);
    parts.push(h > 0 ? `${h}h ${m}min` : `${m} min`);
  }
  return parts.join(' • ') || 'A new workout was synced from Strava';
}
```

#### 3. Update success return sites in `processActivity` to carry details

Three success returns have `activity` and `workoutType` in scope:

- **Line 463** (proximity duplicate — no notification, skip)
- **Line 656** (reconciled existing workout):
  ```typescript
  return {
    success: true,
    message: `Reconciled Strava activity ...`,
    workoutName: activity.name,
    workoutType,
    distanceMeters: activity.distance,
    durationSeconds: activity.moving_time,
    coachUsername: userData.coachUsername ?? undefined,
    athleteDisplayName: userData.displayName ?? username,
  };
  ```
- **Line 668** (newly created workout): same additions
- Matched-planned-workout path (~line 535): same additions

#### 4. Use helper + coach fan-out in the `.then()` callback (lines 833–851)

```typescript
.then(async (result) => {
  if (result.success) {
    const userSnap = await adminDb.collection('users')
      .where('stravaId', '==', String(ownerId)).limit(1).get();
    if (!userSnap.empty) {
      const username = userSnap.docs[0].id;
      const titleByAspect: Record<string, string> = {
        create: '🏃 New Strava Workout',
        update: '🔄 Strava Workout Updated',
        delete: '🗑️ Strava Workout Removed',
      };

      const body = aspect_type === 'delete'
        ? (result.workoutName ? `${result.workoutName} was removed` : 'A workout was removed from Strava')
        : formatWorkoutBody(result.workoutName, result.workoutType, result.distanceMeters, result.durationSeconds);

      // Notify the athlete
      await sendPushNotification(username, {
        title: titleByAspect[aspect_type] || '🔄 Strava Sync',
        body,
        url: '/workouts',
      }).catch(() => {});

      // Fan-out to coach if linked
      if (result.coachUsername) {
        const athleteName = result.athleteDisplayName || username;
        const coachBody = aspect_type === 'delete'
          ? `${athleteName}: ${result.workoutName ?? 'a workout'} was removed`
          : `${athleteName}: ${body}`;
        await sendPushNotification(result.coachUsername, {
          title: titleByAspect[aspect_type] || '🔄 Athlete Strava Sync',
          body: coachBody,
          url: `/workouts`,
        }).catch(() => {});
      }
    }
  }
})
```

> **Note on existing userSnap query**: The `.then()` callback already queries for `username` via `where('stravaId', ...)`. The `coachUsername` is now returned from `processActivity` (no extra read). Net cost: 0 additional Firestore reads vs current.

### Manual Sync Route Changes (`src/app/api/strava/sync/route.ts`)

After the existing notification block at line 1239–1245, add coach fan-out:

```typescript
if (newWorkoutsCount > 0 || mergedWorkoutsCount > 0) {
  sendPushNotification(userId, {
    title: '🏃 Strava Sync Complete',
    body: message,
    url: '/workouts',
  }).catch(() => {});

  // Fan-out to coach (1 Firestore read)
  adminDb.collection('users').doc(userId).get().then((userDoc) => {
    const coachUsername = userDoc.data()?.coachUsername;
    const athleteName = userDoc.data()?.displayName || userId;
    if (coachUsername) {
      sendPushNotification(coachUsername, {
        title: '🏃 Athlete Strava Sync Complete',
        body: `${athleteName}: ${message}`,
        url: '/workouts',
      }).catch(() => {});
    }
  }).catch(() => {});
}
```

## System-Wide Impact

### Interaction Graph
- `POST /api/webhooks/strava` → `processActivity()` → `.then()` sends to athlete → sends to `result.coachUsername` (if set). Both `sendPushNotification` calls are non-blocking (`.catch(() => {})`).
- `POST /api/strava/sync` → existing notification → one Firestore read → conditional coach notification. Coach send is fire-and-forget.

### Error Propagation
Both coach notifications are wrapped in `.catch(() => {})` — coach notification failures never surface to the response or the athlete notification. Coach fan-out is best-effort.

### State Lifecycle Risks
None. Notifications are fire-and-forget with no state mutations.

### API Surface Parity
- `src/app/api/notifications/coach/route.ts` (existing coach completion notification) does NOT need changes — it already includes athlete name in the body.

## Acceptance Criteria

- [ ] **R1** (origin): Strava webhook create/update notifications show sport emoji, name, distance, duration — e.g. `"🏃 Morning Run • 5.2 km • 32 min"`.
- [ ] **R2** (origin): Zero-value fields (distance=0 or duration=0) are omitted from the body.
- [ ] **R3** (origin): Delete notification body includes workout name when available.
- [ ] **R4** (origin): Fallback body `"A new workout was synced from Strava"` used when details unavailable.
- [ ] **R5**: When athlete has a `coachUsername`, the coach receives a separate push notification for every Strava webhook create/update/delete event.
- [ ] **R6**: Coach notification body prepends the athlete's display name: `"John: 🏃 Morning Run • 5.2 km • 32 min"`.
- [ ] **R7**: Manual Strava sync also fan-outs to the coach with athlete name in body.
- [ ] **R8**: Athletes with no `coachUsername` receive no coach notification (no regression).
- [ ] **R9**: `npm run build` passes with no TypeScript errors.

## Success Metrics
- Push notification bodies on a real device show workout details instead of the generic string.
- Coaches receive push notifications for their athletes' Strava activity without receiving other coaches' athletes' notifications.

## Dependencies & Risks

| Item | Notes |
|------|-------|
| `coachUsername` field on user doc | Must be set on athlete docs for fan-out to work. If unset, fan-out is silently skipped — correct behavior. |
| Firestore read budget | Webhook path: 0 extra reads. Manual sync: 1 extra read per sync with activity changes. Low risk. |
| Coach push subscriptions | Coach must have subscribed to push notifications (PWA installed + permission granted) to receive fan-out. If no subscriptions, `sendPushNotification` silently succeeds with no sends. |
| Duplicate notifications in `.then()` | The `.then()` callback currently re-queries `userSnap` for `username`. The `coachUsername` is now carried from `processActivity` result — we avoid a second user-doc read. |

## Sources & References

### Origin Document
- **[docs/brainstorms/2026-04-20-push-notification-summary-requirements.md](docs/brainstorms/2026-04-20-push-notification-summary-requirements.md)** — Key decisions carried forward:
  - Carry workout details in return value (not extra Firestore reads)
  - Sport emoji local constant map
  - `formatWorkoutBody()` with graceful zero-field omission

### Internal References
- `src/lib/push.ts` — `sendPushNotification(username, payload)` — core send function
- `src/app/api/webhooks/strava/route.ts:366-675` — `processActivity()` return sites
- `src/app/api/webhooks/strava/route.ts:833-854` — notification `.then()` callback
- `src/app/api/strava/sync/route.ts:1239-1245` — manual sync notification block
- `src/app/api/mcp/route.ts:223-235` — `getLinkedAthletes` (established coach-athlete query pattern)
- `src/app/api/notifications/coach/route.ts:84-88` — existing coach completion notification (reference for body format)
- `src/types/index.ts:19` — `coachUsername?: string` field on User

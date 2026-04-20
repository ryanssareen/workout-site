---
title: "Enrich Strava push notifications with workout details and add coach fan-out"
date: "2026-04-20"
category: "integration-issues"
tags: [push-notifications, strava, webhooks, coach-athlete, fan-out, web-push, firestore-read-budget]
components: [strava-webhook-handler, strava-sync-route, push-notification-system, coach-athlete-relationship]
problem_type: "feature_addition"
severity: "low"
resolution_time: "2-4 hours"
related_issues: ["#78", "#74", "#84", "#86", "#109"]
---

# Enrich Strava Push Notifications with Workout Details and Coach Fan-Out

## Problem

Push notifications for Strava webhook events (activity created/updated/deleted) showed a generic body — `"A new workout was synced from Strava"` — for every event. Users could not tell what was synced without opening the app.

Additionally, coaches linked to athletes via `coachUsername` received no real-time push notifications when their athletes synced Strava activities. They only learned about completed workouts when an athlete manually marked a coach-assigned workout as done.

**Symptoms:**
- All Strava webhook push notification bodies were identical regardless of workout type, name, distance, or duration.
- Coaches had no visibility into athlete real-time training activity via push.
- Issue #78 was filed as a bug requesting "Details to be added in push notification."

## Root Cause

Three separate gaps in `src/app/api/webhooks/strava/route.ts`:

1. **Thin return type**: `processActivity()` returned only `{ success: boolean; message: string }`. Workout details (`name`, `type`, `distance`, `moving_time`) were computed inside the function but never propagated to the caller.

2. **Wrong notification body source**: The `.then()` callback used `result.message` as the notification body — an internal log string like `"Created workout 'Morning Run' from Strava"` — instead of a user-facing formatted string.

3. **`coachUsername` discarded**: The `userData` object (containing `coachUsername`) was fetched inside `processActivity` at line 419 but never returned. The `.then()` callback had no way to fan-out to a coach without a second Firestore read.

## Solution

### 1. Define `ActivityResult` type

```typescript
// src/app/api/webhooks/strava/route.ts
type ActivityResult = {
  success: boolean;
  message: string;
  workoutName?: string;
  workoutType?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  coachUsername?: string;
  athleteDisplayName?: string;
};
```

### 2. Add `formatWorkoutBody()` helper

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
  if (distanceMeters && distanceMeters > 0)           // ← explicit > 0, not just truthy
    parts.push(`${(distanceMeters / 1000).toFixed(1)} km`);
  if (durationSeconds && durationSeconds > 0) {
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.floor((durationSeconds % 3600) / 60);
    parts.push(h > 0 ? `${h}h ${m}min` : `${m} min`);
  }
  return parts.join(' • ') || 'A new workout was synced from Strava';
}
// Example output: "🏃 Morning Run • 10.2 km • 52 min"
// Strength workout: "💪 Weight Session • 45 min"   (no distance)
```

### 3. Update all `processActivity` success return sites

All four success return paths (matched planned workout, merged imported workout, reconciled existing Strava workout, newly created workout) share the same additions. `activity` and `userData` are in scope at every site — **zero additional Firestore reads**:

```typescript
return {
  success: true,
  message: `Created workout "${activity.name}" from Strava`,
  workoutName: activity.name,
  workoutType,
  distanceMeters: activity.distance,
  durationSeconds: activity.moving_time,
  coachUsername: userData.coachUsername ?? undefined,
  athleteDisplayName: userData.displayName ?? username,
};
```

Also updated `processActivityUpdate` (return type only — it delegates to `processActivity`) and `processActivityDelete` (needed `userData` added since it previously only used `userDoc.id`).

### 4. Update `.then()` callback: rich body + coach fan-out

```typescript
.then(async (result) => {
  if (result.success) {
    const userSnap = await adminDb.collection('users')
      .where('stravaId', '==', ownerId).limit(1).get();
    if (!userSnap.empty) {
      const username = userSnap.docs[0].id;
      const titleByAspect = {
        create: 'New Strava Workout',
        update: 'Strava Workout Updated',
        delete: 'Strava Workout Removed',
      };

      const body = aspect_type === 'delete'
        ? (result.workoutName ? `${result.workoutName} was removed` : 'A workout was removed from Strava')
        : formatWorkoutBody(result.workoutName, result.workoutType, result.distanceMeters, result.durationSeconds);

      // Notify the athlete
      await sendPushNotification(username, {
        title: titleByAspect[aspect_type] || 'Strava Sync',
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
          title: titleByAspect[aspect_type] || 'Strava Sync',
          body: coachBody,
          url: '/workouts',
        }).catch(() => {});
      }
    }
  }
})
```

### 5. Manual sync route coach fan-out

`src/app/api/strava/sync/route.ts` — added after the existing athlete notification (one Firestore read, fire-and-forget):

```typescript
// Fan-out to coach if athlete is linked to one (1 Firestore read)
adminDb.collection('users').doc(userId).get().then((userDoc) => {
  const coachUsername = userDoc.data()?.coachUsername as string | undefined;
  const athleteName = (userDoc.data()?.displayName as string | undefined) || userId;
  if (coachUsername) {
    sendPushNotification(coachUsername, {
      title: 'Strava Sync Complete',
      body: `${athleteName}: ${message}`,
      url: '/workouts',
    }).catch(() => {});
  }
}).catch(() => {});
```

## Files Modified

- `src/app/api/webhooks/strava/route.ts` — `ActivityResult` type, `formatWorkoutBody()` helper, four success return sites updated, `.then()` callback updated with rich body and coach fan-out. Titles are emoji-free (sport emoji lives in the body only).
- `src/app/api/strava/sync/route.ts` — Post-sync coach fan-out via a non-blocking Firestore read. Titles are emoji-free.
- `public/sw.js` — Fallback notification title changed from `'The Daily Athlete'` to `'New Activity'`; the OS already displays the app name and icon in the notification header.

## Prevention Strategies

**Return rich objects from async helpers, not just success/message.** When a helper already reads a Firestore document, design its return type to carry all context a caller might need downstream. If a caller has to re-query the same doc, the return type is too thin. Audit return types whenever a new cross-cutting concern (notifications, audit logs, fan-out) is added to an existing call site.

**Push the relationship lookup into the function that already owns the document.** Coach-athlete relationships are a data concern. `coachUsername` should be extracted from `userData` inside `processActivity` (which already reads the user doc) rather than requiring a second read in the webhook handler. The rule: whoever reads the doc owns the fields extracted from it.

**Treat every Firestore read in a hot path as read-budget-sensitive.** Webhook handlers can fire thousands of times per day on this app's 50K reads/day Spark plan. Before adding a Firestore read, check whether an already-executed read in the same call stack carries the needed data. Thread it through return values instead of re-fetching.

**Make notification payloads data-driven.** Generic bodies like "New activity synced" are a symptom of missing return data, not a style choice. A vague notification body usually signals that data was discarded somewhere upstream. Treat it as a code smell.

## Gotchas & Edge Cases

**Don't put sport emoji in both the title and the body.** The OS notification UI stacks the title directly above the body, so `"🏃 New Strava Workout"` + `"🏃 Morning Run • 5.2 km"` shows the running emoji twice. Keep emoji in the body only (via `formatWorkoutBody`) and keep titles plain text. Similarly, don't put the app name in the title — the OS already shows the app name and icon in the notification header.

**Zero-value numeric fields need explicit `> 0` guards.** `distanceMeters = 0` is falsy, so `if (distanceMeters)` appears to work — but the intent is `distanceMeters > 0`. Strength workouts, yoga, and duration-only activities always have `distance = 0`. Never include a distance field in a notification body without `distanceMeters && distanceMeters > 0`.

**`processActivityDelete` is structurally different from create/update.** Delete events only receive a Strava activity ID, not full activity data. Adding `coachUsername`/`athleteDisplayName` to delete required pulling `userData` from the user doc, which `processActivityDelete` previously did not do (it only used `userDoc.id`). Future work on delete events must account for this asymmetry.

**Delegation chains silently break return types.** `processActivityUpdate` delegates to `processActivity`. When `ActivityResult` gained new fields, the delegate automatically returned the correct type — only because the return type was inferred, not explicitly annotated. If the delegating function had an explicit narrow annotation, the new fields would have been silently stripped. Avoid explicit narrow return-type annotations on thin delegation functions.

**`.catch(() => {})` swallows failures silently.** The non-fatal pattern is correct (a failed push must never fail a webhook response), but it produces zero log signal for broken subscriptions or expired VAPID keys. Consider logging inside the catch: `.catch((err) => console.error('[push] coach fan-out failed', err))`.

**Coach fan-out must remain fire-and-forget.** Strava expects a 200 response within a tight timeout. Any awaited work in the webhook handler extends response time. Coach sends must stay non-awaited.

**A coach may have many athletes.** The current shape (one athlete → one coach) is safe. If fan-out ever expands to group coaching or assistant coaches, the single-send pattern becomes an unbounded loop — document the assumption now.

## Testing Checklist

**Webhook — create event with distance (run/bike/swim)**
- [ ] Athlete push body: `"🏃 Morning Run • 5.2 km • 32 min"` (not generic string)
- [ ] Coach push body: `"John: 🏃 Morning Run • 5.2 km • 32 min"`
- [ ] No second Firestore user-doc read added (check Firebase emulator or console read count)

**Webhook — create event, distance = 0 (strength/yoga)**
- [ ] Notification body does not include a distance segment
- [ ] Duration still shows if `moving_time > 0`

**Webhook — delete event**
- [ ] Athlete body: `"Morning Run was removed"` (not generic)
- [ ] Coach body: `"John: Morning Run was removed"` if `coachUsername` set

**Manual sync**
- [ ] Coach receives `"John: Merged 2 workout(s) from Strava"` after sync
- [ ] Coach receives nothing if athlete has no `coachUsername` field

**Edge cases**
- [ ] Coach has no push subscription → silent no-op, webhook still returns 200
- [ ] Coach's subscription expired → `sendPushNotification` handles 410/404 and removes stale entry
- [ ] Athlete has no `coachUsername` → fan-out branch not entered, no error

## Pattern: Carry Data Through Async Return Values (Don't Re-Fetch)

**The problem this solves.** An async helper (A) reads a Firestore document. A caller (B) needs a field from that same document for a different purpose. The naive fix is a second query in B. The correct fix: extend A's return type.

**Three steps:**
1. Identify the authoritative reader — the function that already holds the data in memory.
2. Extend its return type. TypeScript surfaces every call site that destructures the result.
3. Thread returned fields to consumers (notification senders, log writers, fan-out functions). Consumers receive data, not Firestore references.

**When to apply:** Any time you write `const userDoc = await db.collection('users').doc(uid).get()` in a function called from a context where a `userDoc` was already fetched in the same request lifecycle.

**When not to apply:** Consumer runs in a genuinely separate execution context (different API route, background job, different request) — it must fetch its own data.

**Firestore budget corollary:** On a 50K reads/day Spark plan, a webhook handler that fires 1,000 times/day with one unnecessary re-fetch costs 1,000 reads/day — 2% of the daily budget from a single oversight. Carrying data through return values is a budget constraint on this codebase, not a style preference.

## Cross-References

- `src/lib/push.ts` — `sendPushNotification(username, PushPayload)` contract (non-blocking, expired-subscription auto-cleanup)
- `src/app/api/notifications/coach/route.ts` — existing coach completion notification pattern (reference for `coachUsername` lookup and body format)
- `src/app/api/mcp/route.ts:223-235` — `getLinkedAthletes()` (canonical `where('coachUsername', '==', coachUsername)` query pattern)
- CLAUDE.md §Push Notifications — VAPID setup, subscription storage, user-scoping behavior
- CLAUDE.md §Firestore Read Budget — read-budget design rules this solution follows
- [PR #109](https://github.com/ryanssareen/workout-site/pull/109)
- Issue #78 — original request for richer push notification summaries
- Issue #74 — push subscription scoping by username (prerequisite for correct fan-out)

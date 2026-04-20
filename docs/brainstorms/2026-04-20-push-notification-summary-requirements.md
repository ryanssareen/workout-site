---
date: 2026-04-20
topic: push-notification-summary
---

# Push Notification — Richer Workout Summaries

## Problem Frame
Push notifications for Strava webhook events (activity created/updated/deleted) currently show a generic body: "A new workout was synced from Strava". Users can't tell what was synced without opening the app. Issue #78 requests that workout-specific details — name, sport type, distance, and duration — appear directly in the notification body.

Manual sync, weekly wrap, and coach notifications are already descriptive and need no change.

## Requirements
- R1. When a Strava webhook triggers a **create** or **update** notification, the body must include the workout name, a sport emoji, distance (in km to 1 decimal), and duration — e.g. `"🏃 Morning Run • 5.2 km • 32 min"`.
- R2. Fields that are zero or missing (e.g. strength workouts have no distance) must be omitted gracefully — the notification must never show "0 km" or "0 min".
- R3. When a **delete** notification fires and the workout name is known, the body must name the removed workout — e.g. `"Morning Run was removed"`.
- R4. The fallback body when no workout details are available must remain `"A new workout was synced from Strava"` to avoid blank notifications.

## Success Criteria
- A post-sync push notification on a real device shows workout name + stats instead of the generic fallback string.
- Strength-only workouts (no distance) show name + duration only, no distance segment.
- `npm run build` passes with no TypeScript errors.

## Scope Boundaries
- Manual sync notification (`/api/strava/sync`) — already descriptive, out of scope.
- Weekly wrap push notification — already includes workout count, out of scope.
- Coach completion notification — already descriptive, out of scope.
- Notification icon, badge, sound, or action buttons — out of scope.

## Key Decisions
- **Carry details in the return value of `processActivity`** rather than doing an extra Firestore read in the notification sender. All required data (`activity.name`, `activity.distance`, `activity.moving_time`, `workoutType`) is already in scope at the success return sites — no extra reads needed.
- **Sport emoji via a local constant map** (`run→🏃`, `bike→🚴`, `swim→🏊`, `walk→🚶`, `strength→💪`, `other→⚡`). Keeps the webhook file self-contained without importing shared UI config.

## Dependencies / Assumptions
- `processActivity` (and `processActivityUpdate`, which delegates to it) has `activity` in scope at all success return sites — the data is available without extra fetches.
- The return type interface is local to `src/app/api/webhooks/strava/route.ts` — changing it does not affect any other module.

## Outstanding Questions

### Resolve Before Planning
*(none — implementation is unblocked)*

### Deferred to Planning
*(none)*

## Next Steps
→ Run `/ce:plan` for structured implementation planning.

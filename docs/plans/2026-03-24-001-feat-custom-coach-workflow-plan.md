---
title: "feat: Custom Coach Workflow"
type: feat
status: completed
date: 2026-03-24
origin: docs/brainstorms/2026-03-24-custom-coach-workflow-requirements.md
---

# feat: Custom Coach Workflow

## Enhancement Summary

**Deepened on:** 2026-03-24
**Agents used:** Security Sentinel, Performance Oracle, Architecture Strategist, Frontend Races Reviewer, TypeScript Reviewer, Best Practices Researcher, Data Integrity Guardian, Code Simplicity Reviewer

### Key Improvements from Deepening
1. **New Phase 0: Security Hardening** — Firestore rules are wide open; must tighten before multi-tenant coach features ship
2. **Simplified data model** — removed `assignedBy`/`assignedByName` fields (infer from `createdBy !== ownerUsername`), removed `actual*` fields (use existing workout fields + `completionRating`)
3. **Query strategy corrected** — parallel per-athlete queries with `Promise.all` + date bounds instead of collectionGroup (avoids index issues, guarantees fair athlete distribution)
4. **Concurrent edit safety** — added optimistic concurrency via `updatedAt` check in transactions
5. **~30-40% LOC reduction** from original plan via YAGNI simplifications
6. **Corrected read estimate** — ~6,200 reads/day per coach (original estimate was ~2x too low, still within budget)

### New Considerations Discovered
- Push subscription API has zero authentication (pre-existing vulnerability, now critical)
- Workouts API route (`/api/workouts`) has no auth — any caller can read/write any user's workouts via Admin SDK
- Admin secret has hardcoded fallback `'fallback-dev-secret'` in source code
- `updateDoc()` field-level merge prevents most concurrent edit corruption, but type changes can nuke sub-objects
- Multi-tab scenarios can duplicate cache misses (each tab has own Zustand store)

---

## Overview

Complete the coach workflow for The Daily Athlete — enabling coaches to manage athlete workouts, receive completion notifications, filter views by athlete, and email athletes on assignment. The codebase already has substantial scaffolding (`UserRole`, `coachUsername`, `getCoachStudents()`, `getUserWorkouts()` with role param, partial coach UI on calendar/workouts pages). This plan fills the gaps and wires everything together.

## Problem Statement

Coaches need a complete workflow to prescribe workouts, monitor athlete compliance, and communicate assignments. The existing code has type definitions and partial data layer support but no end-to-end workflow. Key gaps include: no admin linking API, incomplete CRUD permissions, no completion notifications, no assignment emails, and an undefined coach dashboard.

## Proposed Solution

Build the coach workflow in **5 phases**, ordered by dependency:

0. **Security Hardening** — Tighten Firestore rules, add auth to unprotected API routes
1. **Foundation** — Admin linking API, Firestore read optimizations, athlete self-creation fix
2. **Core CRUD** — Coach creates/edits/deletes workouts for athletes, athletes complete with notes + rating
3. **Communication** — Push notifications on completion, email on assignment
4. **Coach UX** — Athlete filter persistence, coach dashboard, page adaptations

## Technical Approach

### Architecture

**Data model changes (minimal):**
- **No new fields on Workout type** for coach attribution — infer from `createdBy !== ownerUsername` (helper: `isCoachAssigned(w)`)
- Add only `completionRating?: 1 | 2 | 3 | 4 | 5` to Workout type (existing `completionNotes` already covered by `completeWorkout()`)
- Existing fields used: `ownerUsername` (always athlete), `createdBy` (coach username when coach-assigned), `assignedTo` (athlete username)
- No new collections needed — coach-athlete relationship uses existing `coachUsername` on user doc

### Research Insights: Data Model

> **Simplicity review:** `assignedBy` is redundant — `createdBy !== ownerUsername` provides identical information with zero write-side bookkeeping. The only scenario where they'd differ (third-party creates workout) doesn't exist.
>
> **TypeScript review:** If additional coach metadata is ever needed, group it into a sub-object (`assignment?: { coachUsername, coachDisplayName }`) rather than flat fields. For v1, the inference approach eliminates this entirely.
>
> **Simplicity review:** `actualDistance`/`actualDuration`/`actualHeartRate` duplicate existing fields. When athlete completes via Strava merge, `buildTypeSpecificFields()` already overwrites the main fields. Use existing fields for actuals.

**Key architectural decisions:**
- Push notifications triggered via client-side API call after `completeWorkout()` (no Cloud Functions on Spark plan) — accept small risk of dropped notifications on client failure
- Strava merge of coach-assigned workouts also triggers notification (via Strava sync API route)
- Athletes with a coach CAN create their own workouts (unplanned activities must be loggable)
- Coach can edit/delete only workouts they created; read access to all athlete workouts
- "All Athletes" queries use **parallel per-athlete queries** with `Promise.all`, date bounds (90 days), and `limit(50)` per athlete
- Athlete filter persisted via simple `useCoachFilter()` hook with sessionStorage

### Implementation Phases

#### Phase 0: Security Hardening (PREREQUISITE)

> **Security Sentinel findings:** Firestore rules allow ANY authenticated user to CRUD ANY workout. Push subscription API has zero auth. Workouts API route has no auth. These pre-existing vulnerabilities become critical with multi-tenant coach features.

**0a. Tighten Firestore Rules for Workout Writes**

```
// firestore.rules — update workouts subcollection
match /users/{username}/workouts/{workoutId} {
  // Anyone authenticated can read (needed for public profiles, coach views)
  allow read: if request.auth != null;

  // Only owner can write their own workouts
  // Coach authorization enforced at application level (see 0b)
  allow create, update, delete:
    if request.auth != null
    && get(/databases/$(database)/documents/users/$(username)).data.uid == request.auth.uid;
}
```

> **Cost note:** Each `get()` in security rules = 1 read. This adds ~1 read per write operation (~50-100 writes/day across all users = negligible).

**Trade-off:** This blocks client-side coach writes. Coach workout creation must go through the server-side `/api/workouts` POST route (which uses Admin SDK, bypassing rules). This is actually more secure — all coach writes are server-validated.

**0b. Add Authentication to Workouts API Route**

`src/app/api/workouts/route.ts` — both GET and POST currently accept unauthenticated requests.

```typescript
// Add to both GET and POST handlers:
const authHeader = request.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const idToken = authHeader.split('Bearer ')[1];
const decodedToken = await adminAuth.verifyIdToken(idToken);
// For POST: verify decodedToken.uid matches the createdBy user
// For GET with role=coach: verify decodedToken.uid is actually a coach
```

**0c. Add Authentication to Push Subscription API**

`src/app/api/push/subscribe/route.ts` — verify Firebase ID token and confirm UID maps to the username in request body.

**0d. Remove Hardcoded Admin Secret Fallback**

```typescript
// src/lib/admin-auth.ts — change:
function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET env var is required');
  return secret;
}
```

#### Phase 1: Foundation

**1a. Admin Linking API (R1)**

Replace the hardcoded `/api/admin/assign-athletes/route.ts` with a proper parameterized endpoint.

```
POST /api/admin/assign-coach
```

```typescript
// src/app/api/admin/assign-coach/route.ts
// Request body: { coachEmail: string, athleteEmails: string[] }
// Auth: verifyAdminSession + checkOrigin (existing admin auth pattern)
// Logic:
//   1. Look up coach by email in users collection
//   2. Validate all athlete emails exist before writing (fail fast)
//   3. Use Firestore batch write to atomically:
//      - Set coach's role to 'coach' if not already
//      - Set coachUsername on each valid athlete doc
//   4. logAdminAction('coach_linked', { coachEmail, results })
//   5. Return per-athlete results + updated athlete list
// Idempotent: re-linking same pair is a no-op (reported as "already_linked")
```

### Research Insights: Admin API

> **Data Integrity review:** Use Firestore batch writes (not individual writes) for linking. Validate all athlete emails exist before constructing the batch to avoid partial failures.
>
> **TypeScript review:** Define a named result type:
> ```typescript
> type CoachLinkResult = 'linked' | 'athlete_not_found' | 'has_different_coach' | 'already_linked_to_you';
> interface AssignCoachResponse { results: Record<string, CoachLinkResult> }
> ```
>
> **Security Sentinel:** Verify the `checkOrigin` function — currently allows requests with no `Origin` header. Consider requiring it for admin endpoints.
>
> **Simplicity review:** Defer the admin unlink endpoint to post-v1. Unlinking is rare and can be done via Firebase console. Avoids building the "optionally revert role" complexity.

**1b. Firestore Read Optimization for Coach Queries**

Refactor `getUserWorkouts()` coach path in `src/lib/firebase/firestore.ts`:

```typescript
// CORRECTED: Use parallel per-athlete queries instead of collectionGroup
// Reason: collectionGroup + 'in' + inequality has index issues and unfair
// distribution with limit() (one prolific athlete can consume the entire limit)

const COACH_QUERY_WINDOW_DAYS = 90;

async function getCoachWorkouts(
  coachUsername: string,
  athleteUsername?: string // undefined = "All Athletes"
): Promise<Workout[]> {
  const cutoff = Timestamp.fromDate(
    subDays(new Date(), COACH_QUERY_WINDOW_DAYS)
  );
  const students = athleteUsername
    ? [{ uid: athleteUsername }]
    : await getCoachStudents(coachUsername);

  // Parallel queries with date bounds + per-athlete limit
  const results = await Promise.all(
    students.map(async (student) => {
      const ref = collection(db, 'users', student.uid, 'workouts');
      const q = query(ref,
        where('date', '>=', cutoff),
        orderBy('date', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        ownerUsername: student.uid,
      } as Workout));
    })
  );

  return results.flat().sort((a, b) =>
    (b.date?.toDate?.()?.getTime() ?? 0) - (a.date?.toDate?.()?.getTime() ?? 0)
  );
}
```

### Research Insights: Query Performance

> **Performance Oracle (CRITICAL):** The original plan's collectionGroup + `in` + inequality combination is problematic. The `in` operator with `limit` across a collection group produces results that are NOT evenly distributed — a prolific athlete could consume most of the limit, starving others. Also requires a `COLLECTION_GROUP`-scoped composite index that doesn't exist.
>
> **Recommended: Parallel per-athlete queries.** No new indexes needed (existing COLLECTION-scoped index on `date` suffices). Guarantees fair representation (each athlete gets up to 50). Promise.all cuts wall-clock time from ~N sequential round trips to ~1.
>
> **Read cost (corrected):** 20 athletes × ~30 docs each in 90 days = ~620 reads per page load. With 5-min cache and ~10 cache misses/day = **~6,200 reads/day per coach**. Two coaches = **~12,400 reads/day** — well within 50k budget, but roughly 2x the original estimate.
>
> **Performance Oracle:** Use `count().get()` in `getCoachDashboardStats()` instead of fetching all documents just to count them. 20 athletes × 3 counts = 60 reads vs 4,000+ reads.
>
> **Performance Oracle:** Make the 90-day bound configurable. Reporting pages may need 180-day or 365-day windows. The read cost scales linearly.

**1c. Athlete Self-Creation Fix**

Modify `/workouts/new/page.tsx` and `/workouts/page.tsx` to allow athletes with a coach to create their own workouts. Remove the `!user?.coachUsername` gate from `canCreate` and `canManageWorkouts`. Self-created workouts have `createdBy: athleteUsername`.

(see origin: docs/brainstorms/2026-03-24-custom-coach-workflow-requirements.md — R2 says athletes can edit assigned workouts; SpecFlow Gap 5 identified that athletes are currently blocked from all self-creation)

**1d. Helper Function for Coach Attribution**

```typescript
// src/lib/utils/workout.ts
export function isCoachAssigned(workout: Workout): boolean {
  return workout.createdBy !== workout.ownerUsername;
}

export function getCoachUsername(workout: Workout): string | null {
  return isCoachAssigned(workout) ? workout.createdBy : null;
}
```

#### Phase 2: Core CRUD (R2)

**2a. Coach Creates Workout for Athlete**

Already partially works via `createWorkout()` + WorkoutForm with athlete selector. The key change: coach workout creation MUST go through the `/api/workouts` POST route (not client-side Firestore) because Phase 0 tightened rules to owner-only writes.

- Server-side route verifies coach-athlete relationship before writing
- `createdBy` is set to coach's username (existing field, now serves as attribution)
- After creation, trigger assignment email (Phase 3)

Files: `src/app/api/workouts/route.ts` (POST handler), `src/components/workouts/WorkoutForm.tsx`

**2b. Athlete Sees "Assigned by Coach" Badge**

- `src/components/workouts/WorkoutCard.tsx` — show badge when `isCoachAssigned(workout)`
- `src/app/(dashboard)/workouts/[id]/page.tsx` — show attribution in header
- Badge text: look up coach display name from `createdBy` username (single doc read, cacheable)

**2c. Athlete Completes Assigned Workouts**

The existing `completeWorkout()` function already handles marking complete with notes. Add only `completionRating`:

```typescript
// Extend completeWorkout signature:
export async function completeWorkout(
  ownerUsername: string,
  id: string,
  completed: boolean,
  notes?: string,
  rating?: 1 | 2 | 3 | 4 | 5  // NEW
): Promise<void>
```

No new `LogResultsForm` component needed — the existing completion flow on the workout detail page (checkbox + notes textarea) just gets a rating picker added to it.

### Research Insights: Completion UX

> **Simplicity review:** The existing `completeWorkout()` already accepts notes. Athletes can update distance/duration via the existing fields when Strava merges. A dedicated `LogResultsForm` with `actualDistance`/`actualDuration`/`actualHeartRate` is YAGNI — it duplicates field semantics and creates "which distance is the real one?" ambiguity. Add only `completionRating` (genuinely new data point).
>
> **Data Integrity review:** Create a dedicated `logCompletion()` function that accepts ONLY athlete-owned fields (`completed`, `completionNotes`, `completionRating`, `completedAt`). This prevents accidental overlap with coach-owned fields in the update payload.

**2d. Coach Edits/Deletes Own-Created Workouts**

Already works. Keep existing `canEdit` logic:

```typescript
// canEdit = user.role === 'coach' && workout.createdBy === user.username
// canDelete for same condition
```

Coach has read-only access to athlete self-created and Strava-synced workouts.

### Research Insights: Concurrent Edit Safety

> **Frontend Races (CRITICAL):** Two users writing to the same Firestore document with blind `updateDoc()` is a data corruption risk. If coach changes workout type (triggering `deleteField()` on old type sub-objects) while athlete is completing, the athlete's completion data could be wiped.
>
> **Mitigation (sufficient for v1):** The field-level separation between coach fields (name, type, description) and athlete fields (completed, completionNotes, completionRating) means `updateDoc()` merge semantics protect against most conflicts. The remaining risk is coach changing `type` during athlete completion — low probability, and `updateDoc()` only deletes fields explicitly listed.
>
> **Future hardening:** Add `updatedAt` CAS check via Firestore transaction if concurrent editing becomes an issue. Not needed for v1 given field separation.

#### Phase 3: Communication (R4, R5)

**3a. Coach Notification API Route**

Single unified route for coach notifications:

```
POST /api/notifications/coach
```

```typescript
// src/app/api/notifications/coach/route.ts
// Request body: { type: 'completed' | 'assigned', ... }
// Auth: Firebase ID token

// Zod schema for request validation:
const CoachNotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('completed'),
    workoutId: z.string(),
    ownerUsername: z.string(),
  }),
  z.object({
    type: z.literal('assigned'),
    athleteUsername: z.string(),
    workouts: z.array(z.object({
      name: z.string(),
      type: z.enum(['swim', 'run', 'bike', 'walk', 'strength', 'other']),
      date: z.string().date(),
      description: z.string().optional(),
    })),
  }),
]);

// 'completed' path:
//   1. Read workout doc to check createdBy !== ownerUsername
//   2. If not coach-assigned, return early
//   3. Look up coach's pushSubscriptions via createdBy username
//   4. Check coach's notificationPreferences.coachMessages (opt-out)
//   5. sendPushNotification(coachUsername, payload)

// 'assigned' path:
//   1. Verify caller is the athlete's coach
//   2. Check athlete's notificationPreferences.coachMessages (opt-out)
//   3. Look up athlete email
//   4. Send via Brevo: generateAssignmentEmail(...)
//   5. One email per call (handles recurring batch as single email)
```

### Research Insights: Notifications

> **Architecture review:** Extract notification logic into a shared helper `notifyCoachOfCompletion(workoutId, ownerUsername)` in `src/lib/push.ts`. Both the client-facing API route and the Strava sync route should call the same function — avoids duplicating lookup-and-send logic.
>
> **Frontend Races:** Place fire-and-forget notification calls in event handlers, NOT in useEffect (React 19 Strict Mode runs effects twice). Always add `.catch(() => {})` — an unhandled rejection from a dangling fetch is sloppy.
>
> **Best Practices:** Add a daily cron reconciliation as a safety net for dropped notifications. Query workouts completed in last 24h with `createdBy !== ownerUsername` and `notificationSent !== true`. Read cost: ~50 docs/day max.
>
> **Best Practices (Brevo):** Free plan = 300 emails/day. Add application-level rate counter. Include `List-Unsubscribe` header. Use retry with backoff for 429/5xx.

Client-side trigger — in event handler, not effect:

```typescript
const handleComplete = async () => {
  await completeWorkout(ownerUsername, workoutId, true, notes, rating);
  toast.success('Workout completed!');

  if (isCoachAssigned(workout)) {
    const idToken = await getAuthInstance().currentUser?.getIdToken();
    fetch('/api/notifications/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ type: 'completed', workoutId, ownerUsername }),
    }).catch(() => {}); // fire-and-forget, non-critical
  }
};
```

**Also trigger from Strava merge path** — when Strava sync auto-completes a coach-assigned planned workout, call the shared `notifyCoachOfCompletion()` helper directly in `src/app/api/strava/sync/route.ts` (already server-side, reliable).

**3b. Assignment Email Template**

```typescript
// src/lib/email/assignmentTemplate.ts
// generateAssignmentEmail(data: {
//   coachName: string,
//   athleteName: string,
//   workouts: { name, type, date, description? }[],
//   dashboardUrl: string
// }): string
// Follow existing summaryTemplate.ts patterns (inline CSS, responsive)
// Include link to notification preferences in footer
```

#### Phase 4: Coach UX (R3, R6)

**4a. Athlete Filter Hook (R3)**

Simple custom hook with sessionStorage — no Zustand store needed for a single string value:

```typescript
// src/hooks/useCoachFilter.ts
export function useCoachFilter() {
  const [selectedAthlete, setSelectedAthlete] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return sessionStorage.getItem('coach_selected_athlete') ?? 'all';
  });

  const selectAthlete = useCallback((username: string) => {
    setSelectedAthlete(username);
    sessionStorage.setItem('coach_selected_athlete', username);
  }, []);

  return { selectedAthlete, selectAthlete };
}
```

### Research Insights: Filter Persistence

> **Simplicity review:** A new Zustand store for a single string is overkill. A 10-line custom hook wrapping useState + sessionStorage achieves the same result.
>
> **Frontend Races:** Validate the stored athlete against the fresh `getCoachStudents()` result after mount. If the stored value isn't in the list (admin removed the athlete), reset to 'all' and clear sessionStorage.
>
> **TypeScript review:** Consider a discriminated union type (`{ kind: 'all' } | { kind: 'specific'; username: string }`) instead of string sentinel 'all'. Eliminates "forgot to check for sentinel" bugs. For a simple hook, the string approach with the validation guard is acceptable for v1.

Update pages to use this hook:
- `src/app/(dashboard)/calendar/page.tsx` — replace existing `selectedAthlete` useState
- `src/app/(dashboard)/workouts/page.tsx` — add athlete filter dropdown for coaches
- `src/app/(dashboard)/reports/page.tsx` — add athlete filter dropdown for coaches

Dropdown component: reusable `AthleteSelector` component showing "All Athletes" + list from `getCoachStudents()`.

**4b. Coach Dashboard (R6)**

New component: `src/components/dashboard/CoachDashboard.tsx` — **scoped to 3 sections for v1:**

1. **Stats row** — total athletes, assigned this week, completion rate (use `count().get()` for efficiency)
2. **Upcoming assigned workouts** — across all athletes, with athlete name badges
3. **Recently completed** — by athletes, with athlete name and completion notes

```typescript
// dashboard/page.tsx
if (user.role === 'coach') return <CoachDashboard />;
return <AthleteDashboard />; // existing dashboard renamed
```

### Research Insights: Coach Dashboard

> **Architecture review:** Separate component is the right call — the existing dashboard has 10+ athlete-specific sections. Conditional rendering would create a branching mess. Strategy pattern at the page level keeps both independently testable.
>
> **Performance Oracle:** Refactor `getCoachDashboardStats()` to use `count().get()` aggregations instead of fetching all documents. 20 athletes × 3 counts = 60 reads vs 4,000+ reads.
>
> **Simplicity review:** Scope to 3 sections for v1. Aggregate type breakdown, combined activity chart, and athlete event countdowns can wait.

**4c. Navigation Adaptations**

Hide or relabel nav items for coaches:
- `/wrap`, `/review`, `/wrapped` — hide (no personal training data)
- `/progress`, `/records` — hide (no personal records)
- `/ai-coach` — hide (not applicable)
- `/workouts` — keep, shows athlete workouts
- `/calendar` — keep, shows athlete calendar
- `/reports` — keep, shows athlete reports
- `/settings` — keep, hide Strava section
- `/profile` — keep (coach has their own profile)

## System-Wide Impact

### Interaction Graph

- Coach creates workout → POST `/api/workouts` (server-side, bypasses Firestore rules) → writes to athlete's subcollection → triggers `POST /api/notifications/coach` (type: assigned) → Brevo sends email to athlete
- Athlete completes workout → `completeWorkout()` writes to own subcollection → triggers `POST /api/notifications/coach` (type: completed) → `sendPushNotification()` to coach
- Strava syncs → merge with coach-assigned planned workout → `notifyCoachOfCompletion()` helper called server-side
- Admin links coach → `POST /api/admin/assign-coach` → batch write sets `coachUsername` on athlete docs + `role: 'coach'` on coach doc

### Error Propagation

- Notification API failures are fire-and-forget (silent catch) — workout creation/completion still succeeds
- Email delivery failures logged but don't block the calling action; retry with backoff for Brevo 429/5xx
- Push to expired subscriptions auto-cleaned (existing 410/404 handling in `sendPushNotification`)
- Admin linking uses batch write — all-or-nothing for valid athletes; per-athlete error reporting for lookup failures

### State Lifecycle Risks

- **Coach filter hook** — sessionStorage scoped to tab. Cleared on logout (subscribe to authStore). Validated against fresh student list on mount.
- **Workout cache invalidation** — after coach creates workout for athlete, use **optimistic local insert** into workoutStore cache (prepend to array, reset `fetchedAt`). Avoid clear-then-refetch race.
- **Orphaned workouts** — if admin clears `coachUsername` on athlete, existing workouts with `createdBy: coachUsername` remain. Display correctly but coach can no longer edit. Acceptable.
- **coachStudentsCache** — module-level Map with 10-min TTL. Consider migrating to Zustand for visibility and explicit invalidation. Low priority for v1.

### Research Insights: Cache Invalidation

> **Frontend Races:** Do NOT use clear-then-refetch after workout creation — the re-fetch may arrive at Firestore before the write is committed. Use optimistic local insert: `workoutStore.getState().injectWorkout(athleteUsername, newWorkout)`. Next natural TTL expiry reconciles with server.
>
> **Data Integrity:** After linking, return updated athlete list in the API response. Client updates local state immediately from response, not waiting for cache expiry.

### Firestore Read Cost Estimate (CORRECTED)

| Operation | Reads | Frequency |
|---|---|---|
| Coach loads "All Athletes" workouts (10 athletes, 90-day, limit 50/athlete) | ~300-620 | Per page load (cached 5 min) |
| Coach loads single athlete workouts | ~30-50 | Per filter change (cached 5 min) |
| Coach loads athlete list | ~10 | Per page load (cached 10 min) |
| Coach dashboard stats (using count().get()) | ~60 | Per dashboard load (cached 5 min) |
| Athlete completes workout → notification API reads | 2 | Per completion |
| Coach creates workout → assignment email reads | 2 | Per creation |
| Firestore rules get() on workout writes | ~1 | Per write (~50-100/day total) |

**Corrected estimate for 2 active coaches:** ~6,000-12,000 reads/day (assuming 10 cache misses/day each). Well within 50k limit.

> **Performance Oracle:** The original estimate of 2,000-3,000 was ~2x too low. Multi-tab scenarios can spike reads further (each tab has own store). Consider localStorage-backed Zustand persist for cross-tab cache sharing as a future optimization.

## Acceptance Criteria

### Functional Requirements

- [ ] Firestore rules tightened: workout writes restricted to owner (coach writes via Admin SDK)
- [ ] Push subscription API and Workouts API require Firebase ID token auth
- [ ] Admin secret fallback removed (fails loudly if env var missing)
- [ ] `POST /api/admin/assign-coach` links coach to athletes by email, using batch writes, protected by admin auth
- [ ] Coach can create workouts for any linked athlete via server-side API route
- [ ] Created workouts appear in athlete's list with "Assigned by [Coach]" badge (inferred from `createdBy`)
- [ ] Athlete can mark assigned workouts as complete with notes and rating
- [ ] Athletes with a coach can also create their own workouts
- [ ] Coach receives push notification when athlete completes an assigned workout
- [ ] Push notification also fires when Strava sync auto-completes a coach-assigned workout
- [ ] Athlete receives email when coach assigns workout(s) — one email per creation action
- [ ] Email respects `notificationPreferences.coachMessages` opt-out
- [ ] Reports, Calendar, Workouts pages show athlete selector for coaches
- [ ] "All Athletes" is default, individual athlete selection available
- [ ] Filter selection persists across page navigation within session (via sessionStorage)
- [ ] Coach dashboard shows 3 sections: stats, upcoming, recently completed
- [ ] Coach nav hides personal-only pages (wrap, review, wrapped, progress, records, ai-coach)

### Non-Functional Requirements

- [ ] "All Athletes" query uses parallel per-athlete queries with 90-day date bounds and limit(50) per athlete
- [ ] Coach dashboard stats use `count().get()` aggregations
- [ ] Coach with 10 athletes stays under ~6,500 reads/day for normal usage
- [ ] Notification API calls are fire-and-forget in event handlers (not effects)
- [ ] Admin linking endpoint is idempotent with batch writes
- [ ] Zod schemas validate all API request bodies at the boundary

## Dependencies & Prerequisites

- Existing push notification infrastructure (`src/lib/push.ts`, `web-push` SDK)
- Existing email infrastructure (Brevo API in `src/app/api/notifications/`)
- Existing admin auth (`src/lib/admin-auth.ts`)
- Existing coach data layer (`getCoachStudents()`, `getCoachDashboardStats()`, `getUserWorkouts()` with role)
- Firestore composite index on `coachUsername` (already exists in `firestore.indexes.json`)
- **No new Firestore indexes needed** (parallel per-athlete approach uses existing COLLECTION-scoped index on `date`)

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Firestore rules too permissive for multi-tenant | **Critical** | Phase 0: tighten write rules, require owner UID match |
| "All Athletes" query exceeds read budget | High | 90-day bounds, limit(50)/athlete, parallel queries, 5-min cache |
| Dropped push notifications (client failure) | Low | Fire-and-forget acceptable; optional daily cron reconciliation |
| Concurrent coach + athlete editing same workout | Medium | Field-level `updateDoc` merge + separate field ownership (coach fields vs athlete fields) |
| Strava merge notification duplicates | Low | Check `completedBy` field + `notificationSent` flag |
| Coach has no push subscription | Medium | Show setup prompt in coach dashboard; push is best-effort |
| Multi-tab cache duplication | Low | Each tab has own Zustand store; future: localStorage cross-tab sync |
| Brevo email rate limiting (300/day free plan) | Low | Application-level counter + retry with backoff |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-24-custom-coach-workflow-requirements.md](docs/brainstorms/2026-03-24-custom-coach-workflow-requirements.md) — Key decisions: admin-controlled linking (no self-service), marked+editable workouts, push-only notifications, coach-only role (no personal workouts), "All Athletes" default view.

### Internal References

- Coach type definitions: `src/types/index.ts:3,16,19-20`
- Coach data layer: `src/lib/firebase/firestore.ts:128,349,405,498`
- Workout CRUD: `src/lib/firebase/firestore.ts:32,114,186,217,235`
- Push notifications: `src/lib/push.ts:34,105`
- Email via Brevo: `src/app/api/notifications/workout-comment/route.ts:141-163`
- Admin auth pattern: `src/lib/admin-auth.ts:61,87,99`
- Existing admin assign (to replace): `src/app/api/admin/assign-athletes/route.ts`
- Coach UI on calendar: `src/app/(dashboard)/calendar/page.tsx:57-108`
- Coach UI on workouts: `src/app/(dashboard)/workouts/page.tsx:287,306,323`
- Workout form athlete selector: `src/components/workouts/WorkoutForm.tsx:50-57`
- Workout store cache: `src/lib/stores/workoutStore.ts:21,27`
- Firestore rules: `firestore.rules:37-42`
- Push subscribe API (no auth): `src/app/api/push/subscribe/route.ts`

### Deepening Agent Reports

- **Security Sentinel:** 2 critical (Firestore rules, push API auth), 4 high (workouts API auth, write path verification, admin secret fallback, password-admin bypass)
- **Performance Oracle:** Corrected query strategy (parallel > collectionGroup), corrected read estimate (6,200/day vs 2,000-3,000), count().get() for stats
- **Architecture Strategist:** Endorsed overall structure, flagged missing index (now moot with parallel approach), recommended notification helper extraction
- **Frontend Races Reviewer:** Concurrent edit analysis (updateDoc merge is safe for non-overlapping fields), cache invalidation race (use optimistic insert), hydration safety for filter
- **TypeScript Reviewer:** Sub-object grouping for related fields, Zod schemas at API boundary, discriminated union for filter
- **Best Practices Researcher:** Validated relationship-based access model, Zustand persist patterns, Brevo rate limiting, daily cron reconciliation
- **Data Integrity Guardian:** Batch writes for linking, dedicated logCompletion function, field ownership enforcement
- **Code Simplicity Reviewer:** ~30-40% LOC reduction via YAGNI simplifications (remove assignedBy, actual* fields, LogResultsForm, coachFilterStore, admin unlink)

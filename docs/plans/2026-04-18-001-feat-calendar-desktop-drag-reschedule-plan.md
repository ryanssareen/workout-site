---
title: "feat(calendar): desktop drag-and-drop rescheduling"
type: feat
status: active
date: 2026-04-18
origin: https://github.com/ryanssareen/workout-site/issues/104
issue: "#104 (child of #103)"
---

# feat(calendar): desktop drag-and-drop rescheduling

## Context

Today rescheduling a workout in [calendar/page.tsx](../../src/app/(dashboard)/calendar/page.tsx) requires three taps: open the workout → edit date on the detail page → save. For a spatially obvious action on a visual calendar, this is friction. Issue [#104](https://github.com/ryanssareen/workout-site/issues/104) is the **desktop slice** of a larger UX improvement (parent [#103](https://github.com/ryanssareen/workout-site/issues/103)); mobile long-press and the broader Late-stigma removal land in separate child issues.

This plan delivers drag-and-drop rescheduling on the week view and full-month view for `md+` viewports (≥768px), preserving time-of-day, updating training-plan metadata when present, and giving the athlete ~5 s of Undo via a success toast.

## Problem Frame

- **User pain:** Rescheduling is 3+ taps for something spatially obvious.
- **Product bet:** Direct manipulation makes the calendar feel adjustable, which increases engagement with the planned-vs-actual loop.
- **Scope discipline:** Desktop only; the cross-surface "Late" work and mobile long-press are tracked separately — so the cleanest implementation sits entirely within [src/components/calendar/](../../src/components/calendar/) and the calendar page.

## Requirements Trace

From issue [#104](https://github.com/ryanssareen/workout-site/issues/104):

- **R1.** Drag workout cards between day cells in week view + full-month view.
- **R2.** Draggable = planned (future, uncompleted) + missed (past, uncompleted). Completed and Strava-synced NOT draggable.
- **R3.** On drop, `workout.date` updates. Multi-workout days allowed. No within-day reordering.
- **R4.** Any day is a valid drop target — past, present, future.
- **R5.** Drag affordance: grab cursor, pickup animation (scale 1.03 + shadow), ghost preview follows cursor, source placeholder, target-cell highlight.
- **R6.** Success toast with Undo (~5 s TTL).
- **R7.** Plan-workout toast: *"Part of your training plan, week N."* sourced from `planMeta.weekNumber`, no plan-name lookup.
- **R8.** Esc or off-grid drop cancels with no toast.
- **R19.** Preserve original time-of-day in user's local timezone on drop.
- **R20.** No guardrails on cross-ISO-week drags; accepted consequence.
- **R21.** Auto-update `planMeta.weekNumber` to match ISO week of new date. `planMeta.phase` preserved.

## Scope Boundaries

**In scope (this plan):**
- Desktop drag across week view + full-month view, `md+` viewport.
- Time-of-day preservation via timezone-aware rebuild of the date.
- `planMeta` type + schema wiring + `weekNumber` recompute (user decision — see "Key Technical Decisions").
- PostHog event `reschedule_drag_desktop`.

**Out of scope (explicit):**
- Mobile long-press / bottom-sheet reschedule → separate child issue (avoid conflict with `useSwipe`).
- Late-stigma badge removal across 7 surfaces → separate child issue.
- Completion inline prompt ("Keep on date" / "Move to today") → separate child issue.
- Multi-select / bulk move; within-day reordering; keyboard-only drag.
- Day view + year view drag.
- Persisting training plans that *write* `planMeta` — schema only. Writing planMeta on workout creation is a separate training-plans persistence issue. Drag-time recomputation is the only write this plan performs.
- Strava-webhook-vs-drag race mitigation — documented as accepted risk for v1.

## Context & Research

### Relevant Code and Patterns

- [src/components/calendar/CalendarWeekView.tsx](../../src/components/calendar/CalendarWeekView.tsx) — grid-cols-7, 1 row on mobile and 2 rows on `md+` (two-week layout, line 53). Day cells currently attach `onClick={() => onSelectDate(day)}` (line 103) and overflow-hidden (line 105).
- [src/components/calendar/CalendarFullMonthView.tsx](../../src/components/calendar/CalendarFullMonthView.tsx) — 4–6 rows × 7 cols; pills use `micro` mode (max 3 per cell).
- [src/components/calendar/CalendarWorkoutCard.tsx](../../src/components/calendar/CalendarWorkoutCard.tsx) — `MiniPill` (line 118) and `MicroPill` render as `<button>` (not `<Link>`), so drag wrappers won't fight Next.js prefetch. `CompactCard` uses `<Link>` (line 257) — that's the mobile list card, out of scope.
- [src/components/calendar/CalendarWorkoutCard.tsx:35-49](../../src/components/calendar/CalendarWorkoutCard.tsx) — `getWorkoutStatus` defines the six states; draggable = `isFuture || isMissed` AND `!isStravaStandalone` AND `!completed`.
- [src/app/(dashboard)/calendar/page.tsx:166-186](../../src/app/(dashboard)/calendar/page.tsx) — `handleToggleComplete` is the **exact optimistic pattern to mirror**: `setWorkouts` optimistic → toast → Firestore write → `invalidateWorkouts` → rollback on catch.
- [src/lib/firebase/firestore.ts](../../src/lib/firebase/firestore.ts) — `updateWorkout` (line 197) already accepts a partial including `date` and writes via `Timestamp.fromDate`. A dedicated `rescheduleWorkout` helper is justified because we also need to atomically write `planMeta.weekNumber`.
- [src/lib/stores/workoutStore.ts](../../src/lib/stores/workoutStore.ts) — Zustand store; `invalidate(username, role)` (line 86) clears cache and refetches.
- [src/lib/dayKey.ts](../../src/lib/dayKey.ts) — `parseLocalDate`, `getDayKey`, `normalizeTimezone`. These are the timezone-safe primitives that must carry the drop through (per learnings from #86).
- [src/lib/dateUtils.ts](../../src/lib/dateUtils.ts) — `safeToDate`, `formatInTimezone` already used pervasively in calendar code.
- [src/lib/posthog.ts](../../src/lib/posthog.ts) — `track(event, properties)`; used throughout.
- [package.json](../../package.json) — sonner `^2.0.7` supports `toast.success(msg, { action: { label, onClick } })`.

### Institutional Learnings

[docs/solutions/](../solutions/) contains only one UX-bug document unrelated to drag/timezone/reschedule. The load-bearing prior art lives in code:

- **#86 timezone fix** — `parseLocalDate` exists precisely because `new Date(isoLocalString)` on a UTC server shifts late-evening IST days. Drag must rebuild dates through `parseLocalDate` + `getDayKey`, not raw `Date.setDate`.
- **#85 cache invalidation** — `workoutStore` cache must be invalidated after mutations so the workouts page reflects changes.
- **Optimistic precedent** — `handleToggleComplete` is the team's blessed pattern: local state first, Firestore second, `invalidateWorkouts` in background, revert on catch.

### External References

- [@dnd-kit/core docs](https://docs.dndkit.com/) — primitives used: `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`, `closestCenter`.
- Bundle size: `@dnd-kit/core` ~10–12 kB gzipped + `@dnd-kit/utilities` ~2 kB. Sortable skipped (no within-cell reordering).

## Key Technical Decisions

- **Library = `@dnd-kit/core` + `@dnd-kit/utilities`, skip `@dnd-kit/sortable`.** Native HTML5 DnD is a non-starter because `draggable` on child `<a>`/`<Link>` elements hijacks link drag, and touch isn't supported. Sortable adds ~8 kB for reordering we don't need. React 19.2 is fully supported on `@dnd-kit/core` v6.3+.
- **`DragOverlay` via portal, not in-place transforms.** Calendar cells and the dashboard layout use `overflow-hidden` / `overflow-x-hidden`. In-place transforms clip the ghost across row borders on the tablet two-week layout. Portal-mounted overlay avoids this with zero CSS churn.
- **Collision detection = `closestCenter`.** Cross-row drops on the tablet two-week layout (week view `md+`) need a collision strategy that traverses all droppables regardless of DOM row; pointer-within can miss due to small gutters.
- **PointerSensor with `{ distance: 8 }` activation constraint.** 8 px threshold cleanly separates sub-threshold clicks (card select → detail panel) from drags. Pointer (not Mouse) so tablets in landscape `md+` layout work; mobile long-press handoff happens at the `<md` viewport gate (see below), not via input-type discrimination.
- **`md+` viewport gate.** `<DndContext>` is only mounted when `window.matchMedia('(min-width: 768px)').matches` — mobile viewport falls through to the future long-press flow without wasting bundle or adding interference.
- **New `rescheduleWorkout(ownerUsername, id, newDate, planMeta?)` helper in Firestore layer.** Atomic write of `date` + `updatedAt` + optional `planMeta.weekNumber`. Keeps the drag handler single-call; prevents "date updated, weekNumber stale" as a partial-write failure mode.
- **Time-of-day preservation via timezone-aware rebuild.** Extract `{h, m, s}` from original date in user timezone, apply those to new `{y, m, d}` in user timezone via the same `parseLocalDate` shape used by Strava sync. Do **not** use `date.setDate()` on a UTC Date object — the #86 failure mode.
- **`planMeta` added to Workout type in this plan (user decision).** Shape: `{ planId: string; weekNumber: number; phase?: string; planStartDate?: Timestamp }`. `planStartDate` is stored on the workout's `planMeta` so `weekNumber` recompute is deterministic without a secondary `trainingPlans/{planId}` lookup (that collection doesn't exist yet). No code in this plan *writes* planMeta at workout creation — drag is the only writer, conditional on the field already being present.
- **In-flight drag guard via ref.** A `draggingIdRef` on the page ensures rapid successive drags of the same workout don't interleave Firestore writes; latest drop wins, earlier promises' `.then()` see the guard has moved on and skip their rollback/invalidate.
- **No Strava-webhook race mitigation in this plan.** Issue explicitly accepts the narrow window where a drag during in-flight Strava sync could create a duplicate; we document this and revisit if it's real.

## Open Questions

### Resolved During Planning

- **DnD library choice** — `@dnd-kit/core` per external research (bundle, R19 compat, touch, clip-free overlay).
- **`planMeta` scope** — user chose "Add schema in this plan." Type + Firestore wiring land here; no creation-time writes.
- **`src/lib/training/summary.ts` `toIsoDate`** — file does not exist. Requirement effectively not applicable. When that file is later created, its author must apply user timezone (not raw UTC). Noted as a risk for the future training-summary work, not a blocker here.
- **`trainingPlans/{planId}.startDate` for ISO-week math** — that collection doesn't exist. Store `planStartDate` on `planMeta` itself so recompute is self-contained on the workout.
- **Mobile viewport behavior** — drag disabled below `md` so the future long-press flow isn't pre-empted.

### Deferred to Implementation

- Exact `DragOverlay` styling polish (shadow radius, scale curve) — settle during visual QA.
- Whether to disable the cell's `onClick={() => onSelectDate(day)}` during a drag pickup, or let dnd-kit's activation distance suppress it naturally — validate in dev.
- Whether `MicroPill` in full-month view needs a different drag handle affordance than `MiniPill` (both are `<button>` with `cursor-pointer`; may need `cursor-grab` on hover).

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
CalendarPage (src/app/(dashboard)/calendar/page.tsx)
│
├── state: workouts, draggingIdRef
├── handleDragEnd(event) ────────┐
│     │                          │
│     ▼                          │
│   rescheduleWorkout(           │
│     ownerUsername,             │
│     id,                        │
│     newDate,          ← timezone-aware rebuild of date
│     planMeta?                  │    (parseLocalDate + getDayKey)
│   )                            │
│                                │
└── <CalendarDndContext>         │  (mounted only on md+)
      │                          │
      ├── CalendarWeekView       │
      │    └── DroppableDayCell (per day)
      │         └── DraggableWorkoutCard
      │              └── MiniPill  (existing, unchanged internals)
      │
      └── CalendarFullMonthView
           └── DroppableDayCell (per day)
                └── DraggableWorkoutCard (micro variant)
                     └── MicroPill (existing, unchanged internals)

      <DragOverlay> (portal — escapes overflow-hidden)
           └── preview of the picked-up pill

Firestore write shape:
  { date: Timestamp, updatedAt: serverTimestamp(), planMeta?: { ...existing, weekNumber: N } }

Toast shape (sonner):
  toast.success("Moved to Apr 21", {
    description: planMeta ? "Part of your training plan, week 4." : undefined,
    duration: 5000,
    action: { label: "Undo", onClick: () => reschedule back }
  })
```

Cross-row drop on the tablet two-week layout is handled by `closestCenter` — it walks all registered droppables, not just those in the pointer's DOM row.

## Implementation Units

- [ ] **Unit 1: Schema, Firestore helper, week-number util, dependency install**

**Goal:** Land the type, persistence, and math primitives that the UI layer will consume. Lets Units 2–4 be pure UI work.

**Requirements:** R3 (atomic date write), R19 (timezone-preserving date), R21 (weekNumber recompute).

**Dependencies:** None.

**Files:**
- Modify: [package.json](../../package.json) (add `@dnd-kit/core`, `@dnd-kit/utilities`)
- Modify: [src/types/index.ts](../../src/types/index.ts) (add `PlanMeta` interface + `planMeta?: PlanMeta` on `Workout`)
- Modify: [src/lib/firebase/firestore.ts](../../src/lib/firebase/firestore.ts) (add `rescheduleWorkout` helper)
- Create: `src/lib/training/weekNumber.ts` (ISO-week computation from `planStartDate` + `newDate`)
- Test: `src/__tests__/rescheduleWorkout.test.ts`
- Test: `src/__tests__/weekNumber.test.ts`

**Approach:**
- `PlanMeta = { planId: string; weekNumber: number; phase?: string; planStartDate?: Timestamp }` on `Workout`.
- `rescheduleWorkout(ownerUsername, id, newDate, planMetaUpdate?)` — single `updateDoc` with `{ date: Timestamp.fromDate(newDate), updatedAt: serverTimestamp(), ...(planMetaUpdate && { planMeta: planMetaUpdate }) }`. Not a transaction because there's only one doc; one `updateDoc` is already atomic across its fields.
- `computePlanWeekNumber(newDate: Date, planStartDate: Date): number` — uses `differenceInCalendarWeeks` from `date-fns` with `{ weekStartsOn: 1 }` to match the project's Monday-start ISO convention (same as `/wrap`). Returns 1-indexed week.
- Forward-compatible: no code currently writes `planMeta` at workout creation; only drag writes it when recomputing weekNumber. Helper skips the `planMeta` field when `planMetaUpdate` is undefined.

**Patterns to follow:**
- Mirror [completeWorkout](../../src/lib/firebase/firestore.ts) signature style (ownerUsername, id, ...data).
- Use `Timestamp.fromDate(newDate)` like [updateWorkout](../../src/lib/firebase/firestore.ts) does.

**Test scenarios:**
- Happy path: `rescheduleWorkout` with valid new date writes Firestore `date` + `updatedAt`; resulting doc loads with expected `date.toDate()`.
- Happy path: `rescheduleWorkout` with `planMetaUpdate = { weekNumber: 5 }` writes both fields atomically; other `planMeta` fields are preserved (not overwritten) via caller passing the merged object.
- Edge case: `computePlanWeekNumber` returns `1` when `newDate` is same ISO week as `planStartDate` (Monday-start).
- Edge case: `computePlanWeekNumber` returns `2` when `newDate` is one ISO week later.
- Edge case: `computePlanWeekNumber` across a year boundary (2025-12-29 → 2026-01-05 with Mon-start) returns expected count, not a reset to 1.
- Error path: `rescheduleWorkout` with a non-existent doc ID rejects with a clear error (Firebase surfaces this; caller rolls back).

**Verification:**
- `npx tsc --noEmit` is clean after the type extension.
- The two new test files pass locally.
- Manual: in dev, call `rescheduleWorkout` from a browser console on a known workout and confirm Firestore update.

---

- [ ] **Unit 2: Draggable pill + droppable cell primitives**

**Goal:** Provide reusable `DraggableWorkoutCard` and `DroppableDayCell` wrappers that the week and month views can drop in. Keep the existing `MiniPill`/`MicroPill` internals untouched so visuals don't regress.

**Requirements:** R2 (eligibility gating), R5 (pickup animation + source placeholder), R8 (Esc / off-grid cancel — dnd-kit default).

**Dependencies:** Unit 1 (types).

**Files:**
- Create: `src/components/calendar/DraggableWorkoutCard.tsx`
- Create: `src/components/calendar/DroppableDayCell.tsx`
- Test: `src/__tests__/DraggableWorkoutCard.test.tsx` (eligibility logic)

**Approach:**
- `DraggableWorkoutCard` takes `{ workout, children }` where children is the existing `MiniPill` / `MicroPill` output. Internally calls `useDraggable({ id: workout.id, data: { workout } })`. If `workout.completed || workout.source === 'strava' || workout.completedBy === 'strava'`, skip the draggable wiring and render children directly — no wrapper, no listeners. Matches R2.
- Attaches `listeners` to a wrapper div (not the child `<button>`), `setNodeRef` to the same wrapper. `style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }` for source-placeholder effect.
- `cursor-grab` on hover for eligible; `cursor-default` otherwise.
- `DroppableDayCell` takes `{ day, children }`, computes `dateKey = format(day, 'yyyy-MM-dd')`, calls `useDroppable({ id: dateKey })`. When `isOver`, adds `ring-2 ring-primary/60 bg-primary/10` via `cn()`. Passes `setNodeRef` to its wrapper div.

**Patterns to follow:**
- Match the cell styling idiom from [CalendarWeekView.tsx:105](../../src/components/calendar/CalendarWeekView.tsx) — `cn()` with conditional ring/bg classes.
- Keep eligibility gating centralized via a small pure helper `isDraggableWorkout(workout): boolean` co-located in `DraggableWorkoutCard.tsx`, exported for tests.

**Test scenarios:**
- Happy path: `isDraggableWorkout` returns `true` for a future, uncompleted, manual workout.
- Happy path: returns `true` for a past, uncompleted, manual workout (missed).
- Edge case: returns `false` when `workout.source === 'strava'`.
- Edge case: returns `false` when `workout.completed === true`.
- Edge case: returns `false` when `workout.completedBy === 'strava'` even if `completed = false` (defensive, matches existing card logic).

**Verification:**
- Component renders without errors in dev for both eligible and ineligible workouts.
- Eligible pills show `cursor-grab` on hover in dev; ineligible ones show default cursor.

---

- [ ] **Unit 3: `<CalendarDndContext>` wiring across week + full-month views**

**Goal:** Compose `DndContext` + `DragOverlay` + `PointerSensor` around the two existing views, gated to `md+`. Hoist `onDragEnd` to the page level (Unit 4).

**Requirements:** R1 (drag between cells in week + full-month views), R4 (any day valid), R5 (target cell highlight via `isOver` wiring from Unit 2).

**Dependencies:** Units 1, 2.

**Files:**
- Create: `src/components/calendar/CalendarDndContext.tsx`
- Modify: [src/components/calendar/CalendarWeekView.tsx](../../src/components/calendar/CalendarWeekView.tsx) (wrap each cell in `DroppableDayCell`; wrap each pill render in `DraggableWorkoutCard`)
- Modify: [src/components/calendar/CalendarFullMonthView.tsx](../../src/components/calendar/CalendarFullMonthView.tsx) (same pattern, `micro` variant)

**Approach:**
- `CalendarDndContext` takes `{ onDragStart, onDragEnd, isDesktop, children }`. Renders `<DndContext sensors={[pointerSensor]} collisionDetection={closestCenter} onDragStart={...} onDragEnd={onDragEnd}>` when `isDesktop`; renders `children` passthrough when not. Sensor: `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })`.
- `<DragOverlay>` renders a preview of the currently-dragging workout (pulled from `activeWorkout` state set in `onDragStart`). Uses the same `MiniPill` component for visual consistency. Portal-mounted (DragOverlay is portal by default).
- `CalendarWeekView` already detects `isDesktop` (line 42–49) — hoist that detection into a shared hook `useIsDesktop()` in `src/hooks/useIsDesktop.ts` (new) so both views + the page share one source of truth. Or pass `isDesktop` as a prop from the page.
- Replace the current `<CalendarWorkoutCard ... />` render site in both views with `<DraggableWorkoutCard workout={...}><CalendarWorkoutCard ... /></DraggableWorkoutCard>` — no changes to `CalendarWorkoutCard` internals.
- Wrap each day cell's outermost `<div>` in `<DroppableDayCell day={day}>` — the `onClick={() => onSelectDate(day)}` stays on the inner div; activation distance prevents drag from firing on click.

**Patterns to follow:**
- Mirror the existing `isDesktop` matchMedia pattern in [CalendarWeekView.tsx:42-49](../../src/components/calendar/CalendarWeekView.tsx) when extracting the hook.

**Test scenarios:**
- Happy path: mounting `CalendarDndContext` on desktop does not break existing click-to-select-date behavior (cells still fire `onSelectDate` on click below activation threshold).
- Edge case: when `isDesktop = false`, `CalendarDndContext` renders children pass-through — no sensors registered, no wrapper div overhead.
- Integration: `DraggableWorkoutCard` + `DroppableDayCell` compose inside `CalendarDndContext` and pill renders correctly in both week and full-month views.

**Verification:**
- Visual smoke test in dev at `md+` and `<md` viewports — layout unchanged.
- Cursor changes to `grab` over eligible pills on desktop only.
- Clicking a pill (no drag) still opens the detail panel / `onSelectWorkout` path.

---

- [ ] **Unit 4: Drag handler — optimistic update, Firestore write, undo toast, rollback, PostHog**

**Goal:** Land the page-level `onDragEnd` that closes the loop: identifies the drop target, builds the new date with timezone preservation, performs the optimistic + Firestore + rollback dance, emits toast with Undo, and fires PostHog. Recomputes `planMeta.weekNumber` when present.

**Requirements:** R3, R6, R7, R19, R20, R21.

**Dependencies:** Units 1–3.

**Files:**
- Modify: [src/app/(dashboard)/calendar/page.tsx](../../src/app/(dashboard)/calendar/page.tsx) (add `handleDragEnd`, `draggingIdRef`, wire `CalendarDndContext`)
- Test: `src/__tests__/calendarDragReschedule.test.tsx` (drag handler logic in isolation — optimistic update, rollback on error, planMeta recompute, time-of-day preservation)

**Approach:**
- `draggingIdRef = useRef<string | null>(null)` — set in `onDragStart`, cleared after `onDragEnd` settles. Late-arriving promises check `draggingIdRef.current === id` before applying cache invalidation.
- `handleDragEnd({ active, over })`:
  1. If `!over` or `over.id === active.data.current.workout.dateKey` → return silently (R8 off-grid / same-day).
  2. Resolve `workout = active.data.current.workout`, `newDateKey = over.id`. Rebuild `newDate` preserving time-of-day:
     - `originalDate = safeToDate(workout)`
     - Extract `{ hours, minutes, seconds }` via `formatInTimezone(originalDate, 'HH:mm:ss', userTimezone)`.
     - Build `newLocalISO = ${newDateKey}T${hours}:${minutes}:${seconds}`.
     - `newDate = parseLocalDate(newLocalISO, userTimezone)`.
  3. Compute `planMetaUpdate` if `workout.planMeta?.planStartDate`: `{ ...workout.planMeta, weekNumber: computePlanWeekNumber(newDate, workout.planMeta.planStartDate.toDate()) }`. Otherwise `undefined`.
  4. Capture `prevDate = workout.date` (Firestore Timestamp) and `prevPlanMeta = workout.planMeta` for rollback.
  5. Optimistic `setWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, date: Timestamp.fromDate(newDate), planMeta: planMetaUpdate ?? w.planMeta } : w))`.
  6. `toast.success("Moved to <date>", { description: planMetaUpdate ? "Part of your training plan, week <N>." : undefined, duration: 5000, action: { label: 'Undo', onClick: () => handleUndo(workout, prevDate, prevPlanMeta) } })`.
  7. `track('reschedule_drag_desktop', { workoutId: workout.id, oldDate: getDayKey(prevDate.toDate(), userTimezone), newDate: newDateKey, type: workout.type, hadPlanMeta: !!planMetaUpdate })`.
  8. `await rescheduleWorkout(workout.ownerUsername, workout.id, newDate, planMetaUpdate)`.
  9. `invalidateWorkouts(user!.username, user!.role)` in the background.
  10. On catch: `setWorkouts` revert to `prevDate` + `prevPlanMeta`; `toast.error("Couldn't move workout — try again.")`.
- `handleUndo(workout, prevDate, prevPlanMeta)` reverses via the same `rescheduleWorkout` path, without toasting on success (silent revert) but with an error toast on failure.

**Patterns to follow:**
- Exact shape of [handleToggleComplete](../../src/app/(dashboard)/calendar/page.tsx) (lines 166-186) — optimistic → write → invalidate → rollback on catch.
- Use [parseLocalDate](../../src/lib/dayKey.ts) for the date rebuild; never `date.setUTCDate`.

**Test scenarios:**
- Happy path: dropping a workout from Mon 2026-04-20 onto Wed 2026-04-22 calls `rescheduleWorkout` with a `newDate` whose local time matches the original's hours/minutes in the user's timezone (IST: 07:00 → 07:00, not 01:30 or 12:30).
- Happy path: toast shows "Moved to Apr 22" and an Undo action; Undo reverts local state and calls `rescheduleWorkout` with the original date.
- Happy path with planMeta: dropping a workout with `planMeta = { planId, weekNumber: 3, planStartDate: 2026-04-06 }` from within-week-3 to within-week-5 calls `rescheduleWorkout` with `planMetaUpdate.weekNumber === 5`; toast description says "Part of your training plan, week 5."
- Edge case: dropping onto the same date (`over.id === current dateKey`) is a no-op, no toast, no write.
- Edge case: drop over off-grid (`over === null`) is a no-op, no toast.
- Edge case: rapid successive drops of the same workout — second drop's `onDragStart` moves `draggingIdRef`; first drop's late `invalidateWorkouts` checks the ref and skips.
- Error path: `rescheduleWorkout` rejects → local state reverts to `prevDate`, error toast shown, PostHog event still counts (acceptable — drag *attempt* was made).
- Error path: Undo's `rescheduleWorkout` rejects → error toast shown, local state stays at the moved date (the user's recovery is to drag again).
- Integration: dropping a Strava-standalone workout is impossible (Unit 2 prevents drag wiring); verified by asserting `DraggableWorkoutCard` renders children without listeners for such a workout.
- Integration: cross-row drop on the tablet two-week layout (week view `md+`) — dropping from row 1 (week N) onto a day in row 2 (week N+1) updates `date` correctly; if `planMeta` present, `weekNumber` bumps accordingly.

**Verification:**
- Manual: walk the test plan from the issue (12 scenarios) in dev.
- `npm run build` succeeds.
- PostHog dashboard shows `reschedule_drag_desktop` events after a few test drags.

## System-Wide Impact

- **Interaction graph:** `CalendarDndContext` introduces pointer listeners on cells. Existing `onClick={() => onSelectDate(day)}` on cells and `onClick` on pills are preserved because 8 px activation distance suppresses drag for taps. `CalendarAddDropdown` (centered, absolute-positioned, `pointer-events-auto`) sits inside the cell; verify it isn't accidentally the nearest droppable target for small movements — `closestCenter` resolves on registered droppables only, and we register cells, not the dropdown.
- **Error propagation:** Firestore write errors bubble through `rescheduleWorkout` to `handleDragEnd` where they trigger rollback and error toast. `invalidateWorkouts` failures are swallowed (background refresh). Undo errors surface as a toast; no automatic retry.
- **State lifecycle risks:**
  - *Strava webhook race* (accepted) — webhook updates for a workout mid-drag could overwrite `date`. Narrow window; documented in release notes; revisit if observed.
  - *Stale cache on other pages* — `invalidateWorkouts` is called post-write; the dashboard and workouts pages pick up fresh data on next mount.
  - *Rapid drag interleaving* — the `draggingIdRef` guard prevents stale promise callbacks from mis-invalidating newer state.
- **API surface parity:** None. `rescheduleWorkout` is new and additive; `updateWorkout` is untouched; `completeWorkout` is untouched.
- **Integration coverage:** Two integration-flavored scenarios in Unit 4's test list cover cross-row tablet drops and the `DraggableWorkoutCard` + `CalendarWorkoutCard` composition.
- **Unchanged invariants:**
  - `CompactCard` in [CalendarWorkoutCard.tsx:225-349](../../src/components/calendar/CalendarWorkoutCard.tsx) (mobile list) stays a `<Link>`; no drag wiring, no changes. Mobile long-press flow lands separately.
  - `WorkoutDetailPanel` date-edit path remains the safety valve.
  - "Late" badges, completion prompt, Late-stigma copy — all untouched per scope boundary.
  - `CalendarDayWorkouts` and `CalendarYearView` — no drag wiring.
  - Firestore security rules for workouts — unchanged; `planMeta` writes fall under the existing owner-only update rule.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `@dnd-kit/core` React 19 / Next.js 16 integration surfaces (StrictMode double-invoke, server-component boundary) | All DnD components are `'use client'` — matches existing calendar components. v6.3+ has no known R19 issues. If any appear, fall back to `import dynamic from 'next/dynamic'` with `ssr: false` for the DnD context. |
| Time-of-day drift on drop (#86 pattern) | All date rebuilding goes through `parseLocalDate` + `formatInTimezone`. Explicit test scenario in Unit 4. |
| Tablet two-week cross-row drop flaky | `closestCenter` is row-agnostic; `<DragOverlay>` escapes `overflow-hidden`. Explicit manual test in the issue's test plan. |
| Strava webhook race creates duplicate | Accepted for v1; document in release notes; monitor in PostHog (`reschedule_drag_desktop` + any new Strava webhook dedup events). |
| Accidental drag on click (cell select, pill select) | 8 px activation distance; validated in Unit 3 test scenarios. |
| `planMeta` schema lands but no writer exists yet | Drag handler is the only writer, conditional on `planMeta` already being present. Future training-plans-persistence issue will add the creation-time writer. No-op until then. |
| Bundle size regression | ~12–14 kB gzipped for `@dnd-kit/core` + `utilities`, verified against [dndkit.com](https://docs.dndkit.com/). Trivial next to existing Firebase + Recharts footprint. |
| Plan-phase periodization mismatch on long drags | R20 explicitly accepts no cross-ISO-week guardrails for v1. `phase` is preserved untouched, only `weekNumber` recomputes. |

## Documentation / Operational Notes

- **Release notes:** Mention desktop drag-to-reschedule on week and full-month views; call out the accepted Strava-webhook race as a known-narrow edge case; link the issue.
- **CLAUDE.md update:** Add a one-liner under *Calendar* noting `md+` drag-to-reschedule and that `<md` viewports keep the existing click/open/edit/save flow.
- **PostHog:** Confirm `reschedule_drag_desktop` event appears in Live Events; no dashboard changes required.
- **Rollout:** No feature flag — low-risk additive change behind viewport gate. If regressions appear, revert is a single PR revert (no schema migration needed; `planMeta` field is optional and reads are backward-compatible).

## Sources & References

- **Origin issue:** [#104 desktop drag-and-drop rescheduling](https://github.com/ryanssareen/workout-site/issues/104)
- **Parent issue:** [#103 calendar DnD + Late stigma](https://github.com/ryanssareen/workout-site/issues/103)
- **Related learning:** [src/lib/dayKey.ts](../../src/lib/dayKey.ts) (`parseLocalDate` — #86 timezone fix)
- **Pattern precedent:** [src/app/(dashboard)/calendar/page.tsx:166-186](../../src/app/(dashboard)/calendar/page.tsx) (`handleToggleComplete` optimistic pattern)
- **External docs:** [@dnd-kit/core API](https://docs.dndkit.com/), [useDraggable](https://docs.dndkit.com/api-documentation/draggable/usedraggable), [useDroppable](https://docs.dndkit.com/api-documentation/droppable/usedroppable), [DragOverlay](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)

## Verification (End-to-End)

1. `npm install` after Unit 1 lands to pull `@dnd-kit/core` and `@dnd-kit/utilities`.
2. `npx tsc --noEmit` clean.
3. `npm run dev`; sign in; navigate to `/calendar`; confirm week view shows two-week layout on desktop.
4. Hover a future workout pill — `grab` cursor appears. Hover a Strava-synced pill — no `grab` cursor.
5. Drag a planned workout from Mon to Wed — pill animates, target cell highlights, toast appears with "Undo". Firestore doc's `date` updates; time-of-day preserved (verify in Firebase console: `date.toDate()` hours/minutes match the original).
6. Click Undo within 5 s — workout returns to original day; second Firestore write visible.
7. Switch to full-month view; drag a missed workout onto today — toast appears; `completedLate` remains `false` (drag doesn't mark complete).
8. Drag cross-row on the tablet two-week layout (resize viewport to ~800 px width) — drop succeeds; no visual flicker.
9. Drop outside the grid — no toast; no write.
10. Press Esc mid-drag — no toast; no write.
11. Seed a workout with `planMeta = { planId: 'p1', weekNumber: 3, planStartDate: <Monday 2 weeks ago> }` via Firebase console. Drag it forward two weeks — toast description reads *"Part of your training plan, week 5."* Firestore `planMeta.weekNumber` = 5; `phase` untouched.
12. Run Unit 1 + Unit 2 + Unit 4 test files: `npm run test -- reschedule weekNumber Draggable calendarDrag`. All pass.
13. `npm run build` succeeds.
14. PostHog Live Events shows `reschedule_drag_desktop` with expected properties.

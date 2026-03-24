---
date: 2026-03-24
topic: custom-coach-workflow
---

# Custom Coach Workflow

## Problem Frame
The Daily Athlete currently has coach-related type definitions and some data layer functions (`getCoachStudents`, `getCoachDashboardStats`, `getUserWorkouts` with role param) but no complete coach workflow. Coaches need to manage athlete workouts, get notified on completions, filter views by athlete, and email athletes when assigning workouts. Coach-athlete linking is admin-controlled (no self-service).

## Requirements

- R1. **Admin-only coach-athlete linking via API** — A protected API endpoint accepts a coach email and list of athlete emails to establish the relationship. No GUI. Sets the athlete's `coachUsername` and the user's `role` to `'coach'`. Must be idempotent (re-linking same pair is a no-op). Only callable by admin (existing admin auth).
- R2. **Coach CRUD on athlete workouts** — Coaches can create, read, update, and delete workouts for any of their linked athletes. Created workouts are marked with `assignedBy: coachUsername` so athletes see them as "Assigned by [Coach Name]". Athletes can still edit assigned workouts (add notes, log actual results, mark complete).
- R3. **Athlete filter on Reports, Calendar, Workouts pages** — When a coach is logged in, these pages show an athlete selector dropdown. Options: individual athletes + "All Athletes" (combined view). Default view is "All Athletes". Filter persists across page navigation within a session.
- R4. **Push notification on workout completion** — When an athlete completes a planned workout that was assigned by their coach, the coach receives a Web Push notification (using existing push infrastructure). Message includes athlete name, workout type, and completion summary.
- R5. **Email on workout assignment** — When a coach assigns one or more workouts to an athlete, the athlete receives an email summarizing the assigned workouts (date, type, description). Uses existing Nodemailer/Brevo infrastructure. Sent immediately on assignment, not batched.
- R6. **Coach-only role** — Coaches manage athletes but do not log their own workouts. The coach's dashboard, workouts page, calendar, and reports all show athlete data, not personal training data.

## Success Criteria
- A coach can log in and see all their linked athletes' workouts across Workouts, Calendar, and Reports pages
- A coach can create a workout for a specific athlete and the athlete sees it marked as assigned
- When an athlete completes an assigned workout, the coach gets a push notification
- Athletes receive an email when workouts are assigned to them
- Coach-athlete relationships are only created via the admin API endpoint

## Scope Boundaries
- No self-service coach signup or athlete-initiated coach linking
- No in-app notification feed or badge system (push only)
- No coach-to-coach communication
- No billing or subscription tier for coaches
- No coach-specific onboarding flow
- The existing `coachCode` field is not used in this iteration (admin API uses emails directly)

## Key Decisions
- **Admin-controlled linking**: Coach access is gated by the project owner via API, not self-service. This avoids building invite/accept UI and keeps the feature controlled during early rollout.
- **Marked + editable workouts**: Assigned workouts show a coach attribution badge but remain fully editable by the athlete. This respects athlete autonomy while giving visibility into what was prescribed vs. self-directed.
- **Push-only notifications**: Leverages existing Web Push infrastructure. No email digest or in-app feed needed for coach notifications.
- **Coach-only role (no personal workouts)**: Simplifies the UX — coach views are purely about their athletes. A coach who also trains would need a separate athlete account.
- **"All Athletes" default**: Coach sees combined view by default with ability to drill into individual athletes.

## Dependencies / Assumptions
- Existing push notification infrastructure works for coach users (subscriptions stored on user doc)
- Existing email infrastructure (Nodemailer/Brevo) can handle transactional assignment emails
- Firestore 50k reads/day budget can support coach queries across multiple athletes (coach with 10 athletes viewing "All Athletes" = ~10x normal read cost for that page load)

## Outstanding Questions

### Resolve Before Planning
_(none — all product decisions resolved)_

### Deferred to Planning
- [Affects R1][Technical] How should the admin API endpoint handle edge cases: athlete email not registered, coach email not registered, athlete already has a different coach?
- [Affects R2][Needs research] What Firestore queries are needed for coach workout CRUD? Can the existing `getUserWorkouts` role-aware query handle all cases, or does it need extension?
- [Affects R3][Technical] Best approach for persisting the athlete filter selection across pages — URL params, Zustand store, or sessionStorage?
- [Affects R3][Needs research] What's the Firestore read cost impact of "All Athletes" view on Reports page with charts? May need query optimization or caching.
- [Affects R4][Technical] Should the push notification fire from client-side after `completeWorkout()` or from a Firestore trigger / API route?
- [Affects R6][Needs research] Which dashboard components need to be hidden/swapped for coach-only users (e.g., personal stats, Strava connect, AI suggestions)?

## Next Steps
-> `/ce:plan` for structured implementation planning

---
date: 2026-04-17
topic: ai-training-plan-creator
---

# AI-Assisted Training Plan Creator

## Problem Frame
The Daily Athlete has multi-week periodization building blocks in `src/lib/training/` (phase rules in `constraints.ts`, fatigue/deload detection in `logicEngine.ts`, sport rotation in `planEngine.ts`) and a 3-tier AI pipeline at `/api/ai/workout-suggestions` — but all of it is used to generate one-off workouts. There is no persistent plan entity, no calendar-level notion of "this workout is part of a 12-week arc," no feedback that connects daily completions back to a goal, and no mechanism that adapts the plan from what actually happened. Users training for a specific race or distance PR have to reconstruct their arc in their heads week-to-week.

This brainstorm scopes a first-party **training plan** primitive: a durable, goal-anchored container of workouts that lands in the calendar, gives lightweight daily feedback and deeper weekly feedback, and adapts weekly (and on demand) with the user's explicit approval. The plan is the adaptive-loop differentiator vs static PDF plans (Strava Training Plans) and vs one-off AI suggestions.

## Requirements

### Plan Creation
- **R1. Goal-anchored plan wizard** — A guided wizard creates a plan from a goal. Two goal types in v1: (a) **dated event** (e.g. "marathon, 2026-11-15"), (b) **distance PR** (e.g. "sub-45 10K, no date"). Steps: Goal type → Event details (date if applicable, distance, target time, sport) → Availability (days/week, typical session length, preferred days) → Preview of week 1 and phase breakdown → Confirm.
- **R2. Chat refinement after preview** — On the wizard's preview step, a chat input lets the user adjust with natural language ("make Tuesdays shorter", "no swimming the first two weeks", "add a long ride on Sunday"). Chat updates the preview in place. Chat only runs at creation time; weekly review (R9) uses a propose-and-accept card, not a chat surface. Chat is not a persistent always-on assistant.
- **R3. Multi-sport plans** — Run, Bike, Swim are supported. A single plan may combine sports (enabling triathlon) or be single-sport. Sport distribution is determined by the engine based on goal and availability, not surfaced as a wizard slider (keeps the "not overwhelming" bar). Strength is out of scope for v1.
- **R4. Plan length derives from goal** — For dated goals, length = (today → event date) bounded to a sensible minimum (e.g. won't generate a <4-week marathon plan). For undated distance-PR goals, a default length is proposed per distance (e.g. 10-week 10K) with user override.

### Plan Persistence, Calendar, and Surface
- **R5. Plan is a first-class entity** — A user has at most one **active** plan at a time (UI-enforced), but the underlying schema permits multiple plans with a status field so future expansion to concurrent plans is a UI change, not a schema migration. The plan has a goal, start date, end date, phase map (base / build / peak / taper), sport(s), and a list of planned workouts. Each plan workout stores explicit **targets** (`targetDuration`, `targetDistance`, `targetPace` range, and — when applicable — `targetHRZone`) so R8's ribbon and R9's adherence math have concrete values to compare against. Workouts created by the plan are flagged as belonging to it so the calendar, workout list, and reports can render plan context (e.g. "week 4 of 12 · build phase"). Plan docs carry a lifecycle state: `draft | active | completed | abandoned | failed-creation`.
- **R6. Calendar integration** — Plan workouts appear on their scheduled date in all existing calendar views (day/week/month/year). They are visually distinguishable from ad-hoc workouts via a plan badge/marker (specific visual treatment TBD in planning, but must layer *on top of* — not replace — the existing 6-state completion color system). Tapping a plan workout shows the plan context (phase, week number, why this session exists).
- **R7. Plan view at `/plan`** — A new top-level nav entry. The plan view is the home base for the plan: current week, next workout, phase progress bar, adherence %, access to R10 (Re-assess), R14 (Edit goal / Abandon), and the rebuild prompt (R11b) when triggered. On the dashboard, a "Current Plan" card shows week-of-N + next workout and links into `/plan`. The plan view is the entry point referenced by every requirement that says "from the plan view."
- **R8. Suppress AI Suggestions panel when plan is active** — While a plan is active, the `AIWorkoutSuggestions` panel on `/workouts` is hidden. Users without an active plan continue to see the current one-off suggestion flow. *(The original R7 "ad-hoc into plan" reframe — routing one-off suggestions through plan insertion — is **deferred to v1.1**. In v1, ad-hoc add is manual workout creation; the AI-suggested-into-plan flow is not built.)*

### Daily Feedback
- **R9. Minimal per-workout feedback ribbon** — Immediately after completing a workout that belongs to the plan, the workout detail view shows a single-line status ribbon. Rules are deterministic (no LLM call per completion). Three states: "✓ On target" / "Slightly off" / "Missed." Tapping the ribbon opens a side panel with planned-vs-actual details. **Signal fallback:** when a session lacks pace/distance/HR (pool swim, indoor bike without power, treadmill), the ribbon degrades to a **duration-only** comparison ("45min planned, 47min done"). This gives honest feedback for ~40% of real sessions that lack GPS/power signal.

### Weekly Adaptation
- **R10. Weekly plan section on `/wrap`** — The existing Weekly Wrap page (Mon-Sun) gains a "Plan" slide/section with: week summary (completed vs planned), adherence %, phase progress, and an **AI-generated narrative recap** (cost/latency acceptable once/week). If Groq is rate-limited or fails, the narrative degrades gracefully to a rules-based summary; the page does not break.
- **R11. Proposed-changes card with accept/reject** — Each Sunday (or on first visit after the new week has begun), if the plan would benefit from adjustment, the `/wrap` page shows a **proposed change set** for the upcoming week (e.g. "Move your long run from Sat to Sun, reduce Tuesday intervals by 10%"). Changes are accepted or rejected as a set (all-or-nothing in v1). Rejecting leaves the plan as-is and suppresses the card until next Sunday.
- **R12. User-triggered re-assessment** — A "Re-assess my plan" action on the plan view (R7) and on `/wrap` re-runs adaptation on demand. Same propose → accept/reject flow as R11.
- **R13. Adaptation preserves long-term arc** — Adaptation may shuffle days within a week, tune target paces/distances/durations by bounded deltas, and swap a workout's focus. It may NOT silently reshape phase boundaries, change the event date, or re-scope the goal.
- **R14. Plan-health detection and rebuild prompt** — When adaptation detects **catastrophic drift** (heuristic: >50% of planned workouts missed across 2+ consecutive weeks, or a user-absence gap of 14+ days), R13's bounded adaptation is no longer safe (e.g. jumping into build phase after detraining is an injury vector). Instead, the plan view (R7) and `/wrap` surface a **"Rebuild from today"** action. Clicking it regenerates the remaining plan from the user's current fitness state (with a fresh phase arc anchored to today, not the original start date). No silent reshaping — user must explicitly choose to rebuild. Rebuilding preserves the original goal and end date if feasible; if the goal is no longer feasible (e.g. marathon in 2 weeks after 3 weeks off), the rebuild flow offers to adjust the goal or abandon.
- **R15. Ad-hoc workouts count with load guardrails** — Unplanned workouts (manual entry or Strava sync) factor into next-week adaptation as bonus volume, but only within safe thresholds. Adaptation surfaces a **warning card** when it detects large or badly-timed ad-hoc volume (e.g. a 50km ultra during taper week, or >30min extra in a recovery week). The warning is shown alongside — not inside — the proposed-changes card, so the user can see "this workout may compromise your race" as distinct advice from "here are next week's proposed tweaks." Ad-hoc workouts on days that *already have* a planned session follow the existing Strava merge logic (same day + same type + distance within 10% → merge as completion; otherwise kept as a separate ad-hoc workout on that day).

### Plan Lifecycle
- **R16. Edit and abandon** — From the plan view (R7), the user can edit the goal (date, target time) or abandon the plan. Editing the goal triggers re-generation of the remaining plan (user approves the new arc). Abandoning archives the plan and **soft-deletes** future planned-workout entries from the calendar (marks `abandonedByPlan: true` so they stop rendering but remain recoverable — safer than hard-delete given Firestore's 490-per-batch limits).

### Positioning
- **R17. Update landing page + onboarding to lead with the plan** — The landing page hero, the primary onboarding CTA, and feature marketing update to position The Daily Athlete as "train for your race, with an adaptive AI plan." The existing consistency-focused features (streaks, heatmaps, milestones) remain as secondary value props, but the plan becomes the headline. This ships alongside the feature — not as a separate marketing initiative — so adoption isn't buried.

### Rollout
- **R18. Invite-only beta gate (v1)** — Plan creation is gated by a `planBetaEnabled` flag on the user doc, toggleable from the admin dashboard. Max 20 active plan users in v1 (admin-enforced, not hard-coded). Users without the flag see a "Training plans are in private beta — join the waitlist" CTA. The beta cap lets the feature ship on the free Groq tier and serves as a real-world validation of token draw before scaling. Once the token budget is validated (by observing actual per-user monthly token consumption), the cap is removed via admin setting — no code change needed.

### Token Efficiency
- **R19. Compact workout summary layer** — Every workout (planned or ad-hoc, plan or not) gets a deterministic **compact summary** generated on completion or on Strava sync: ~50-100 tokens of structured text capturing type, date, planned-vs-actual (if plan workout), key metrics (distance, pace/speed, HR avg/max, duration, elevation, RPE/emoji rating), adherence flag, and phase/focus tag. Summaries are stored on the workout doc (`summary` field) and kept in sync with the workout. **LLM calls never send raw workout documents.** Instead they receive collections of summaries:
  - **R10 weekly recap** reads ~7 summaries (one week). Input ≈ 500-700 tokens instead of ~5,000.
  - **R11 proposed-changes** reads the last 2-4 weeks of summaries for context (~14-28 summaries, ~1-2K tokens) plus the next 7 planned-workout skeletons.
  - **R14 rebuild** reads the last 4-6 weeks of summaries to understand current fitness.
  - **R2 chat refinement** reads the wizard preview (planned-workout skeletons, already compact) and the user's recent 2-week summary to ground its answers.
  
  This cuts input token draw per LLM call by roughly an order of magnitude vs sending raw docs, and lets the beta cap (R18) be lifted sooner because per-user monthly draw will be much lower than the original back-of-envelope estimate. The daily ribbon (R9) and the summary generation share the same rules engine — the summary is the persisted form of the ribbon's computation.

## Success Criteria
- A user can go from "I have a marathon on Nov 15" to a populated calendar and an accepted 12-week plan in under 3 minutes through the wizard.
- After completing a planned workout, the user sees the minimal ribbon within 1 second and no LLM latency.
- Each Sunday (or on next new-week visit), the user gets a weekly narrative recap on `/wrap` and can accept or reject the proposed next-week changes in one tap.
- A missed workout in the middle of the week does not break the plan — it is visibly acknowledged and reflected in that week's proposed change set.
- A user who returns after 3+ weeks away is not silently shoved into a phase that no longer matches their fitness; they see the "Rebuild from today" prompt.
- A user who logs a badly-timed ad-hoc workout (e.g. ultra during taper) sees a warning, not a silent "bonus volume" adjustment.
- Users without a plan still get the current one-off AI suggestion flow; there is no regression for them.
- The `AIWorkoutSuggestions` panel is suppressed when a plan is active (verifiable by checking `/workouts` page state).
- The landing page and onboarding reflect "train for your race" as the headline value prop.

## Scope Boundaries
- **No strength training plans** in v1. Strength workouts can still exist ad-hoc in the calendar, but the plan itself won't generate or adapt them.
- **No concurrent active plans** in v1 (UI-enforced). Schema permits multiple plans with status fields so future expansion is a UI change, not a migration.
- **No team or group plans**. Plan is personal.
- **No silent auto-adaptation**. Every change requires user approval, including the rebuild prompt.
- **No conversational daily coach**. Chat only at plan creation (R2). No persistent AI chat surface.
- **No HR-zone-based adaptation in v1**. HR data is displayed in feedback but not used as an adaptation input — future enhancement.
- **No plan-end handoff flow in v1** (formerly R13). When a plan is completed, it is archived automatically by a cron tick; the user is not prompted to create a follow-up plan. They can create one manually. *Deferred to v1.1.*
- **No "ad-hoc AI suggestion routed into plan" flow in v1** (formerly R7 reframe). Users without a plan see the existing AI Suggestions panel; users with a plan see nothing (R8). Adding AI-suggested-into-plan is deferred to v1.1.
- **No open signup for plans in v1** (R18). Plan creation is invite-only, capped at 20 active users, to keep token draw bounded on the free Groq tier. Cap is removed once real-world token consumption is validated.

### Coach interaction
- If a user has a coach (`coachUsername` set, per the 2026-03-24 coach workflow brainstorm), plan creation **is still permitted**. Coach-assigned workouts and plan workouts coexist. On any day where both exist, the coach-assigned workout takes priority in the calendar view (plan workout is suppressed for that day only). The weekly review respects this: the coach-assigned workout is the "scheduled" workout for that day; the plan workout is suppressed from adherence math. This preserves athlete agency without creating dual-authority on the same day.
- If a user is linked to a coach *after* already creating a plan, the plan stays active. The coach can begin overriding days as described above.
- Rationale: the alternative ("disable self-plan for coached users") biases against athlete agency and creates a worst-of-both-worlds scenario where getting a coach removes a capability. Coexistence with same-day override is the correct default.

## Key Decisions
- **Goal-oriented persona, positioning shift follows** — The plan is for users training for something. Because the existing product is positioned broadly ("workout tracking for athletes"), the landing page and onboarding update (R17) to lead with the plan so the right persona finds the feature. Consistency-oriented users keep their gamification and their AI Suggestions panel (when no plan active).
- **Week is the adaptation unit** — Matches existing `/wrap` (Mon-Sun), bounds AI cost, gives users predictability. Within-week shuffles are allowed in the next-week proposal; same-day mid-week changes are explicitly not a feature (users can edit individual workouts manually if they want that).
- **Structure locked, targets flexible — except under catastrophic drift** — Adaptation tunes days/pace/distance/duration within bounds (R13). When drift is too large (R14), the lock breaks and the user is offered a rebuild — not silently, not automatically.
- **User always approves changes** — Both the weekly proposal (R11) and the rebuild prompt (R14). No silent reshaping anywhere.
- **Daily feedback is rules-based with duration fallback** — Reserves LLM cost for the weekly narrative. Duration-only fallback means feedback works for no-signal sessions (pool swim, indoor).
- **LLM reads summaries, not raw workouts** (R19) — A deterministic summary layer sits between the workout docs and every LLM call. Cuts input tokens by ~10x and makes the beta cap more a cautious hedge than a hard necessity. Daily ribbon and summary generation share one rules engine.
- **Weekly deep feedback rides on existing `/wrap`** — Reuses an existing surface. The `/wrap` page is currently a 4-slide carousel; the plan section is added as an additional slide that only renders when a plan is active.
- **Schema future-proofs multi-plan** — Single-active-plan is a UI constraint in v1, not a schema one. Expanding later is a UI change, not a migration.
- **Plan view is a top-level nav entry** — `/plan` becomes the home base. The dashboard gets a linked "Current Plan" card. This matches how adaptive plans become the primary surface once a user commits.
- **Coach coexistence with same-day override** — Plan is not disabled for coached users; coach workouts override on days they conflict. This preserves athlete agency and avoids the "getting a coach removes features" anti-pattern.

## Dependencies / Assumptions
- The `src/lib/training/` pipeline has the building blocks (phase rules, fatigue detection, sport rotation) but does **not** currently produce multi-week plans: `planEngine.mapDaysToDate()` scopes dates to the next 7 days only, and `logicEngine.generateLogicOutput()` hardcodes `count = 3`. A multi-week loop with periodized volume progression and phase transitions is **net-new work**. Persistence is net-new. The existing functions are inputs to the new multi-week generator, not the generator itself.
- Mon-Sun week boundaries hold across `/wrap`, analytics, etc. (verified).
- The existing `parseLocalDate` helper (CLAUDE.md #86) must be used for plan-week attribution so Strava-synced workouts land in the correct week regardless of timezone.
- The existing Strava-to-planned merge logic (CLAUDE.md "Planned workout merge fix") is reused by R15 for same-day ad-hoc merging.
- The existing `events[]` array on user docs (used for dashboard countdowns) must either be written-through from plan creation or deprecated in favor of reading the goal from the plan doc. Planning decides which.
- Plan-end transitions (plan reaches end date → status flips to `completed`) require a cron tick or an on-read lazy update, since users may not open the app near the boundary.
- Assumes the coach feature ships such that `coachUsername` detection is reliable. The field already exists on user docs.

## Outstanding Questions

### Resolve Before Planning
- None remaining. Groq token budget is bounded via the invite-only beta cap (see Scope Boundaries and R18).

### Deferred to Planning
- **[Affects R5][Technical]** Plan data model concretely: likely `trainingPlans` top-level collection with `status: 'draft' | 'active' | 'completed' | 'abandoned' | 'failed-creation'`, `planId` field on workout docs. Planning must confirm and design the "is there an active plan?" query cheaply (denormalize `activePlanId` on user doc to avoid per-page reads).
- **[Affects R4][Needs research]** Default plan lengths per goal type (5K PR / 10K PR / half / marathon / sprint tri / olympic tri). Reference Runna, Garmin Coach, and training literature.
- **[Affects R9][Technical]** Exact rules for ribbon thresholds — what pace/duration deltas map to "on target" vs "slightly off" vs "missed," per sport. Must be tunable.
- **[Affects R11][Technical]** Is the proposed-changes set computed via rules, LLM, or hybrid (rules propose, LLM narrates)? Cost question feeds into the go/no-go above.
- **[Affects R13][Technical]** Exact bounds for "bounded deltas" on adaptation: max day-shuffle within a week, max pace adjustment %, max duration swap per workout. Put values in the validator.
- **[Affects R14][Technical]** Exact catastrophic-drift heuristic. Starting point: >50% missed across 2+ consecutive weeks, or a 14+ day gap with no logged activity. Tune with early data.
- **[Affects R15][Technical]** "Badly-timed ad-hoc" detection heuristic — phase-aware thresholds (e.g. taper-week tolerance is near-zero, base-week tolerance is generous).
- **[Affects R7 / dashboard][Design]** Specific visual treatment for plan-workout differentiation on calendar, workouts list, and workout detail, layered on top of the existing 6-state completion color system. Design + prototype in planning.
- **[Affects R6][Technical]** Migration for users with existing AI-suggested workouts when they create a plan: stay as ad-hoc (simplest), or plan "adopts" overlapping ones. Default to stay-as-ad-hoc with a conflict warning in the wizard preview.
- **[Affects R17][Design]** Landing page and onboarding copy/visuals for the positioning shift. Partner with existing landing page design.

## Next Steps
`-> /ce:plan` for structured implementation planning. Token budget is bounded by the invite-only beta (R18); actual draw will be observed during beta and the cap lifted once validated.

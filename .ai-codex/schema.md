# Schema Reference (updated 2026-04-17, training-plan phase 1-3)

## Firestore Collections

### users
uid, email, displayName, username (unique), photoURL, bio, ageRange, experienceLevel,
height, weight, sportPreferences, trainingFor, events (goal + eventName + eventDate),
profileTagline, profilePublic (bool), pushSubscriptions (Web Push array),
theme ('light'|'dark'|'system'), role ('coach'|'athlete'|'student'),
coachUsername (for linked athletes), workoutCount (denormalized),
stravaAccessToken, stravaRefreshToken, stravaTokenExpiry, stravaAthleteId,
timezone, createdAt, updatedAt,
## Training plan additions (server-managed; denied for client writes via firestore.rules):
planBetaEnabled (bool; admin-toggled; 20-user cap enforced at API layer),
activePlanId (denormalized pointer to trainingPlans/{planId}; txn-guarded),
lastFailedPlanId ({ id, at, goalInputs } — surfaces retry CTA on /plan after failed-creation)

### userMappings
uid → username mapping (for auth lookups)

### workouts
id, createdBy (username), type ('swim'|'run'|'bike'|'walk'|'strength'|'other'),
name, description, date (Timestamp), duration (seconds), completed (bool),
plannedDate, tags (string[]), source ('manual'|'strava'|'import'),
stravaActivityId, mergeMeta, rating, emoji,
isRecurring (bool), recurringFrequency, recurringEndDate,
photoURL, whiteboardURL, routePolyline, mapImageURL,
run: { distance, pace, elevationGain, heartRate, cadence, splits[] }
bike: { distance, speed, elevationGain, heartRate, power, cadence }
swim: { distance, poolLength, strokeType, pace }
walk: { distance, pace, elevationGain, heartRate }
strength: { exercises[{ name, sets, reps, weight }] }
comments (subcollection)
## Training plan additions (all workouts get these by default, not just plan workouts):
planStatus ('active' | 'draft'; defaults to 'active' on create — drafts come from plan creation stage 1),
summaryVersion (monotonic int, bumped on every write),
summary ({ generatedAt, forVersion, sport, date, phaseTag?, adherenceState, distance?, duration?, pace?, hrAvg?, hrMax?, elevation?, rpe?, hasGps, hasHr, hasPower } — compact LLM-friendly summary)
## Plan-workout-only fields (set when planId is present):
planId (ref to trainingPlans/{id}),
planMeta ({ weekNumber, phase, focus, targetDuration, targetDistance?, targetPaceRange?, targetHRZone?, isKeyWorkout }),
abandonedByPlan (bool; set by abandon endpoint to hide future plan workouts)

### trainingPlans (top-level; training-plan feature)
id, userId (= username, NOT Firebase uid), goal (GoalInputs snapshot),
startDate (yyyy-MM-dd), endDate (yyyy-MM-dd),
phaseMap (array of { phase, startDate, endDate, weekNumbers[] }),
sports (array of 'run'|'bike'|'swim'), templateId,
status ('draft' | 'active' | 'completed' | 'abandoned' | 'failed-creation'),
version (monotonic int bumped on mutation — used as part of weekly recap cache key),
timezoneAtCreation (IANA), createdAt, updatedAt, completedAt?, abandonedAt?, failureReason?
## Security: client reads gated to owner (via userMappings lookup); all writes server-only

### users/{username}/planRecaps (subcollection; training-plan feature, Unit 13)
Cache key: { planId, weekStart, planVersion }. TTL 24h. Regenerated on plan mutation.
Written server-side only by /api/plans/[id]/weekly-recap (Unit 13 — not yet shipped)

### personalRecords
userId, type, metric, value, workoutId, achievedAt, history[]

### chatThreads
userId, messages[], createdAt, updatedAt

### backups
type ('daily'|'weekly'|'monthly'|'manual'|'pre-restore'),
createdAt, userCount, workoutCount, storagePath, integrityPassed, triggeredBy

### adminLogs
action, adminUid, timestamp, targetUid?, backupId?, type?, details?
Actions: backup_triggered, restore_triggered, user_deleted, user_hard_deleted,
user_disabled, user_restored, user_restore_triggered, strava_sync_forced,
cron_backup, cron_backup_failed, backfill_workout_counts,
plan_beta_toggled (training-plan feature — records targetUid + enabled + capCountAtToggle)

### system
doc 'lastCron': tracks backup_daily/weekly/monthly timestamps for health monitoring

---

## Zod Schemas (src/lib/schemas/)

### profile.ts
- `SPORT_OPTIONS` — ['Running', 'Cycling', 'Swimming', 'Strength Training', 'Triathlon']
- `TRAINING_FOR_OPTIONS` — 14 event types
- `AGE_RANGE_OPTIONS` — age range buckets
- `EXPERIENCE_LEVEL_OPTIONS` — beginner/intermediate/advanced/elite
- `profileSchema` — validates profile form (displayName, bio, ageRange, experienceLevel, height, weight, sportPreferences, trainingFor, events, profileTagline, profilePublic, timezone)
- `type ProfileFormData` — inferred from profileSchema

### workout.ts
- `RECURRING_FREQUENCIES` — ['daily', 'weekly', 'biweekly', 'monthly']
- `type RecurringFrequency` — union of above
- `workoutSchema` — validates workout form (type, name, description, date, duration, completed, tags, isRecurring, recurringFrequency, recurringEndDate, type-specific sub-objects)
- `type WorkoutSchema` — inferred from workoutSchema

# Schema Reference (updated 2026-04-17)

## Firestore Collections

### users
uid, email, displayName, username (unique), photoURL, bio, ageRange, experienceLevel,
height, weight, sportPreferences, trainingFor, events (goal + eventName + eventDate),
profileTagline, profilePublic (bool), pushSubscriptions (Web Push array),
theme ('light'|'dark'|'system'), role ('coach'|'athlete'|'student'),
coachUsername (for linked athletes), workoutCount (denormalized),
stravaAccessToken, stravaRefreshToken, stravaTokenExpiry, stravaAthleteId,
timezone, createdAt, updatedAt

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
cron_backup, cron_backup_failed, backfill_workout_counts

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

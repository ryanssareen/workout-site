# API Routes (updated 2026-04-17, training-plan phase 1-3)
# All routes under src/app/api/. Methods listed where non-obvious.

## Auth
POST   /api/auth/create-user              Server-side user creation via Admin SDK (bypasses Firestore rules)
GET    /api/auth/check-username           Check username availability
GET    /api/auth/strava/authorize         Begin Strava OAuth flow
GET    /api/auth/strava/callback          Strava OAuth callback
POST   /api/auth/strava/disconnect        Disconnect Strava account
POST   /api/reset-password               Reset password
POST   /api/send-reset-email             Send password reset email

## Workouts
GET/POST   /api/workouts                 List / create workouts
GET/PUT/DELETE  /api/workouts/[id]       Get / update / delete workout
POST   /api/workouts/import              CSV/XLSX import (AI-powered, programmatic date detection)
POST   /api/workouts/merge               Merge Strava activity with planned workout
POST   /api/workouts/auto-dedup          Auto-deduplication pipeline
POST   /api/workouts/fix-timezone        One-time migration: fix start_date_local misinterpretation
POST   /api/send-workout-email           Email a workout summary

## Import Pipeline
POST   /api/import/analyze               Analyze uploaded file columns
POST   /api/import/confirm               Confirm and execute import
POST   /api/import/format-description    Clean up imported workout descriptions
POST   /api/import/remap                 Remap column assignments

## AI
POST   /api/ai/workout-suggestions       3-tier AI workout plan (LogicEngine → Groq 70B → Validator)
POST   /api/ai/workout-recommendation    Single workout recommendation
POST   /api/ai/suggestions               Generic suggestions endpoint
POST   /api/ai/chat                      AI coach chat (chatThreads)
POST   /api/ai/reports/generate          Generate report via Groq (template-based)
GET    /api/ai/reports                   List cached reports
POST   /api/ai/format-workouts           Format/clean workout data via Groq
POST   /api/ai/profanity-check           Check display names for profanity
POST   /api/ai/profile-tagline           Generate profile tagline via AI
POST   /api/ai/route-comment             AI-generated route/workout comment
POST   /api/ai/backfill-comments         Backfill AI comments on existing workouts
GET    /api/ai/test                      AI connectivity test

## Reports
POST   /api/reports/send                 Send report via email
POST   /api/reports/email                Email report to user

## Templates (workouts)
GET/POST   /api/templates                List / create workout templates
GET        /api/templates/[id]           Get workout template

## Training Plans (beta-gated — athlete role only; enforced via verifyPlanAccess)
POST   /api/plans/create                 Create a new plan (draft-first atomicity; chunked Groq per phase; writes plan + N workouts)
GET    /api/plans/[id]                   Plan detail (owner only)
PATCH  /api/plans/[id]                   Edit goal (501 placeholder; U15 territory)
POST   /api/plans/[id]/abandon           Abandon plan (txn clears activePlanId; soft-deletes future plan workouts via abandonedByPlan flag)
POST   /api/plans/refine-chat            Wizard chat (5-turn cap; regex-gated against goal rescope requests; 70B → 8B fallback)

## Strava
GET    /api/strava/sync                  Sync Strava activities for current user
POST   /api/strava/sync-all              Admin: sync all users (auth-guarded)
GET    /api/strava/activity-details      Fetch full details for a Strava activity
GET    /api/strava/cleanup               Quota-safe cleanup of orphaned Strava docs
GET    /api/strava/webhook-status        Check Strava webhook subscription status
POST   /api/strava/webhook-subscription  Create/update Strava webhook subscription
POST   /api/strava/test-match            Test Strava import-match logic
POST   /api/strava/migrate-photos        One-time: migrate photos from sync-time to lazy-load
POST   /api/strava/migrate-routes        One-time: migrate route polylines
GET    /api/strava/migrate-routes/status Migration status check
POST   /api/webhooks/strava              Strava webhook receiver (create/update/delete events)

## Push Notifications
POST/DELETE  /api/push/subscribe         Subscribe / unsubscribe device for Web Push
POST   /api/notifications/coach         Notify coach of athlete activity
POST   /api/notifications/workout-comment  Notify on workout comment

## Cron Jobs
GET    /api/cron/backup                  ?type=daily|weekly|monthly — snapshot to Vercel Blob
GET    /api/cron/generate-insights       Daily AI insight generation (6am UTC)
GET    /api/cron/send-summaries          Summary emails every 10 days (Brevo)
GET    /api/cron/send-weekly-wrap        Weekly wrap email (Mon 8am UTC)
GET    /api/cron/send-reminders          Workout reminders

## Admin (all require admin session cookie)
GET/POST   /api/admin/verify             Auth: verify admin session / create session / delete session
GET/POST   /api/admin/backup             List / create backups (Vercel Blob)
GET/POST   /api/admin/backup/[id]        Backup detail / full restore
POST       /api/admin/backup/[id]/restore-user  Per-user restore from snapshot
GET        /api/admin/backup/download    Download backup file
POST       /api/admin/backup/seed        Create seed backup
GET        /api/admin/users              List users (or ?export=csv)
DELETE/PUT/PATCH/GET  /api/admin/users/[uid]  Soft-delete / hard-delete / restore / export user
GET        /api/admin/logs               ?type=actions|cron — audit log
POST       /api/admin/broadcast          Send announcement email to all users
POST       /api/admin/fix-milestones     Data repair: backfill milestone records
POST       /api/admin/backfill-workout-counts  Backfill workoutCount on user docs
POST       /api/admin/assign-coach       Assign coach to athlete
PATCH      /api/admin/plan-beta/[uid]    Toggle user.planBetaEnabled (20-user cap enforced via count().get())
POST       /api/admin/assign-athletes    Assign multiple athletes to coach
POST       /api/admin/migrate-merged-workouts  One-time: backfill missing fields on merged workouts
POST       /api/admin/restore            General restore endpoint

## Coach
POST   /api/coach/add-athlete            Coach: link an athlete by username

## Export
GET    /api/export/workouts              Export user workouts as JSON/CSV

## System
GET    /api/health                       Health check (uptime monitoring)
GET    /api/mcp                          Model Context Protocol server v3.0.0 (17 tools, dual auth)

## Debug / Test (non-production)
GET    /api/debug/list-users             List users (debug)
GET    /api/test-brevo                   Test Brevo email connectivity
GET    /api/test-strava                  Test Strava API connectivity
GET    /api/test/strava-sim              Strava webhook simulation

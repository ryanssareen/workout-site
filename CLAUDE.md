# The Daily Athlete - CLAUDE.md

> **Important:** Before exploring the codebase, read the following indexed files: `routes.md`, `pages.md`, `lib.md`, `schema.md`, and `components.md` as the primary source of truth. Only read actual files if necessary.

## Project Overview
The Daily Athlete is a SaaS workout tracking platform for athletes. Built with Next.js 16 (App Router), React 19, TypeScript 5.9, Firebase, and deployed on Vercel.

## Tech Stack
- **Framework:** Next.js 16 with App Router, React 19, TypeScript 5.9
- **Database:** Firestore (Firebase)
- **Auth:** Firebase Auth (email/password + Google Sign-In)
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix primitives
- **State:** Zustand stores (`src/lib/stores/`)
- **AI:** Groq SDK (LLaMA 3.3 70B + 8B instant fallback) + OpenAI SDK for workout suggestions and reports
- **MCP:** Model Context Protocol server v3.0.0 at `/api/mcp` — 17 tools (workout CRUD, user data, stats, PRs, comments, health check + 5 coach-only tools). Dual auth: API key + Firebase ID token. Role-based access (coach/athlete/student).
- **Email:** Nodemailer (Gmail SMTP) + Brevo
- **Integrations:** Strava API (OAuth + webhooks), Garmin Connect API (OAuth, pending approval), PostHog (product analytics)
- **Charts:** Recharts
- **Storage:** Vercel Blob (backups), Firebase Storage (user content)
- **Deploy:** Vercel (env vars stored there, no local .env)

## Architecture

### Directory Structure
```
src/
├── app/
│   ├── (auth)/          # Login, register, reset-password, choose-username
│   ├── (dashboard)/     # Protected routes: dashboard, workouts, calendar, reports, settings, ai-coach, profile, onboarding, wrap, review, wrapped
│   ├── athlete/[username]/ # Public athlete profile page (SSR) + /wrapped sub-route
│   ├── preview/[username]/[id]/ # Public workout preview with OG image
│   ├── workout/[id]/    # Public single workout view
│   ├── connect-strava/  # Strava connection landing page
│   ├── youwillneverguessthisistheadmin/ # Hidden admin dashboard (standalone layout, no dashboard chrome)
│   ├── api/             # API routes (ai, auth, admin, cron, push, reports, strava, webhooks, workouts, import, mcp, templates)
│   └── page.tsx         # Landing page
├── components/
│   ├── achievements/    # CelebrationModal, DashboardAchievements, MilestoneCard, PRCard — auto-detected PR + milestone celebrations
│   ├── auth/            # LoginForm, RegisterForm (Google + email, terms consent checkbox), AuthRedirect
│   ├── calendar/        # Calendar views (day/week/month/year), workout type config (TYPE_CONFIG, getTypeData)
│   ├── dashboard/       # Navbar, MobileBottomNav, ProfileCompletionBar, QuickLogFAB, ThemeToggle, stats/
│   ├── profile/         # ProfileComponents (shared PieChart, StatCard, helpers), PhotoUpload, ActivityHeatmap, EditProfileDialog
│   ├── reports/         # ReportContainer, ReportRenderer, sections/, hub/ (AIInsightCard, AskAnythingBar, ExploreCards), dashboard/ (ReportsDashboard, DuplicateRemover)
│   ├── wrapped/         # WrappedSlides (8 slide components + YearStats computation for yearly wrapped)
│   ├── strava/          # DuplicateDialog, ManualMergeDialog, StravaSyncTrigger
│   ├── onboarding/      # FileUploadStep, ImportPreview, MappingOverride, OnboardingModal
│   ├── workouts/        # WorkoutCard (with PR badge), WorkoutForm, WorkoutList, AIWorkoutSuggestions, sport-specific forms, comments/, ShareWorkoutCard, WhiteboardUpload
│   ├── ai/              # WorkoutRecommendations
│   ├── providers/       # ClientProviders, PostHogProvider, ThemeProvider
│   └── ui/              # shadcn/ui primitives (20+ components)
├── hooks/
│   ├── useSwipe.ts          # Touch swipe gesture hook for slide-based pages
│   ├── useStravaAutoSync.ts # Auto-triggers Strava sync on mount
│   └── useCoachFilter.ts    # Coach athlete filtering
├── lib/
│   ├── analytics.ts         # computeSummary, computeTypeDistribution, computeTimeSeries, computeWeeklyRhythm, computeCalendarData, computeInsights, computePRTimeline
│   ├── achievements.ts      # Achievement detection logic
│   ├── milestones.ts        # Milestone definitions + detection (workout count, distance, streak, first-ever)
│   ├── pr-detection.ts      # extractPRCandidates() — auto-detect PRs from completed workouts
│   ├── admin-auth.ts        # verifyAdminSession, checkOrigin, logAdminAction helpers for admin API routes
│   ├── api-auth.ts          # API authentication helpers
│   ├── api-client.ts        # API client utilities
│   ├── api-registry.ts      # Catalog of 100+ API endpoints grouped by category
│   ├── backup.ts            # createBackup — shared backup logic (used by manual trigger + cron)
│   ├── constants.ts         # App-wide constants
│   ├── dateUtils.ts         # Date utility functions
│   ├── dayKey.ts            # getDayKey, normalizeTimezone, parseLocalDate helpers
│   ├── firebase/            # config.ts, auth.ts, firestore.ts, admin.ts (+ getAdminStorage)
│   ├── firebase-admin.ts    # Firebase Admin SDK helper (getFirebaseAdminDb)
│   ├── email/               # Email templates (summaryTemplate, wrapTemplate, announcementTemplate, accountActionTemplate, assignmentTemplate)
│   ├── groq-dedup.ts        # Groq-powered deduplication pipeline
│   ├── groq-format.ts       # Groq formatting utilities
│   ├── import/              # CSV/XLSX import pipeline (parser, mapper, enricher, transformer, validator, types)
│   ├── polyline.ts          # Polyline encoding/decoding
│   ├── posthog.ts           # PostHog client initialization
│   ├── push.ts              # Web Push notification sending via web-push SDK
│   ├── reports/             # cache.ts + templates/ (5 report templates: sport-deep-dive, trend-report, pr-timeline, recovery-report, goal-tracker)
│   ├── schemas/             # Zod validation schemas (profile.ts has SPORT_OPTIONS, TRAINING_FOR_OPTIONS, etc.)
│   ├── training/            # logicEngine.ts, planEngine.ts, constraints.ts, validator.ts (AI workout pipeline + multi-week plan generation)
│   └── stores/              # Zustand state stores (workoutStore with 5-min TTL cache, authStore, stravaSyncStore)
└── types/                   # TypeScript types (index.ts, workout.ts, reports.ts, reports-hub.ts, ai.ts, achievements.ts)
```

### Data Model (Firestore Collections)
- **users** — uid, email, displayName, username (unique), Strava tokens, photoURL, bio, ageRange, experienceLevel, height/weight, sportPreferences, trainingFor, events (goal + eventName + eventDate), profileTagline, profilePublic, pushSubscriptions (Web Push), theme (`light`|`dark`|`system`), role (`coach`|`athlete`|`student`), coachUsername (for linked athletes), workoutCount (denormalized count for admin efficiency)
- **userMappings** — uid → username mapping (for auth lookups)
- **workouts** — Multi-sport (swim/run/bike/walk/strength/other), completion tracking, Strava sync, comments subcollection. Type-specific sub-objects: `run`, `bike`, `swim`, `walk`, `strength`.
- **personalRecords** — User PRs with history
- **chatThreads** — AI coach conversation threads
- **backups** — Admin backup metadata: `{ type: 'daily'|'weekly'|'monthly'|'manual'|'pre-restore', createdAt, userCount, workoutCount, storagePath, integrityPassed, triggeredBy }`. Backup files stored in **Vercel Blob** (daily metadata-only + weekly full snapshots).
- **adminLogs** — Admin action audit trail: `{ action, adminUid, timestamp, targetUid?, backupId?, type?, details? }`. Actions: `backup_triggered`, `restore_triggered`, `user_deleted`, `user_hard_deleted`, `user_disabled`, `user_restored`, `user_restore_triggered`, `strava_sync_forced`, `cron_backup`, `cron_backup_failed`, `backfill_workout_counts`.
- **system** — System metadata doc `lastCron`: tracks `backup_daily/weekly/monthly` timestamps for health monitoring.

## Development Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build (catches type errors)
npm run lint         # ESLint
npx tsc --noEmit     # Type check without building
```

## PWA Support
- **Manifest:** Static `public/manifest.webmanifest` (not Next.js dynamic route — Vercel requires static file)
- **Service Worker:** `public/sw.js` — cache-first for static assets (`/_next/static/`, `/icons/`, fonts), network-first for navigation (offline fallback), network-only for `/api/`, network-first with cache fallback for everything else
- **Offline Page:** `public/offline.html` — self-contained dark-themed fallback
- **Registration:** `src/components/ServiceWorkerRegister.tsx` — client component, registers SW on mount
- **Icons:** `public/icons/` — `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- **Layout:** Explicit `<link rel="manifest">` in `<head>` tag (not via `metadata.manifest` — unreliable on Vercel). Viewport has `viewportFit: 'cover'` for safe-area support. Apple web app meta tags via `metadata.appleWebApp`.
- **Safe Areas:** Use inline `style={{ paddingTop: 'env(safe-area-inset-top)' }}` — Tailwind arbitrary classes (`pt-[env(...)]`) are unreliable on physical iOS devices. Navbar, main content, and footer all use inline styles. Dashboard layout uses `overflow-x-hidden` (not `overflow-hidden` which breaks `position: sticky`).

## Key Conventions
- Use `@/` path alias for imports from `src/`
- Firebase instances accessed via `getAuthInstance()`, `getDbInstance()`, `getStorageInstance()` from `src/lib/firebase/config.ts`
- Firebase Admin SDK in `src/lib/firebase/admin.ts` — API routes only
- All dates stored as Firestore `Timestamp`, converted with `date-fns` for display
- Use `sonner` toast for user notifications
- Form handling with `react-hook-form` + `zod` validation
- Environment variables are on Vercel — never commit secrets
- Shared profile components (PieChart, StatCard, formatters) live in `src/components/profile/ProfileComponents.tsx` — used by both `/profile` and `/athlete/[username]`
- Sport options defined in `src/lib/schemas/profile.ts` — SPORT_OPTIONS (Running, Cycling, Swimming, Strength Training, Triathlon), TRAINING_FOR_OPTIONS (14 event types)
- Profile editing lives in `/settings` page (and Edit Profile Dialog modal), not the `/profile` page (profile is read-only view)
- Workout analytics (computeSummary, computeTypeDistribution) in `src/lib/analytics.ts`
- Onboarding flow at `/onboarding` — 5 steps: Intro → Name → Age → Import (CSV/XLSX workout history) → Strava Connect
- User creation uses server-side API route (`/api/auth/create-user`) with Admin SDK to bypass Firestore security rules
- Workout types: `swim`, `run`, `bike`, `walk`, `strength`, `other` — walk type added across 33 files (#81)

## Page Architecture
- `/` — Landing page: left-aligned 2-column hero with gradient overlay animations (red accent theme), sport cards showcase (swim/bike/run/strength), social proof badges, feature cards grid, CTA buttons (dark theme with red branding). Theme toggle support. Removed FAQ/how-it-works sections for tighter layout.
- `/profile` — Read-only public-style profile view (stats, pie chart, recent workouts, PRs). "Edit Profile" opens Edit Profile Dialog (also links to `/settings`)
- `/settings` — Redesigned single-card layout with left-right row sections: Profile (name, bio, tagline), Privacy (public toggle with share link), Strava (connect/disconnect), Appearance (Light/Dark/System icon picker), Account (edit profile dialog, danger zone). Edit Profile Dialog opens full form (timezone, age, experience, height/weight, sports, training goals).
- `/workouts` — Compact header, AI Workout Suggestions collapsed by default behind slim trigger bar (expandable), time filter tabs (Planned/Past/All), horizontal type filter tags (All/Run/Bike/Swim/Walk/Strength/Other), compact single-row workout list with Garmin-style stat chips (HR, elevation, calories, pace, power). Neutral/orange color scheme (no red). Delete button (trash icon) on hover for planned workouts with AlertDialog confirmation. Recurring workouts only shown in Planned tab within next 7 days.
- `/workouts/new` — Create workout form with type-specific sub-forms, supports AI-generated templates (via sessionStorage) and saved templates. Preview dialog before creation. Reads `date` and `tag` URL params from calendar dropdown navigation.
- `/athlete/[username]` — Public athlete profile (SSR), shares components with `/profile` via ProfileComponents.tsx
- `/onboarding` — 5-step onboarding: intro (welcome splash) → name (display name with profanity check) → age (age range selection) → import (CSV/XLSX workout history upload via `/api/workouts/import`) → strava (OAuth connect with benefits list)
- `/calendar` — Multi-view calendar (day/week/month/year). Week view: 7-day grid with color-coded workout pills, weekly summary bar. Month view: full month grid with activity dots. Year view: heatmap-style activity density. Supports ICS export, email report. CalendarAddDropdown on each day cell: "Add Event" (→ `/workouts/new?date=...&tag=race`), "Add Note" (inline popup saves as "other" type workout). Components in `src/components/calendar/`.
- `/wrap` — Weekly Training Wrap ("Your Week's Capsule"). Immersive full-screen layout with week-by-week navigation. **Monday–Sunday week boundaries** (ISO 8601, `weekStartsOn: 1`). Per-sport stats with week-over-week comparison (% change), highlight of the week (longest/furthest workout with photo), rating system (incredible/solid/consistent/recovery/quiet). Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image).
- `/review` — Monthly Review page. Month navigation with "not ready" gate for current month. Hero row with key stats (workouts, distance, time, active days). Activity calendar grid, per-sport stats with month-over-month comparison, pie chart breakdown, vs last month comparison (% change per metric), daily activity bar chart, weekly distance + duration area charts. Mobile-first redesign with bold stats, sport labels, stacked bar chart, branding. Share via ShareButtons.
- `/wrapped` — Yearly Wrapped (2025). 8-slide interactive carousel: guess (interactive workout count guess game) → reveal → stats → breakdown → records → heatmap → summary → final. Public sharing route at `/athlete/[username]/wrapped` with SSR, OG images, privacy gate. Components in `src/components/wrapped/WrappedSlides.tsx`.
- `/reports` — **3-zone Reports Hub**. Zone 1: AI Insight Card (daily Groq-generated, cached in Firestore) + Ask Anything bar. Zone 2: Links to Weekly Wrap, Monthly Review, Year in Review. Zone 3: Context-aware deep-dive cards (Sport Deep Dive, Trend Report, Goal Tracker, Recovery Report, PR Timeline, Training Analysis). Template-based report generation with 5 templates, Groq AI, Firestore caching (6-24h TTL), 8B model fallback.
- `/reports/[reportType]` — Dynamic report pages with skeleton loading. Generated from templates via Groq AI.
- `/dashboard` — Unified workout view. Stats row (streak, this week, all-time, total), weekly activity bar chart, type breakdown, upcoming workouts (correctly excludes past), recently completed, event countdowns, weekly wrap CTA, monthly review CTA, quick links grid.
- `/privacy` — Privacy Policy page. Covers account data, workout data, third-party integrations (Strava, Garmin), AI features, PostHog analytics, data storage, user rights, and retention. Required for Garmin API access.
- `/terms` — Terms of Service page. Covers acceptable use, third-party integrations (Strava, Garmin), AI disclaimer, account termination, liability limitations. Required for Garmin API access.
- `/portfolio` — Feature tour page with real screenshots, light/dark toggle.
- `/roadmap` — Visual phase timeline with progress tracking.
- `/comic` — 14-slide origin story carousel.
- `/connect-strava` — Strava connection landing page.
- `/preview/[username]/[id]` — Public workout preview page (no auth required) with OG image generation for social sharing.
- `/workout/[id]` — Public single workout view (no auth required).
- `/features` — Marketing features page.
- `/contact` — Contact page.
- `/firebase-test` — Firebase connection test page.
- `/youwillneverguessthisistheadmin` — **Hidden admin dashboard** (actual route, security by obscurity + auth). Not linked from any nav. Firebase Auth + UID allowlist. Sections: Overview (user/workout counts, last backup), Backups (daily/weekly/monthly via Vercel Blob, download-on-demand, restore from file upload), Users (list, soft-delete, restore via Admin SDK), System Actions (manual backup trigger, log viewer), **API Playground** (execute any endpoint with custom params, response timing), **API Registry** (catalog of 88+ endpoints grouped by category with search/filter). Cron backups run daily/weekly/monthly via Vercel cron jobs.

## AI Workout Suggestions
- 3-tier pipeline: Logic Engine (periodization, fatigue, deload) → Groq LLaMA 3.3 70B enhancement → Validator with retry
- `src/lib/training/logicEngine.ts` — generates base plan from athlete profile + recent history
- `src/lib/training/planEngine.ts` — deterministic scheduling: picks dates, types, intensity, duration for multi-week training plans
- `src/lib/training/constraints.ts` — defines `PlannedWorkout`, `EnhancedWorkout`, load constraints
- `src/lib/training/validator.ts` — validates AI modifications stay within bounds
- `src/app/api/ai/workout-suggestions/route.ts` — orchestrator API (max_tokens: 8000)
- `src/components/workouts/AIWorkoutSuggestions.tsx` — UI component, normalizes `specs` → flat type keys for form compatibility
- Flow: AI generates → user clicks "Use Workout" → data stored in sessionStorage → navigates to `/workouts/new?aiGenerated=true` → form pre-fills via `key` prop remount

## Reports Hub
- **3-zone layout** replacing old 6-tab dashboard
- **Zone 1:** AI Insight Card (daily Groq-generated, cached in Firestore) + Ask Anything bar for freeform questions
- **Zone 2:** Links to Weekly Wrap, Monthly Review, Year in Review
- **Zone 3:** Context-aware deep-dive cards — Sport Deep Dive, Trend Report, Goal Tracker, Recovery Report, PR Timeline, Training Analysis
- **Template-based generation** — 5 report templates, Groq AI (LLaMA 3.3 70B with 8B fallback), Firestore caching (6-24h TTL)
- **Dynamic pages** at `/reports/[reportType]` with skeleton loading states
- **Daily insight cron** at `/api/cron/generate-insights` (6am UTC)
- **Chart fixes:** multi-series support, auto-detection of data keys, explicit height for `ResponsiveContainer`

## Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`) — Monday–Sunday week boundaries (ISO 8601). Per-sport stats with week-over-week comparison, highlight detection (longest/furthest workout), rating system. Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image). Uses `html-to-image` for card export. Redesigned for social sharing to match monthly review patterns.
- **Monthly Review** (`/review`) — Activity calendar, sport stats, pie chart breakdown, vs last month comparison, daily bar chart, weekly trend area charts. Gate prevents viewing current month until it ends. Mobile-first redesign with bold stats, sport labels, stacked bar chart, branding. Share images switched from PNG to JPG.
- **Share fix (#61)** — Monthly review sharing now uses images instead of login-required links.
- **Yearly Wrapped** (`/wrapped`) — 8-slide interactive carousel with guess game. Public sharing at `/athlete/[username]/wrapped` with SSR + OG images. Privacy-gated via `profilePublic` flag. Components in `src/components/wrapped/WrappedSlides.tsx`.
- **ShareButtons** component (`src/components/workouts/ShareWorkoutCard.tsx`) — Reusable share UI: Instagram Story, WhatsApp, X/Twitter, iMessage, save image (JPG via `html-to-image`), copy link. Used by wrap, review, wrapped, and workout sharing.
- **Email system** — Summary emails every 10 days via Brevo cron (`/api/cron/send-summaries`). Wrap email template at `src/lib/email/wrapTemplate.ts`.

## Authentication
- **Google Sign-In + Email/Password** via Firebase Auth
- **Server-side user creation** — `/api/auth/create-user/route.ts` uses Admin SDK to bypass Firestore security rules (client-side transactions fail on retry because `userMappings` rules only allow `create`, not `update`)
- **Username selection** — `/choose-username` route for selecting unique username after registration
- **Username validation** — regex `/^[a-z0-9_]{3,20}$/`, 29 reserved words (admin, api, dashboard, etc.). Checked via `/api/auth/check-username`.
- **Idempotent** — handles re-registration gracefully (returns existing profile if same UID+username)
- **Atomic batch** — creates user doc + userMapping in single batch write

## Workout Import
- **Route:** `/api/workouts/import/route.ts` — AI-powered CSV/XLSX import with programmatic date detection
- **Programmatic date detection** — scans columns for date patterns, detects DD/MM vs MM/DD format at column level (if any value has first number >12, entire column is DD/MM). Pre-parses dates to ISO strings before sending to AI. Overrides AI dates with pre-parsed values after AI returns.
- **AI role** — Groq handles workout type, name, description, duration, distance extraction only (NOT dates)
- **Model fallback** — tries `llama-3.3-70b-versatile` first, falls back to `llama-3.1-8b-instant` on 429 rate limit
- **Row indexing** — adds ROW# to each row for cross-referencing AI output back to source data
- **Limits** — max 500 rows, 200 workouts per import, Firestore batch writes (490 per batch)
- **Source field** — imported workouts have `source: 'import'` for Strava merge matching
- **Used in onboarding** — step 4 of the 5-step onboarding flow
- **Description formatting** — `/api/import/format-description` endpoint for cleaning up imported workout descriptions

## Push Notifications
- **Web Push API** with VAPID authentication
- **Client:** `src/components/PushNotificationManager.tsx` — prompts in standalone (PWA) mode
- **Server:** `src/lib/push.ts` — sends notifications via `web-push` SDK
- **API:** `/api/push/subscribe/route.ts` — POST (subscribe) / DELETE (unsubscribe)
- **Storage:** `pushSubscriptions` array on user doc (supports multiple devices)
- **Dedup:** subscriptions deduplicated by endpoint
- **Cleanup:** auto-removes expired subscriptions (410/404 responses)
- **Use cases:** Strava sync completion, weekly wrap ready
- **Env vars:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- **User scoping (#74):** Subscriptions tracked by `localStorage` key `push_subscribed_username`. On user switch, previous user's subscription is removed from Firestore before subscribing new user. On logout, subscription is removed automatically. Scoped to logged-in user only.

## Strava Sync
- **2-stage sync architecture** — Quick fill (metadata-only) + paginated backfill replaced the old all-at-once approach. Quick fill fetches activity summaries for fast calendar population; backfill fetches full details (laps, splits, photos) on-demand.
- **Rate limit hardening** — Parses Strava `X-RateLimit-Limit` and `X-RateLimit-Usage` headers (15-min window vs daily quota). Removed retry loops that worsened cooldowns. Server returns `retryAfter` timer so client shows countdown. In-flight guard prevents duplicate sync requests.
- **Timezone fix (#86)** — `start_date_local` was being misinterpreted as UTC on Vercel (appending "Z"), shifting late-evening IST workouts to the next day. New `parseLocalDate()` helper strips timezone suffix and parses as-is. One-time migration endpoint at `/api/workouts/fix-timezone`.
- **On-demand photo/detail loading** — Photos and laps/splits data moved from sync-time to lazy-load on workout detail view, saving API calls during sync.
- **Planned workout merge fix (#84)** — Merged workouts were missing `date`, `duration`, and type-specific sub-objects (`run`, `bike`, `swim`). New `buildTypeSpecificFields()` helper constructs proper sub-objects from Strava data. One-time migration endpoint to backfill existing merged workouts.
- **Webhook improvements** — Better reconciliation logic for create/update/delete events. Update events now persist detailed fields (HR, elevation, calories). Delete events properly clean up workout documents.
- **Manual merge dialog** — New UI component to link missed planned workouts to Strava activities after the fact. Athlete selects an unmatched planned workout and a recent Strava activity to merge them.
- **Cleanup endpoint** — Now quota-safe with targeted `workoutId` or `stravaActivityId` mode instead of scanning the entire workouts collection.
- **Quota-safe POST mode** — when tokens available, sends them in request body to avoid Firestore reads on server (bypasses Spark plan quota limits)
- **GET fallback** — reads tokens from Firestore, falls back to POST if quota hit (429)
- **Error safety** — `toErrorString()` helper in `stravaSyncStore.ts` prevents Firebase error objects `{code, message}` from leaking into React rendering (fixes React error #31)
- **Store:** `src/lib/stores/stravaSyncStore.ts` — Zustand store with `startSync`, `checkDuplicates`, `clearResult`
- **Hook:** `src/hooks/useStravaAutoSync.ts` — auto-triggers sync on mount, handles quota exhaustion gracefully
- **Import merge** — when syncing, matches Strava activities to imported workouts (`source: 'import'`) by same day + same type + distance within 10%. Updates imported workout with Strava data instead of creating duplicates. Strength workouts match by type+date alone (no distance).
- **Date fix:** Always use `activity.start_date_local` with `parseLocalDate()` helper — NOT `start_date` (UTC timestamp causes wrong local time parsing, e.g. 5:30h offset for IST users).

## Calendar
- **Add Workout** button centered in CalendarHeader next to date label
- **Add Event** (via CalendarAddDropdown) — navigates to `/workouts/new?date=YYYY-MM-DD&tag=race`
- **Add Note** (via CalendarAddDropdown) — inline popup with textarea, saves as "other" type workout via `createWorkout()` with `tags: ['note']`, refreshes calendar via `onNoteAdded` callback
- **CalendarAddDropdown** — `src/components/calendar/CalendarAddDropdown.tsx`, uses `onNoteAdded` callback threaded through CalendarWeekView/CalendarFullMonthView to calendar page's `refreshWorkouts`
- **Notes filtering** — workouts tagged `tags: ['note']` (type `'other'`, name `'Note'`) are excluded from the `/workouts` page. Filter applied before time and type tabs.

## Workout Deletion
- **Delete planned workouts** — available on workouts list page for future uncompleted workouts
- **UI:** Trash icon appears on hover for planned workout rows, opens AlertDialog confirmation
- **Access control:** Delete button shown for future uncompleted workouts
- **Function:** `deleteWorkout(ownerUsername, id)` in `src/lib/firebase/firestore.ts`
- **Optimistic update:** Removed from local state immediately on success

## Theme & UI
- **Light mode by default** — Replaced hardcoded `bg-black`/`text-white` with theme-aware CSS variables across all pages
- **Global theme toggle** — Sun/moon toggle on landing page, auth pages, admin, all static pages
- **Settings page:** New Appearance section with Light/Dark/System picker
- **Edit Profile Dialog** — New modal accessible from profile page, settings page simplified
- **Safari favicon** — Added 32x32 PNG with explicit link tags

## Admin Dashboard
- **Route:** Hidden at `/youwillneverguessthisistheadmin` — security by obscurity + auth. Standalone layout (no dashboard chrome). Auth gate shown as modal overlay.
- **Security:** Firebase Auth + UID allowlist (`ADMIN_UIDS` env var, comma-separated UIDs). Flow: Google sign-in → ID token → `POST /api/admin/verify` → HMAC-SHA256 signed `httpOnly` cookie (4h). `GET /api/admin/verify` checks session. `DELETE /api/admin/verify` clears it. Rate limit: 5 attempts/IP/15 min with 2s delay on failures. CSRF: all mutating routes check `Origin` header.
- **API Playground** at `/admin/api` — Execute any endpoint with custom params, see response timing.
- **API Registry** — Catalog of 100+ endpoints grouped by 14 categories with search/filter.
- **Backup storage:** **Vercel Blob** — daily metadata-only backups + weekly full snapshots. Download-on-demand. Restore from file upload. Auto-pruning old backups.
- **Backup API:** `GET/POST /api/admin/backup` — list/create. `GET/POST /api/admin/backup/[id]` — detail/full-restore (auto pre-restore snapshot first). `POST /api/admin/backup/[id]/restore-user` — per-user restore from snapshot. Backup logic in `src/lib/backup.ts`.
- **Users API:** `GET /api/admin/users` (list, or `?export=csv`), `DELETE/PUT/PATCH/GET /api/admin/users/[uid]` — DELETE soft-disables (Firebase Auth disabled, sends account-disabled email with reason), PUT permanently deletes (hard-deletes all data, sends account-deleted email), PATCH restores, GET exports as JSON. Preset reason chips in admin UI modals. `workoutCount` denormalized on user docs (backfill via `/api/admin/backfill-workout-counts`).
- **Account action emails:** `src/lib/email/accountActionTemplate.ts` — branded HTML templates for disable, delete, and restore notifications
- **Logs API:** `GET /api/admin/logs?type=actions|cron` — reads `adminLogs` Firestore collection
- **Cron:** `src/app/api/cron/backup/route.ts` — `?type=daily|weekly|monthly`, snapshot to Vercel Blob, integrity check, prunes old backups, writes to `adminLogs` + `system/lastCron`
- **UI iterations** — Went through glassmorphic → red accent → final polished version
- **Env vars required:** `ADMIN_UIDS` (comma-separated Firebase UIDs), `ADMIN_SECRET` (32-char random, signs session cookie), `BLOB_READ_WRITE_TOKEN` (Vercel Blob access)

## Achievements & Milestones
- **PR Detection** — `src/lib/pr-detection.ts` extracts PR candidates (longest run, fastest pace, heaviest lift, etc.) from completed workouts. Checked after workout completion and Strava sync.
- **Milestone System** — `src/lib/milestones.ts` defines milestones across 4 categories: workout count (10/25/50/100/250/500/1000), distance (100km/500km/1000km/5000km), streak (7/14/30/60/100/365 days), and first-ever (first swim, first ride, etc.).
- **Celebration Modal** — `src/components/achievements/CelebrationModal.tsx` — full-screen confetti celebration when PRs or milestones are hit. Carousel-style navigation for multiple achievements. Share via ShareButtons.
- **Dashboard Display** — `src/components/achievements/DashboardAchievements.tsx` shows recent PRs + milestones on dashboard.
- **Types** — `src/types/achievements.ts` defines `Milestone`, `DetectedPR`, `ConfirmedPR`, `MilestoneCategory`, `AchievementResult`.
- **Admin fix endpoint** — `/api/admin/fix-milestones` for data repair.

## MCP Server (v3.0.0)
- **Route:** `/api/mcp` — Model Context Protocol server using `@modelcontextprotocol/sdk`
- **Transport:** `WebStandardStreamableHTTPServerTransport` for HTTP-based communication
- **Auth:** Dual-mode — API key (timing-safe comparison, for Claude Desktop) or Firebase ID token (for web). Validates `role` field (coach/athlete/student) and enforces coach-athlete relationships via `coachUsername` on user docs.
- **Data isolation:** Each user only accesses their own data. Coaches can access linked athletes' data via coach-only tools.
- **Core tools (all roles):** `get_user_workouts`, `get_workout_detail`, `get_my_profile`, `get_my_stats`, `create_workout`, `update_workout`, `delete_workout`, `complete_workout`, `get_workout_comments`, `add_workout_comment`, `get_personal_records`, `check_data_health`
- **Coach-only tools (registered when role=coach):** `get_my_athletes`, `get_athlete_workouts`, `get_athlete_workout_detail`, `assign_workout`, `get_coach_dashboard_stats`
- **Safe output types:** Strict `SafeWorkout`/`SafeUser` interfaces with null-checking helpers prevent raw Firestore data leakage
- **Use case:** Enables AI agents (Claude Code, etc.) to read and write workout data programmatically. Coaches can manage athlete training remotely.

## Known Issues & Active Work
- Custom domain (thedailyathlete.in) has DNS/NXDOMAIN issues — likely Squarespace registration problem
- Groq rate limits (100K tokens/day on 70B model) — mitigated with 8B fallback but can still hit both limits
- Firebase Spark plan daily quota (50K reads) — mitigated with Zustand caching, but heavy usage days can still exhaust quota

## Recent Changes (March–April 2026)

### UX Polish & Gamification
- Animated page transitions via `next-view-transitions` ViewTransitions wrapper
- Confetti burst on workout completion (CSS-only, no library)
- Skeleton loading states on dashboard (shimmer placeholders instead of spinners)
- Gradient accent stat cards on dashboard (streak, weekly, all-time)
- Duolingo-style streak widget with animated flame that scales with streak length
- "This time last month" comparison badge on dashboard (links to trend report)
- GitHub-style activity heatmap on profile page (reuses wrapped heatmap pattern)
- Gold PR badges on workout cards when a workout set a personal record
- Quick-log floating action button (FAB) on mobile for fast workout creation
- Workout templates — save/load reusable workout presets (fix for broken #42)
- Post-workout emoji rating picker (😫😐😊🔥💀) stored on workout doc
- Smart workout naming — auto-suggests name based on type + time of day
- Swipe navigation on all review pages (wrap, review, wrapped) for mobile/tablet
- Monthly comparison badge links to `/reports/trend-report`

### Weekly Wrap & Monthly Review Gamification
- Both pages converted from scrollable layouts to slide-based reveal experiences
- Animated count-up numbers (useCountUp hook) with staggered card reveals
- Weekly wrap: 4 slides (Verdict → Numbers → Day by Day → By Sport)
- Monthly review: 5 slides (Month → Numbers → vs Last Month → Calendar → Breakdown)
- Daily activity bar charts with animated growing bars colored by sport
- Highlight of the week with trophy icon

### Yearly Wrapped Improvements
- Light/dark theme toggle (Sun/Moon button in top bar)
- CSS variable overrides in hex format for Tailwind v4 compatibility
- Improved contrast on all 8 slides in both light and dark modes
- Stats stored in useState (not useRef) — fixes inconsistent workout count bug
- Confetti burst on reveal slide

### Login Performance
- Removed `setPersistence(browserLocalPersistence)` — was adding 20-30s latency on production
- localStorage auth cache for instant returning-user loads
- Eager profile fetch after sign-in (parallel with navigation)
- Workout prefetch in background from auth store hydration

### Reports & Data
- All 5 report templates guarded with `safeDate()` against corrupted Firestore dates
- All client-side `.date.toDate()` calls guarded (10 files) — prevents `Invalid time value` crashes
- Reports and dashboard gracefully handle Firebase quota errors (show cached data or friendly message)
- Recovery nudge on dashboard when 3+ consecutive training days detected
- AI broadcast email endpoint (`/api/admin/broadcast`)

### Legal & Auth
- Privacy Policy (`/privacy`) and Terms of Service (`/terms`) pages
- Terms/Privacy consent checkbox on registration form (gates both email and Google sign-up)
- Footer links to Privacy/Terms on all public pages
- Remember me enabled by default on login
- Redesigned weekly email digest (Anthropic-inspired clean style)

### Achievements & Milestones
- Auto-detected PR system with extractPRCandidates() for run/bike/swim/walk/strength types
- Milestone badge system: workout count, distance, streak, first-ever categories
- CelebrationModal with confetti + carousel for multiple achievement reveals
- Dashboard achievements section showing recent PRs + milestones

### MCP Server v3.0.0
- Dual auth: API key (Claude Desktop) + Firebase ID token (web)
- Role-based access: coach/athlete/student with data isolation
- 5 new coach-only tools: `get_my_athletes`, `get_athlete_workouts`, `get_athlete_workout_detail`, `assign_workout`, `get_coach_dashboard_stats`
- Strict `SafeWorkout`/`SafeUser` output types with null-checking

### Training Plans
- `planEngine.ts` — deterministic multi-week plan scheduling (dates, types, intensity, duration)
- Periodization-aware skeleton generation that AI enhances with details

### Admin Enhancements
- Account disable/delete with preset reason chips and email notifications (`accountActionTemplate.ts`)
- `workoutCount` denormalized on user docs to eliminate N+1 reads in admin user list
- Backfill endpoint at `/api/admin/backfill-workout-counts`

### UI Redesigns (April 2026)
- Landing page: left-aligned 2-column hero with gradient overlays, sport cards, red accent branding
- Auth pages: ambient background gradients, centered forms with social proof indicators
- Settings page: single-card left-right row layout (Profile, Privacy, Strava, Appearance, Account sections)
- CelebrationModal: upgraded confetti particle system (randomized colors, spin+fall CSS animations), carousel navigation for multiple achievements

### Error Handling & Performance
- Error boundaries (`error.tsx`) for dashboard, calendar, workouts, reports with retry buttons
- Loading skeletons (`loading.tsx`) with animate-pulse matching actual content layouts
- `Next.js Image` component replacing raw `<img>` tags across the app
- `maxLength` constraints on form inputs (name, description, bio)
- `aria-label` on icon-only buttons for accessibility
- Shared `safeToDate()` extracted to `src/lib/dateUtils.ts` (replaces duplicate implementations)
- Magic numbers extracted to `src/lib/constants.ts` (time conversions, batch limits, query windows)
- Reduced Firestore reads: eliminated double-fetch and redundant queries on calendar and workout pages

### Sharing & Social
- OG image generation at `/preview/[username]/[id]/opengraph-image.tsx` for workout social cards
- Share buttons refactored: send preview URL for rich link previews instead of trying to copy images
- Native Share API integration for WhatsApp, X, iMessage, Instagram
- Image generation via `html-to-image` with CORS handling and configurable dimensions

### Calendar & Workouts
- Optimistic completion toggle on calendar cards (prevents empty state flash)
- Completion toggle moved outside Link wrapper to prevent navigation on mobile tap
- 6-state workout status system on calendar: Strava standalone, Strava-matched, late completion, manual completion, missed, future — with status-driven color coding
- Context-aware back navigation from workout detail page
- Non-recurring workouts hidden until 24h before scheduled time (for athletes)
- Future recurring workouts hidden from all tabs until scheduled day
- Removed 24h filter from calendar view — shows all workouts for the day

### Bug Fixes
- WhatsApp/iMessage share now opens native apps instead of browser tabs
- Achievements section spans full width when only PRs or milestones exist
- Activity heatmap month labels properly positioned on profile page
- React hooks order violation fixed in wrap/review (useCountUp before early returns)
- Calendar add button centered in day cell instead of top-right corner
- Rebrand: replaced all CoachTrack references with The Daily Athlete

## Firestore Read Budget
This project runs on Firebase with a **50k reads/day limit**. Every API route, migration, and cron job must be designed with read cost as a primary constraint.

**Design rules:**
- **Always estimate read cost before writing code.** Count: 1 read per document returned by a query (not per query call). A query returning 500 docs = 500 reads.
- **Never scan all workouts.** With 500 users × 4000 workouts = 2M docs. Use targeted queries (`where` filters, `mergeMeta.method`, date ranges) to read only the documents you need.
- **Use `select()` for metadata-only queries.** `db.collection('users').select().get()` returns doc IDs without field data — still counts as reads but transfers less data.
- **Use `count().get()` instead of `.get()` when you only need counts.** Counts as 1 read regardless of collection size.
- **Use `collectionGroup()` for cross-user queries** instead of iterating per-user subcollections (e.g., `collectionGroup('workouts').where('updatedAt', '>', ts)` = 1 query vs N per-user queries).
- **Use Firestore `in` operator** to batch lookups (up to 30 values per query) instead of 1 query per value.
- **Add date bounds** to queries that could return large result sets (e.g., planned workouts, sync ranges).
- **Cache aggressively** on the client (Zustand stores with TTL) and server (in-memory caches).
- **For migrations/backfills:** always support `?username=X` param for per-user execution. Never assume you can read all data in one request. Always provide `?dryRun=true` mode.
- **Cron jobs:** daily crons should target only changed data (delta queries with `updatedAt > lastRun`), not full collection scans.

**Implemented optimizations:**
- **Workout cache store (Zustand)** — 5-min TTL + request deduplication. All 10+ dashboard pages use cached data instead of independent fetches.
- **Auth store fix** — Eliminated double `getUsernameFromUid` call per auth event.
- **Batched Strava lookups** — N individual queries → `ceil(N/30)` batched `in` queries.
- **Auth guards added** — `/api/strava/sync-all` was completely open, cron routes now return 401 properly.
- **Cache invalidation (#85)** — `workoutStore` cache cleared after `createWorkout()` so new workouts appear immediately.

## Infrastructure
- **PostHog analytics** — Product analytics integration with `PostHogProvider` wrapping the app
- **Vercel Blob** — Replaced Firebase Storage for backups (no Blaze plan needed). `BLOB_READ_WRITE_TOKEN` env var.
- **Firestore indexes** — Added composite indexes for backups collection (type + createdAt)
- **vercel.json** — 5 cron jobs: weekly wrap (Mon 8am UTC), daily insights (6am UTC), daily/weekly/monthly backups. Firebase auth rewrites.
- **MCP server (v3.0.0)** — `/api/mcp` route for AI agent integration via `@modelcontextprotocol/sdk`. Dual auth (API key + Firebase token), role-based access, 17 tools including 5 coach-only tools.
- **Workout templates API** — `GET/POST /api/templates`, `GET /api/templates/[id]` for saved workout presets
- **Import pipeline** — `src/lib/import/` with parser, mapper, enricher, transformer, validator modules
- **API routes:** `/api/import/format-description` for description formatting, `/api/workouts/fix-timezone` for timezone migration, `/api/workouts/auto-dedup` for automatic deduplication
- **Timezone fix migration** — One-time endpoint to fix `start_date_local` misinterpretation on existing workouts
- **Health endpoint** — `/api/health` for uptime monitoring

## Code Style
- Prefer functional components with hooks
- Use `async/await` over `.then()` chains
- Descriptive variable names, no abbreviations
- Keep components focused — extract logic to hooks or utils when > 150 lines
- API routes use standard Next.js App Router conventions (`route.ts`)
- Always handle loading and error states in UI components

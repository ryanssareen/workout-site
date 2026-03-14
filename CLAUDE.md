# CoachTrack - CLAUDE.md

## Project Overview
CoachTrack (The Daily Athlete) is a SaaS workout tracking platform connecting coaches with athletes via unique 6-letter codes. Built with Next.js 16 (App Router), React 19, TypeScript 5.9, Firebase, and deployed on Vercel.

## Tech Stack
- **Framework:** Next.js 16 with App Router, React 19, TypeScript 5.9
- **Database:** Firestore (Firebase)
- **Auth:** Firebase Auth (email/password + Google Sign-In)
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix primitives
- **State:** Zustand stores (`src/lib/stores/`)
- **AI:** Groq SDK (LLaMA 3.3 70B + 8B instant fallback) + OpenAI SDK for workout suggestions and reports
- **Email:** Nodemailer (Gmail SMTP) + Brevo
- **Integrations:** Strava API (OAuth + webhooks)
- **Charts:** Recharts
- **Deploy:** Vercel (env vars stored there, no local .env)

## Architecture

### Directory Structure
```
src/
├── app/
│   ├── (auth)/          # Login, register, reset-password
│   ├── (dashboard)/     # Protected routes: dashboard, workouts, calendar, reports, settings, ai-coach, progress, records, profile, onboarding, wrap, review, wrapped
│   ├── athlete/[username]/ # Public athlete profile page (SSR)
│   ├── api/             # API routes (ai, auth, cron, push, reports, strava, webhooks, workouts)
│   └── page.tsx         # Landing page
├── components/
│   ├── auth/            # LoginForm, RegisterForm (Google + email)
│   ├── calendar/        # Calendar views, workout type config (TYPE_CONFIG, getTypeData)
│   ├── dashboard/       # Navbar, layout components, ProfileCompletionBar
│   ├── profile/         # ProfileComponents (shared PieChart, StatCard, helpers), PhotoUpload
│   ├── reports/         # ReportContainer, ReportRenderer, section components, ReportsSections (5 chart/stat sections)
│   ├── wrapped/         # WrappedSlides (6 slide components + YearStats computation for yearly wrapped)
│   ├── strava/          # DuplicateDialog for Strava sync conflicts
│   ├── workouts/        # WorkoutCard, WorkoutForm, AIWorkoutSuggestions, StrengthForm, comments, ShareWorkoutCard
│   └── ui/              # shadcn/ui primitives
├── lib/
│   ├── analytics.ts     # computeSummary, computeTypeDistribution, computeTimeSeries, computeWeeklyRhythm, computeCalendarData, computeInsights, computePRTimeline
│   ├── firebase/        # config.ts, auth.ts, firestore.ts, admin.ts
│   ├── email/           # Email templates (summaryTemplate, wrapTemplate) and sending
│   ├── schemas/         # Zod validation schemas (profile.ts has SPORT_OPTIONS, TRAINING_FOR_OPTIONS, etc.)
│   ├── training/        # logicEngine.ts, constraints.ts, validator.ts (AI workout pipeline)
│   └── stores/          # Zustand state stores
└── types/               # TypeScript types (index.ts, workout.ts, reports.ts, ai.ts)
```

### Data Model (Firestore Collections)
- **users** — uid, email, displayName, username (unique), role (`coach`|`athlete`), coachId, coachCode (6-letter), Strava tokens, photoURL, bio, ageRange, experienceLevel, height/weight, sportPreferences, trainingFor, events (goal + eventName + eventDate), profileTagline, profilePublic, pushSubscriptions (Web Push)
- **userMappings** — uid → username mapping (for auth lookups)
- **workouts** — Multi-sport (swim/run/bike/strength/other), assigned coach→athlete, completion tracking, Strava sync, comments subcollection
- **personalRecords** — User PRs with history
- **chatThreads** — AI coach conversation threads
- **backups** — Admin backup metadata: `{ type: 'daily'|'weekly'|'monthly', createdAt, userCount, workoutCount, storagePath }`. Backup JSON files stored in Firebase Storage at `backups/{type}/{ISO-timestamp}.json`.

### Role-Based Access
- **Coaches** can create/assign workouts, view all their athletes' data, generate reports
- **Athletes** can only view/complete their own workouts and see their own progress
- Coach code system: coaches get a unique 6-letter code, athletes enter it during registration

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
- `'student'` role is legacy — always use `'athlete'` for new code
- Environment variables are on Vercel — never commit secrets
- Shared profile components (PieChart, StatCard, formatters) live in `src/components/profile/ProfileComponents.tsx` — used by both `/profile` and `/athlete/[username]`
- Sport options defined in `src/lib/schemas/profile.ts` — SPORT_OPTIONS (Running, Cycling, Swimming, Strength Training, Triathlon), TRAINING_FOR_OPTIONS (14 event types)
- Profile editing lives in `/settings` page, not the `/profile` page (profile is read-only view)
- Workout analytics (computeSummary, computeTypeDistribution) in `src/lib/analytics.ts`
- Onboarding flow at `/onboarding` — 5 steps: Intro → Name → Age → Import (CSV/XLSX workout history) → Strava Connect
- User creation uses server-side API route (`/api/auth/create-user`) with Admin SDK to bypass Firestore security rules

## Page Architecture
- `/` — Landing page: centered hero ("Your training, all in one place"), sport pills, how-it-works steps, 6-card features grid (Strava Sync, Visual Calendar, Progress Tracking, AI Coach, Multi-Sport, Email Reminders), FAQ, CTA. Dark theme, simplified design.
- `/profile` — Read-only public-style profile view (stats, pie chart, recent workouts, PRs). "Edit Profile" links to `/settings`
- `/settings` — Full profile edit form (name, bio, timezone, age, experience, height/weight, sports, training goals with event name/date), Strava integration, public profile toggle, account management
- `/workouts` — Compact header, AI Workout Suggestions collapsed by default behind slim trigger bar (expandable), time filter tabs (Planned/Past/All), horizontal type filter tags (All/Run/Bike/Swim/Strength/Other), compact single-row workout list with Garmin-style stat chips (HR, elevation, calories, pace, power). Neutral/orange color scheme (no red). Delete button (trash icon) on hover for planned workouts with AlertDialog confirmation.
- `/workouts/new` — Create workout form with type-specific sub-forms, supports AI-generated templates (via sessionStorage) and saved templates. Preview dialog before creation. Reads `date` and `tag` URL params from calendar dropdown navigation.
- `/athlete/[username]` — Public athlete profile (SSR), shares components with `/profile` via ProfileComponents.tsx
- `/onboarding` — 5-step onboarding: intro (welcome splash) → name (display name with profanity check) → age (age range selection) → import (CSV/XLSX workout history upload via `/api/workouts/import`) → strava (OAuth connect with benefits list)
- `/calendar` — Multi-view calendar (day/week/month/year). Week view: 7-day grid with color-coded workout pills, weekly summary bar. Month view: full month grid with activity dots. Year view: heatmap-style activity density. Supports coach athlete picker, ICS export, email report. CalendarAddDropdown on each day cell: "Add Event" (→ `/workouts/new?date=...&tag=race`), "Add Note" (inline popup saves as "other" type workout). Components in `src/components/calendar/`.
- `/wrap` — Weekly Training Wrap ("Your Week's Capsule"). Immersive full-screen layout with week-by-week navigation. **Monday–Sunday week boundaries** (ISO 8601, `weekStartsOn: 1`). Per-sport stats with week-over-week comparison (% change), highlight of the week (longest/furthest workout with photo), rating system (incredible/solid/consistent/recovery/quiet). Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image).
- `/review` — Monthly Review page. Month navigation with "not ready" gate for current month. Hero row with key stats (workouts, distance, time, active days). Activity calendar grid, per-sport stats with month-over-month comparison, pie chart breakdown, vs last month comparison (% change per metric), daily activity bar chart, weekly distance + duration area charts. Share via ShareButtons.
- `/wrapped` — Yearly Wrapped (2025). 8-slide interactive carousel: guess (interactive workout count guess game) → reveal → stats → breakdown → records → heatmap → summary → final. Public sharing route at `/athlete/[username]/wrapped` with SSR, OG images, privacy gate. Components in `src/components/wrapped/WrappedSlides.tsx`.
- `/dashboard` — Stats row (streak, this week, all-time, total), weekly activity bar chart, type breakdown, upcoming workouts, recently completed, event countdowns, weekly wrap CTA, monthly review CTA, quick links grid
- `/admin` — **Hidden admin dashboard** (not linked from any nav). Password-protected via `ADMIN_PASSWORD` env var + signed `httpOnly` cookie (`ADMIN_SECRET`). Sections: Overview (user/workout counts, last backup), Backups (daily/weekly/monthly snapshots from Firebase Storage, restore), Users (list, soft-delete, restore via Admin SDK), System Actions (manual backup trigger, log viewer). Cron backups run daily/weekly/monthly via Vercel cron jobs.

## AI Workout Suggestions
- 3-tier pipeline: Logic Engine (periodization, fatigue, deload) → Groq LLaMA 3.3 70B enhancement → Validator with retry
- `src/lib/training/logicEngine.ts` — generates base plan from athlete profile + recent history
- `src/lib/training/constraints.ts` — defines `PlannedWorkout`, `EnhancedWorkout`, load constraints
- `src/lib/training/validator.ts` — validates AI modifications stay within bounds
- `src/app/api/ai/workout-suggestions/route.ts` — orchestrator API (max_tokens: 8000)
- `src/components/workouts/AIWorkoutSuggestions.tsx` — UI component, normalizes `specs` → flat type keys for form compatibility
- Flow: AI generates → user clicks "Use Workout" → data stored in sessionStorage → navigates to `/workouts/new?aiGenerated=true` → form pre-fills via `key` prop remount

## Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`) — Monday–Sunday week boundaries (ISO 8601). Per-sport stats with week-over-week comparison, highlight detection (longest/furthest workout), rating system. Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image). Uses `html-to-image` for card export.
- **Monthly Review** (`/review`) — Activity calendar, sport stats, pie chart breakdown, vs last month comparison, daily bar chart, weekly trend area charts. Gate prevents viewing current month until it ends.
- **Yearly Wrapped** (`/wrapped`) — 8-slide interactive carousel with guess game. Public sharing at `/athlete/[username]/wrapped` with SSR + OG images. Privacy-gated via `profilePublic` flag. Components in `src/components/wrapped/WrappedSlides.tsx`.
- **ShareButtons** component (`src/components/workouts/ShareWorkoutCard.tsx`) — Reusable share UI: Instagram Story, WhatsApp, X/Twitter, iMessage, save image (PNG via `html-to-image`), copy link. Used by wrap, review, wrapped, and workout sharing.
- **Email system** — Summary emails every 10 days via Brevo cron (`/api/cron/send-summaries`). Wrap email template at `src/lib/email/wrapTemplate.ts`.

## Authentication
- **Google Sign-In + Email/Password** via Firebase Auth
- **Server-side user creation** — `/api/auth/create-user/route.ts` uses Admin SDK to bypass Firestore security rules (client-side transactions fail on retry because `userMappings` rules only allow `create`, not `update`)
- **Username validation** — regex `/^[a-z0-9_]{3,20}$/`, 29 reserved words (admin, api, dashboard, etc.)
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
- **User scoping:** Subscriptions tracked by `localStorage` key `push_subscribed_username`. On user switch, previous user's subscription is removed from Firestore before subscribing new user. On logout, subscription is removed automatically.

## Strava Sync
- **Auto-sync** on page load via `useStravaAutoSync` hook — progressive phase-based sync (2days → 7days → 30days)
- **Quota-safe POST mode** — when tokens available, sends them in request body to avoid Firestore reads on server (bypasses Spark plan quota limits)
- **GET fallback** — reads tokens from Firestore, falls back to POST if quota hit (429)
- **Error safety** — `toErrorString()` helper in `stravaSyncStore.ts` prevents Firebase error objects `{code, message}` from leaking into React rendering (fixes React error #31)
- **Store:** `src/lib/stores/stravaSyncStore.ts` — Zustand store with `startSync`, `checkDuplicates`, `clearResult`
- **Hook:** `src/hooks/useStravaAutoSync.ts` — auto-triggers sync on mount, handles quota exhaustion gracefully
- **Import merge** — when syncing, matches Strava activities to imported workouts (`source: 'import'`) by same day + same type + distance within 10%. Updates imported workout with Strava data instead of creating duplicates. Strength workouts match by type+date alone (no distance).
- **Date fix:** Always use `activity.start_date_local` — NOT `start_date` (UTC timestamp causes wrong local time parsing, e.g. 5:30h offset for IST users).

## Calendar
- **Add Workout** button centered in CalendarHeader next to date label
- **Add Event** (via CalendarAddDropdown) — navigates to `/workouts/new?date=YYYY-MM-DD&tag=race`
- **Add Note** (via CalendarAddDropdown) — inline popup with textarea, saves as "other" type workout via `createWorkout()` with `tags: ['note']`, refreshes calendar via `onNoteAdded` callback
- **CalendarAddDropdown** — `src/components/calendar/CalendarAddDropdown.tsx`, uses `onNoteAdded` callback threaded through CalendarWeekView/CalendarFullMonthView to calendar page's `refreshWorkouts`
- **Notes filtering** — workouts tagged `tags: ['note']` (type `'other'`, name `'Note'`) are excluded from the `/workouts` page. Filter applied before time and type tabs.

## Workout Deletion
- **Delete planned workouts** — available on workouts list page for future uncompleted workouts
- **UI:** Trash icon appears on hover for planned workout rows, opens AlertDialog confirmation
- **Access control:** Only users who can manage workouts (coaches or unconnected athletes) see delete button
- **Function:** `deleteWorkout(ownerUsername, id)` in `src/lib/firebase/firestore.ts`
- **Optimistic update:** Removed from local state immediately on success

## Admin Dashboard
- **Route:** `src/app/admin/` — standalone layout (no dashboard chrome), password gate at `/admin`, dashboard at `/admin/dashboard`
- **Security:** `POST /api/admin/verify` checks `ADMIN_PASSWORD` env var, sets signed `httpOnly` cookie (4h, signed with `ADMIN_SECRET`)
- **Backup API:** `GET/POST /api/admin/backup`, `GET/POST /api/admin/backup/[id]` — list, create, restore snapshots from Firebase Storage
- **Users API:** `GET /api/admin/users`, `DELETE/PATCH /api/admin/users/[uid]` — list all users, soft-delete (disable Auth + set `deletedAt`), restore (re-enable)
- **Cron:** `src/app/api/cron/backup/route.ts` — accepts `?type=daily|weekly|monthly`, uploads JSON to Firebase Storage, prunes old backups
- **New env vars required:** `ADMIN_PASSWORD`, `ADMIN_SECRET`, `FIREBASE_STORAGE_BUCKET`

## Known Issues & Active Work
- Strava webhook subscription needs proper registration (webhook code exists but auto-sync requires env vars + API call setup)
- Coaches should NOT be able to complete workouts (student-only action) — needs guard
- "Save as Template" feature navigates to non-existent page — broken
- Custom domain (thedailyathlete.in) has DNS/NXDOMAIN issues — likely Squarespace registration problem
- Groq rate limits (100K tokens/day on 70B model) — mitigated with 8B fallback but can still hit both limits

## Code Style
- Prefer functional components with hooks
- Use `async/await` over `.then()` chains
- Descriptive variable names, no abbreviations
- Keep components focused — extract logic to hooks or utils when > 150 lines
- API routes use standard Next.js App Router conventions (`route.ts`)
- Always handle loading and error states in UI components

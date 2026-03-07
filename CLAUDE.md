# CoachTrack - CLAUDE.md

## Project Overview
CoachTrack (The Daily Athlete) is a SaaS workout tracking platform connecting coaches with athletes via unique 6-letter codes. Built with Next.js 16 (App Router), React 19, TypeScript 5.9, Firebase, and deployed on Vercel.

## Tech Stack
- **Framework:** Next.js 16 with App Router, React 19, TypeScript 5.9
- **Database:** Firestore (Firebase)
- **Auth:** Firebase Auth (email/password + Google Sign-In)
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix primitives
- **State:** Zustand stores (`src/lib/stores/`)
- **AI:** Groq SDK + OpenAI SDK for workout suggestions and reports
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
│   ├── api/             # API routes (ai, auth, cron, reports, strava, webhooks, workouts)
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
- **users** — uid, email, displayName, username (unique), role (`coach`|`athlete`), coachId, coachCode (6-letter), Strava tokens, photoURL, bio, ageRange, experienceLevel, height/weight, sportPreferences, trainingFor, events (goal + eventName + eventDate), profileTagline, profilePublic
- **workouts** — Multi-sport (swim/run/bike/strength/other), assigned coach→athlete, completion tracking, Strava sync, comments subcollection
- **personalRecords** — User PRs with history
- **chatThreads** — AI coach conversation threads

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
- **Safe Areas:** Navbar uses `pt-[env(safe-area-inset-top)]`, MobileBottomNav uses `pb-[env(safe-area-inset-bottom)]`. Dashboard layout uses `overflow-x-hidden` (not `overflow-hidden` which breaks `position: sticky`).

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
- Onboarding flow at `/onboarding/profile` — 3 steps: Sports, Goals (with event name/date), About You

## Page Architecture
- `/` — Landing page: centered hero ("Your training, all in one place"), sport pills, how-it-works steps, 6-card features grid (Strava Sync, Visual Calendar, Progress Tracking, AI Coach, Multi-Sport, Email Reminders), FAQ, CTA. Dark theme, simplified design.
- `/profile` — Read-only public-style profile view (stats, pie chart, recent workouts, PRs). "Edit Profile" links to `/settings`
- `/settings` — Full profile edit form (name, bio, timezone, age, experience, height/weight, sports, training goals with event name/date), Strava integration, public profile toggle, account management
- `/workouts` — Compact header, AI Workout Suggestions collapsed by default behind slim trigger bar (expandable), time filter tabs (Planned/Past/All), horizontal type filter tags (All/Run/Bike/Swim/Strength/Other), compact single-row workout list with Garmin-style stat chips (HR, elevation, calories, pace, power). Neutral/orange color scheme (no red).
- `/workouts/new` — Create workout form with type-specific sub-forms, supports AI-generated templates (via sessionStorage) and saved templates. Preview dialog before creation.
- `/athlete/[username]` — Public athlete profile (SSR), shares components with `/profile` via ProfileComponents.tsx
- `/onboarding/profile` — 3-step onboarding: pick sports → pick goals (with event details) → about you (age, experience, height, weight)
- `/calendar` — Multi-view calendar (day/week/month/year). Week view: 7-day grid with color-coded workout pills, weekly summary bar. Month view: full month grid with activity dots. Year view: heatmap-style activity density. Supports coach athlete picker, ICS export, email report. Components in `src/components/calendar/`.
- `/wrap` — Weekly Training Wrap ("Your Week's Capsule"). Immersive full-screen layout with week-by-week navigation. Per-sport stats with week-over-week comparison (% change), highlight of the week (longest/furthest workout with photo), rating system (incredible/solid/consistent/recovery/quiet). Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image).
- `/review` — Monthly Review page. Month navigation with "not ready" gate for current month. Hero row with key stats (workouts, distance, time, active days). Activity calendar grid, per-sport stats with month-over-month comparison, pie chart breakdown, vs last month comparison (% change per metric), daily activity bar chart, weekly distance + duration area charts. Share via ShareButtons.
- `/wrapped` — Yearly Wrapped (2025). 8-slide interactive carousel: guess (interactive workout count guess game) → reveal → stats → breakdown → records → heatmap → summary → final. Public sharing route at `/athlete/[username]/wrapped` with SSR, OG images, privacy gate. Components in `src/components/wrapped/WrappedSlides.tsx`.
- `/dashboard` — Stats row (streak, this week, all-time, total), weekly activity bar chart, type breakdown, upcoming workouts, recently completed, event countdowns, weekly wrap CTA, monthly review CTA, quick links grid

## AI Workout Suggestions
- 3-tier pipeline: Logic Engine (periodization, fatigue, deload) → Groq LLaMA 3.3 70B enhancement → Validator with retry
- `src/lib/training/logicEngine.ts` — generates base plan from athlete profile + recent history
- `src/lib/training/constraints.ts` — defines `PlannedWorkout`, `EnhancedWorkout`, load constraints
- `src/lib/training/validator.ts` — validates AI modifications stay within bounds
- `src/app/api/ai/workout-suggestions/route.ts` — orchestrator API (max_tokens: 8000)
- `src/components/workouts/AIWorkoutSuggestions.tsx` — UI component, normalizes `specs` → flat type keys for form compatibility
- Flow: AI generates → user clicks "Use Workout" → data stored in sessionStorage → navigates to `/workouts/new?aiGenerated=true` → form pre-fills via `key` prop remount

## Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`) — Per-sport stats with week-over-week comparison, highlight detection (longest/furthest workout), rating system. Share via ShareButtons (Instagram, WhatsApp, X, iMessage, save image). Uses `html-to-image` for card export.
- **Monthly Review** (`/review`) — Activity calendar, sport stats, pie chart breakdown, vs last month comparison, daily bar chart, weekly trend area charts. Gate prevents viewing current month until it ends.
- **Yearly Wrapped** (`/wrapped`) — 8-slide interactive carousel with guess game. Public sharing at `/athlete/[username]/wrapped` with SSR + OG images. Privacy-gated via `profilePublic` flag. Components in `src/components/wrapped/WrappedSlides.tsx`.
- **ShareButtons** component (`src/components/workouts/ShareWorkoutCard.tsx`) — Reusable share UI: Instagram Story, WhatsApp, X/Twitter, iMessage, save image (PNG via `html-to-image`), copy link. Used by wrap, review, wrapped, and workout sharing.
- **Email system** — Summary emails every 10 days via Brevo cron (`/api/cron/send-summaries`). Wrap email template at `src/lib/email/wrapTemplate.ts`.

## Known Issues & Active Work
- Strava webhook subscription needs proper registration (webhook code exists but auto-sync requires env vars + API call setup)
- Coaches should NOT be able to complete workouts (student-only action) — needs guard
- "Save as Template" feature navigates to non-existent page — broken
- Custom domain (thedailyathlete.in) has DNS/NXDOMAIN issues — likely Squarespace registration problem

## Code Style
- Prefer functional components with hooks
- Use `async/await` over `.then()` chains
- Descriptive variable names, no abbreviations
- Keep components focused — extract logic to hooks or utils when > 150 lines
- API routes use standard Next.js App Router conventions (`route.ts`)
- Always handle loading and error states in UI components

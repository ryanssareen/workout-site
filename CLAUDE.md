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
│   ├── (dashboard)/     # Protected routes: dashboard, workouts, calendar, reports, settings, ai-coach, progress, records, profile, onboarding
│   ├── athlete/[username]/ # Public athlete profile page (SSR)
│   ├── api/             # API routes (ai, auth, cron, reports, strava, webhooks, workouts)
│   └── page.tsx         # Landing page
├── components/
│   ├── auth/            # LoginForm, RegisterForm (Google + email)
│   ├── calendar/        # Calendar views, workout type config (TYPE_CONFIG, getTypeData)
│   ├── dashboard/       # Navbar, layout components, ProfileCompletionBar
│   ├── profile/         # ProfileComponents (shared PieChart, StatCard, helpers), PhotoUpload
│   ├── reports/         # ReportContainer, ReportRenderer, section components
│   ├── strava/          # DuplicateDialog for Strava sync conflicts
│   ├── workouts/        # WorkoutCard, WorkoutForm, AIWorkoutSuggestions, StrengthForm, comments, ShareWorkoutCard
│   └── ui/              # shadcn/ui primitives
├── lib/
│   ├── analytics.ts     # computeSummary, computeTypeDistribution for workout stats
│   ├── firebase/        # config.ts, auth.ts, firestore.ts, admin.ts
│   ├── email/           # Email templates and sending
│   ├── schemas/         # Zod validation schemas (profile.ts has SPORT_OPTIONS, TRAINING_FOR_OPTIONS, etc.)
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
- `/profile` — Read-only public-style profile view (stats, pie chart, recent workouts, PRs). "Edit Profile" links to `/settings`
- `/settings` — Full profile edit form (name, bio, timezone, age, experience, height/weight, sports, training goals with event name/date), Strava integration, public profile toggle, account management
- `/workouts` — Flat list of all workouts with horizontal type filter tags (All/Run/Bike/Swim/Strength/Other), compact single-row per workout
- `/athlete/[username]` — Public athlete profile (SSR), shares components with `/profile` via ProfileComponents.tsx
- `/onboarding/profile` — 3-step onboarding: pick sports → pick goals (with event details) → about you (age, experience, height, weight)
- `/calendar` — Calendar view with workout type differentiation, 2-week desktop view

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

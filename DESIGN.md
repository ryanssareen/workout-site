# The Daily Athlete (CoachTrack) — Complete Design Document

## Project Overview

**The Daily Athlete** is a SaaS workout tracking platform for self-coached endurance athletes. Athletes plan, track, and analyze training across multiple sports. A backend-managed coach-athlete system supports rsareen@gmail.com as the sole coach with hardcoded athlete connections. The platform integrates with Strava for automatic workout sync and uses AI for intelligent tagging and suggestions.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, App Router, React 19, TypeScript 5.9 |
| Database | Firestore (Firebase) |
| Auth | Firebase Auth (email/password + Google Sign-In) |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI primitives |
| State | Zustand (`src/lib/stores/authStore.ts`) |
| AI | Groq SDK (LLaMA 3.3 70B) for tagging/comments, OpenAI SDK for reports/suggestions |
| Email | Brevo SMTP for transactional, Nodemailer (Gmail) for cron |
| Integrations | Strava API (OAuth 2.0 + webhooks) |
| Charts | Recharts |
| Maps | Leaflet (route visualization) |
| Deploy | Vercel (env vars stored there, no local .env) |

---

## Architecture

### Directory Structure

```
src/
├── app/
│   ├── (auth)/                  # Public auth pages
│   │   ├── login/               # Login page
│   │   ├── register/            # Registration page
│   │   ├── reset-password/      # Password reset
│   │   └── reset-password/confirm/
│   ├── (dashboard)/             # Protected pages (requires auth)
│   │   ├── dashboard/           # Main hub with stats
│   │   ├── workouts/            # Workout list + CRUD
│   │   │   ├── new/             # Create workout form
│   │   │   ├── [id]/            # Workout detail view
│   │   │   └── [id]/edit/       # Edit workout
│   │   ├── calendar/            # Weekly calendar view
│   │   ├── reports/             # Analytics dashboard
│   │   ├── profile/             # User profile + edit
│   │   ├── settings/            # Strava connection, account
│   │   ├── onboarding/          # 7-step onboarding flow
│   │   ├── suggestions/         # AI workout suggestions page
│   │   └── coach-suggestions/   # Coach-specific AI suggestions
│   ├── api/                     # ~45 API routes
│   │   ├── ai/                  # AI: chat, suggestions, reports, tagging, profanity
│   │   ├── auth/strava/         # Strava OAuth (authorize, callback, disconnect)
│   │   ├── strava/              # Sync, webhook, cleanup, migration
│   │   ├── workouts/            # Workout CRUD + copy + format + dedup
│   │   ├── cron/                # send-reminders, send-summaries
│   │   ├── import/              # CSV analyze, remap, confirm
│   │   ├── reports/             # Report generation + email
│   │   ├── notifications/       # Comment notifications
│   │   └── admin/               # assign-athletes
│   ├── workout/[id]/            # Public workout preview (no auth)
│   ├── preview/[id]/            # Shareable workout preview (no auth)
│   ├── features/                # Marketing features page
│   └── contact/                 # Contact page
├── components/
│   ├── auth/                    # LoginForm, RegisterForm
│   ├── dashboard/               # Navbar, stats cards, ProgressRing, StudentOverview
│   ├── workouts/                # WorkoutCard, WorkoutForm, sport-specific forms
│   │   ├── comments/            # Comment listing, form, threading
│   │   ├── SwimForm.tsx         # Swim-specific fields
│   │   ├── BikeForm.tsx         # Bike-specific fields
│   │   ├── RunForm.tsx          # Run-specific fields
│   │   ├── StrengthForm.tsx     # Strength exercises
│   │   ├── OtherForm.tsx        # Generic workout
│   │   ├── WorkoutPhotos.tsx    # Photo gallery + lightbox
│   │   ├── RouteMap.tsx         # Leaflet map for Strava routes
│   │   ├── MiniRoutePreview.tsx # Thumbnail route preview
│   │   ├── ShareWorkoutCard.tsx # Social sharing card + image export
│   │   └── CompletionDialog.tsx # Complete/uncomplete modals
│   ├── reports/                 # Report sections, charts, tables
│   ├── onboarding/              # FileUploadStep, ImportPreview
│   ├── strava/                  # DuplicateDialog
│   ├── ai/                      # WorkoutRecommendations
│   └── ui/                      # shadcn/ui primitives
├── lib/
│   ├── firebase/
│   │   ├── config.ts            # getAuthInstance(), getDbInstance()
│   │   ├── auth.ts              # createUser, signIn, signOut, signInWithGoogle, getUserProfile
│   │   ├── firestore.ts         # All Firestore CRUD operations
│   │   └── admin.ts             # Firebase Admin SDK (API routes only)
│   ├── schemas/
│   │   ├── workout.ts           # Zod schemas for workout validation
│   │   └── profile.ts           # Zod schemas for profile
│   ├── stores/
│   │   └── authStore.ts         # Zustand auth state
│   ├── email/                   # Email templates (summary, reminder)
│   ├── import/                  # CSV parsing, column mapping, enrichment
│   ├── training/                # Training logic engines
│   ├── groq-dedup.ts            # Groq-powered deduplication pipeline
│   └── utils.ts                 # cn() utility
└── types/
    ├── index.ts                 # User, Workout, WorkoutComment, PersonalRecord, etc.
    ├── workout.ts               # SwimData, BikeData, RunData, StrengthData, WorkoutTag
    ├── reports.ts               # Report section types
    └── ai.ts                    # AI feature types
```

---

## Data Model (Firestore)

### `users` Collection

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  role: 'coach' | 'athlete' | 'student'; // 'student' is legacy → use 'athlete'
  photoURL?: string;                      // Google profile photo
  coachId?: string;                       // UID of assigned coach
  coachCode?: string;                     // Legacy 6-letter code (no longer generated)
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Profile
  bio?: string;
  timezone?: string;
  sportPreferences?: string[];            // ['Running', 'Cycling', 'Swimming', 'Strength Training']
  trainingFor?: string[];                 // ['Marathon', 'Ironman', etc.]
  events?: Array<{ goal: string; eventName: string; eventDate?: string }>;
  experienceLevel?: string;               // beginner | intermediate | advanced | elite
  height?: number;                        // in cm
  heightUnit?: 'cm' | 'ft';
  weight?: number;                        // in kg
  weightUnit?: 'kg' | 'lbs';

  // Strava
  stravaId?: string;
  stravaAccessToken?: string;
  stravaRefreshToken?: string;
  stravaTokenExpiresAt?: number;
  stravaConnectedAt?: Timestamp;

  // Notifications
  notificationPreferences?: {
    emailSummary: boolean;
    workoutReminders: boolean;
    coachMessages: boolean;
  };

  // Onboarding
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  profileCompleted?: number;              // 0-100 completion percentage

  // Email tracking
  lastSummaryDate?: Timestamp;
}
```

### `workouts` Collection

```typescript
{
  id: string;
  name: string;
  type: 'swim' | 'run' | 'bike' | 'strength' | 'other';
  description?: string;
  date: Timestamp;
  duration?: number;                      // minutes
  tags?: WorkoutTag[];                    // max 5 from predefined set
  createdBy: string;                      // coach UID
  assignedTo: string;                     // athlete UID
  assignedToName?: string;                // athlete display name (for coach view)
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Type-specific data (one per workout)
  swim?: {
    distance: number;
    distanceUnit: 'meters' | 'yards';
    time: number;
    strokes?: number;
    strokeType?: string;
    poolLength?: number;
  };
  run?: {
    distance: number;
    distanceUnit: 'km' | 'miles';
    time: number;
    pace?: string;
    elevationGain?: number;
    terrain?: string;                     // road | trail | track | treadmill
    avgHeartRate?: number;
  };
  bike?: {
    distance: number;
    distanceUnit: 'km' | 'miles';
    time: number;
    avgPower?: number;
    avgCadence?: number;
    elevationGain?: number;
    avgHeartRate?: number;
  };
  strength?: {
    exercises: Array<{
      name: string;
      sets: number;
      reps: number;
      weight?: number;
      weightUnit?: 'kg' | 'lbs';
      restSeconds?: number;
      notes?: string;
    }>;
    totalTime?: number;
    rpe?: number;                         // 1-10 scale
  };
  other?: {
    description: string;
    duration?: number;
    notes?: string;
  };

  // Strava integration
  source?: 'manual' | 'strava' | 'import';
  stravaActivityId?: string;
  stravaData?: {
    distance?: number;
    time?: number;
    elevationGain?: number;
    avgPower?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
  };
  actualStats?: {
    distance?: number;                    // meters
    duration?: number;                    // seconds
    calories?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgSpeed?: number;                    // m/s
    maxSpeed?: number;
    elevationGain?: number;              // meters
  };
  routeData?: {
    polyline?: string;                    // Encoded polyline from Strava
    startLatLng?: [number, number];
    endLatLng?: [number, number];
    aiComment?: string;                   // AI-generated location comment
  };
  photos?: string[];                      // Strava photo URLs

  // Completion
  completedAt?: Timestamp;
  completionStatus?: 'pending' | 'completed' | 'skipped';
  completedBy?: 'manual' | 'strava';
  completedLate?: boolean;
  completionNotes?: string;
  rating?: number;
  feedback?: string;
  prs?: Array<{
    exerciseName: string;
    previousValue: number;
    newValue: number;
    unit: string;
  }>;

  // Recurring
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';

  // Tracking
  reminderSent?: boolean;
  templateId?: string;
}
```

### `workoutComments` (subcollection or top-level)

```typescript
{
  id: string;
  workoutId: string;
  userId: string;
  userRole: 'coach' | 'athlete' | 'student';
  userName: string;
  text: string;
  rating?: 'too_easy' | 'just_right' | 'too_hard';
  createdAt: Timestamp;
  parentCommentId?: string;               // threading support
  isCoachReply?: boolean;
}
```

### `personalRecords` Collection

```typescript
{
  id: string;
  userId: string;
  category: 'distance' | 'speed' | 'strength' | 'endurance';
  name: string;                           // e.g., "Fastest 5K", "Heaviest Squat"
  value: number;
  unit: string;
  date: Timestamp;
  workoutId?: string;
  stravaActivityId?: string;
  notes?: string;
  previousValue?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `chatThreads` Collection

```typescript
{
  id: string;
  userId: string;
  topic?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Timestamp;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Workout Tags

12 predefined tags (max 5 per workout):

| Tag | Color |
|-----|-------|
| easy | Green |
| moderate | Yellow |
| hard | Red |
| recovery | Blue |
| speed | Orange |
| endurance | Purple |
| intervals | Pink |
| tempo | Indigo |
| long | Cyan |
| strength | Amber |
| technique | Teal |
| race | Rose |

---

## Pages & Features

### Landing Page (`/`)

- Navigation bar with branding + Login/Register buttons
- Hero: "OWN YOUR DAY. EVERY DAY." with animated workout card stack
- Sports strip: Swimming, Running, Cycling, Ironman
- Benefits grid (6 cards): Smartphone, Activity, CheckCircle2, TrendingUp, Calendar, Target
- How It Works (3 steps): Create Account → Connect Gear → Train & Track
- Strava integration callout
- FAQ accordion (4 questions)
- Final CTA + footer
- Dark theme: black background, red (#ef4444) accent

### Auth

**Login** (`/login`)
- Email/password form with "Remember me" option
- Google Sign-In button
- Redirect to `/dashboard` on success, `/onboarding` if incomplete

**Register** (`/register`)
- Email, password (min 6 chars), display name
- Name validated via `/api/ai/profanity-check`
- Google Sign-In alternative
- All new users registered as `'athlete'` role
- Redirect to `/onboarding` after signup

### Onboarding (`/onboarding`) — 7 Steps

1. **Intro** — Welcome splash
2. **Name** — Display name with profanity check
3. **Sports** — Multi-select: Running, Cycling, Swimming, Strength Training
4. **Goals** — Multi-select from 14 options (Hyrox, Ironman, Marathon, Half Marathon, Triathlon, Spartan Race, CrossFit, Ultra Marathon, 5K/10K, Century Ride, Open Water Swim, Powerlifting, General Fitness, Other) + optional event name/date
5. **Experience** — Single select: Beginner, Intermediate, Advanced, Elite
6. **Body Metrics** — Height (cm or ft/in), Weight (kg or lbs) with unit toggles
7. **Import** — Optional CSV/spreadsheet upload via FileUploadStep + ImportPreview

Progress dots, back/continue navigation, animated transitions between steps.

### Dashboard (`/dashboard`)

- **Profile completion CTA** — Progress bar, links to finish setup (shown when < 100%)
- **Hero header** — Time-based greeting, this week's summary, "New Workout" button
- **Stats grid** (4 cards):
  - Streak (consecutive completed workout days)
  - This Week (X/Y completed)
  - All-Time (total completed)
  - Completion Rate (circular progress ring)
- **Weekly chart** (left 3 cols) — Bar chart Mon-Sun showing completed vs pending, today highlighted
- **Type breakdown** (right 2 cols) — Distribution by sport type with color-coded bars
- **Upcoming workouts** — Pending workouts sorted by date with quick-complete
- **Recently completed** — Latest 3 with checkmark indicators
- **Upcoming events** — Countdown timers with color-coded urgency (red <14d, orange <30d, gray >30d)
- **Quick links** — Calendar, Reports, Profile, Workouts buttons

### Workouts (`/workouts`)

**Main View:** 5 category cards (Swim, Run, Bike, Strength, Other) showing workout counts per type.

**Category View:** Filtered workout list with WorkoutCard components. Each card shows:
- Name, date, duration, type badge
- Tags (color-coded)
- Description (3-line clamp)
- Planned stats summary
- Status badges (Done/Late/Missed/Upcoming/Strava/Route)
- Actual stats from Strava (if available)
- Mini route preview (if GPS data exists)
- Strava photos (compact thumbnails)
- Action buttons: Complete, Edit, Delete

**Create Workout** (`/workouts/new`):
1. WorkoutForm with type-specific sub-forms (SwimForm, RunForm, BikeForm, StrengthForm, OtherForm)
2. WorkoutPreviewDialog shows preview before creation
3. On confirm: creates workout in Firestore
4. If coach assigning to athlete: optional email notification via Brevo with preview link
5. Supports recurring workouts (daily/weekly/biweekly/monthly with end date)
6. Supports AI-generated workout templates and saved templates

**Workout Detail** (`/workouts/[id]`):
- Full workout info with date, duration, type, tags
- Strava stats section (distance, time, calories, HR)
- Route map (Leaflet, if polyline exists)
- Strava photos gallery with lightbox
- Share card (WhatsApp, Twitter, iMessage, download PNG, copy link, native share)
- Description
- Completion notes
- Complete/uncomplete button (athletes only, coaches see disabled tooltip)
- AI Recommendations section
- Comment section with threading + ratings
- Save as Template dialog

### Calendar (`/calendar`)

- Week navigation (prev/next + "Today" button) with date range display
- Type filters (Run, Bike, Swim, Strength, Other)
- Athlete picker dropdown (coaches only)
- Export ICS + email report buttons
- Weekly summary bar: completion %, completed/total, total time, total distance, type breakdown
- 7-day grid (full viewport height):
  - Day headers (highlight today in red)
  - Per-day: completion stats, scrollable workout cards
  - Garmin-style cards: 3px left border (type color), emoji + name + type badge, 2x2 stats grid, status badge
  - Rest days show leaf emoji
  - Click to view details, toggle complete

### Reports (`/reports`)

6-tab navigation (mobile: horizontal scroll pills, desktop: sticky sidebar):
1. **Dashboard Overview** — Key metrics summary
2. **Training Analysis** — Volume, intensity, frequency analysis with charts
3. **Exercise Insights** — Strength exercise breakdowns, PRs, volume tracking
4. **Calendar Views** — Heatmap-style calendar visualization
5. **Type Distribution** — Pie/donut charts for sport breakdown
6. **Duplicates** — DuplicateRemover component to find/merge duplicate workouts

Share Reports button with modal. Time-aware greeting.

### Profile (`/profile`)

**View Mode:**
- Avatar with circular progress ring
- Display name, email, timezone, role badge, bio
- Completion checklist (if < 100%)
- Info cards: Sports, Training For + events, Experience & Body, Notifications

**Edit Dialog:**
- Name (with profanity check), Bio, Timezone dropdown
- Sport preferences (multi-select badges)
- Training goals (multi-select + event details)
- Notification toggles

### Settings (`/settings`)

- Profile card (name, email, role badge)
- Strava integration:
  - Connect/disconnect buttons
  - Manual sync with duplicate detection dialog
  - Auto-sync status indicator
  - Link to Garmin-Strava connection guide
- Account: Change password link, Sign out button

### Preview Routes

**`/workout/[id]`** — Public workout preview (existing, uses WorkoutPreview component):
- No auth required, server-rendered
- OpenGraph/Twitter card metadata
- Workout details, stats, tags, photos
- CTA: "Add to My Workouts" (logged in) or "Sign Up" (not logged in)

**`/preview/[id]`** — Shareable workout preview (new):
- No auth required, server-rendered
- Hero photo from Strava (if available) with gradient overlay
- Coach name display
- Full sport-specific details (pace, power, exercises, etc.)
- AI route comment
- OpenGraph/Twitter card metadata with emoji titles
- CTA: "Add to My Workouts" or "Sign Up"
- Used in email notifications ("View Workout" links to this)

### Other Public Pages

- **`/features`** — Marketing page: 3 pillars, 12-feature grid, workout tags showcase, How It Works
- **`/contact`** — Contact hub: 2 email cards + GitHub link

---

## API Routes

### Authentication
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/strava/authorize` | GET | Initiate Strava OAuth redirect |
| `/api/auth/strava/callback` | GET | Handle OAuth callback, store tokens |
| `/api/auth/strava/disconnect` | POST | Remove Strava connection |
| `/api/reset-password` | POST | Initiate password reset |
| `/api/send-reset-email` | POST | Send reset email |

### Workouts
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/workouts` | GET/POST | List user's workouts / Create workout |
| `/api/workouts/[id]` | GET/PUT/DELETE | Single workout CRUD |
| `/api/workouts/copy` | POST | Copy public workout to user's list |
| `/api/workouts/format` | POST | Format/standardize workout data |
| `/api/workouts/auto-dedup` | POST | Automatic deduplication |

### Strava
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/strava/sync` | GET | Full sync — fetches activities, AI tags, dedup |
| `/api/strava/webhook-subscription` | GET/POST | Register/list webhook subscriptions |
| `/api/strava/webhook-status` | GET | Check webhook registration status |
| `/api/strava/cleanup` | POST | Cleanup/dedup Strava data |
| `/api/strava/migrate-routes` | POST | Backfill route polylines for old imports |
| `/api/strava/migrate-photos` | POST | Backfill photos for existing Strava workouts |
| `/api/strava/test-match` | GET | Test activity-to-workout matching |

### AI
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/profanity-check` | POST | Validate names/text for inappropriate content |
| `/api/ai/suggestions` | POST | Generate workout suggestions (OpenAI) |
| `/api/ai/workout-suggestions` | POST | AI-based workout generation |
| `/api/ai/reports` | POST | AI-generated training reports (OpenAI) |
| `/api/ai/chat` | POST | Chat with AI coach |
| `/api/ai/generate-plan` | POST | Generate multi-week training plans |
| `/api/ai/format-workouts` | POST | Format imported workout descriptions |
| `/api/ai/route-comment` | POST | Generate fun location comments (Groq) |

### Email & Notifications
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/send-workout-email` | POST | Send workout assignment email via Brevo |
| `/api/cron/send-reminders` | GET | Daily cron: send next-day workout reminders |
| `/api/cron/send-summaries` | GET | Weekly cron: send training summary emails |
| `/api/reports/send` | POST | Email weekly report |
| `/api/reports/email` | POST | Generate and email report |
| `/api/notifications/workout-comment` | POST | Email notification when comment posted |

### Import
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/import/analyze` | POST | Parse CSV/Excel, detect columns |
| `/api/import/remap` | POST | Map imported fields to standard format |
| `/api/import/confirm` | POST | Insert imported workouts into Firestore |

### Admin
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/assign-athletes` | POST | Manually assign athletes to coaches |

---

## Coach-Athlete System

Coach-athlete connections are **backend-managed only**. No UI exists for connecting via codes.

**How it works:**
- `rsareen@gmail.com` is the sole coach, hardcoded in `src/lib/firebase/auth.ts`
- Athletes `rsareen+hetal@gmail.com`, `rsareen+rohin@gmail.com`, `rsareen+rupesh@gmail.com` are auto-connected
- On `getUserProfile()`, rsareen@gmail.com is auto-promoted to `'coach'` role
- On `getUserProfile()`, matching athletes get `coachId` set to the coach's UID
- On `signInWithGoogle()`, new users matching these emails are auto-connected
- Coach code generation has been removed from registration flow
- No UI allows athletes to enter coach codes or connect to coaches

**Role-Based Access:**
- **Coaches:** Create/assign workouts, view all athletes' data, generate reports, calendar athlete picker
- **Athletes:** View/complete own workouts, see own progress, create self-workouts (if no coach)
- **Unconnected athletes** (no coachId): Can create their own workouts

---

## Strava Integration

### OAuth Flow
1. User clicks "Connect Strava" → `/api/auth/strava/authorize?userId=...`
2. Redirect to Strava with scopes: `read,activity:read_all`
3. Strava callback → `/api/auth/strava/callback` stores tokens in user doc
4. Redirect back to `/settings?strava=connected`

### Sync Flow (`/api/strava/sync`)
1. Refresh token if expired
2. Fetch activities from last year (`/athlete/activities?after=...&per_page=200`)
3. Filter out already-imported activities (by `stravaActivityId`)
4. For each new activity:
   - Map Strava type → app type (Run/Ride/Swim/WeightTraining → run/bike/swim/strength)
   - Extract stats: distance, duration, calories, HR, speed, elevation
   - Extract route: polyline, start/end coordinates
   - Fetch photos if `total_photo_count > 0` (via `/activities/{id}/photos?size=600`)
   - Generate AI tags + location comment via Groq (LLaMA 3.3 70B)
   - Auto-merge with matching coach-assigned workout (same day, same type, not completed)
   - Or create new workout document
   - Proximity duplicate detection (within 30 min, similar duration/distance)
5. Run Groq dedup pipeline post-sync
6. Return summary (created, merged, skipped counts)

### Duplicate Detection
- By `stravaActivityId` (exact match)
- By name (normalized comparison)
- By proximity (±30 min, similar duration/distance)
- Interactive dialog for user decisions (merge vs create new)
- Post-sync Groq AI dedup pipeline

### Photo Support
- Strava API provides photos via `/activities/{id}/photos?size=600&photo_sources=true`
- Photos fetched during sync for activities with `total_photo_count > 0`
- Stored as `photos: string[]` on workout document
- Migration endpoint: `POST /api/strava/migrate-photos` for existing workouts
- Displayed in WorkoutCard (compact thumbnails), detail page (gallery), preview pages

---

## AI Features

### Groq (LLaMA 3.3 70B)
- **Workout tagging:** Analyzes activity name, type, distance, duration, pace, HR, elevation, location, terrain → assigns 1-3 tags
- **Route comments:** Generates playful 1-sentence location-based comments with emoji
- **Profanity check:** Validates display names and comments
- **Deduplication:** AI-powered duplicate detection pipeline
- **Format assistance:** Cleans up imported workout descriptions

### OpenAI
- **Workout suggestions:** Personalized recommendations based on history, goals, experience
- **Training reports:** AI-generated weekly/monthly training analysis with insights
- **Chat:** Interactive AI coach conversation

---

## Email System

### Transactional (Brevo SMTP)
- **Workout assignment:** Sent when coach assigns workout to athlete
  - Dark-themed HTML email with workout card
  - CTA: "View Workout" → `/preview/{workoutId}`
- **Comment notifications:** Triggered when someone comments on a workout

### Cron Jobs
- **Daily reminders** (`/api/cron/send-reminders`): Reminds athletes of next-day workouts
  - Tracks `reminderSent` flag to avoid duplicates
- **Weekly summaries** (`/api/cron/send-summaries`): Training week recap
  - Completion rate, workout breakdown, distance/time totals
  - Motivational message based on performance

---

## Import System

1. **Upload:** CSV, .xlsx, .xls via drag-and-drop (FileUploadStep)
2. **Analyze** (`/api/import/analyze`): AI-powered column detection and mapping
3. **Remap** (`/api/import/remap`): User can adjust column assignments
4. **Preview** (ImportPreview): Review data before confirming
5. **Confirm** (`/api/import/confirm`): Bulk insert into Firestore
6. **Auto-tagging:** Groq AI tags imported workouts

---

## State Management

### Zustand Auth Store (`src/lib/stores/authStore.ts`)

```typescript
interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;  // Sets up Firebase onAuthChange listener
}
```

- Auto-initializes on app load
- Listens to Firebase auth state changes
- Fetches user profile from Firestore on auth change
- Handles dynamic Firebase imports (prevents SSR issues)

---

## Zod Schemas

### `src/lib/schemas/workout.ts`
- `swimDataSchema`, `bikeDataSchema`, `runDataSchema`
- `strengthExerciseSchema`, `strengthDataSchema`
- `otherDataSchema`
- `workoutSchema` — Main schema with type-based refinements
- `RECURRING_FREQUENCIES` — `['daily', 'weekly', 'biweekly', 'monthly']`

### `src/lib/schemas/profile.ts`
- `SPORT_OPTIONS` — `['Running', 'Cycling', 'Swimming', 'Strength Training']`
- `TRAINING_FOR_OPTIONS` — 14 options (Hyrox, Ironman, Marathon, etc.)
- `profileSchema`

---

## Key Conventions

- `@/` path alias for imports from `src/`
- Firebase instances via `getAuthInstance()`, `getDbInstance()` from `config.ts`
- Admin SDK only in API routes (`src/lib/firebase/admin.ts`)
- All dates stored as Firestore `Timestamp`, converted with `date-fns` for display
- Toast notifications via `sonner`
- Form handling: `react-hook-form` + `zod`
- Role `'student'` is legacy → always use `'athlete'` for new code
- Environment variables on Vercel only (never committed)

---

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config (6 vars) |
| `FIREBASE_ADMIN_SDK_KEY` | Admin SDK credentials (JSON) |
| `STRAVA_CLIENT_ID` | Strava OAuth client ID |
| `STRAVA_CLIENT_SECRET` | Strava OAuth secret |
| `GROQ_API_KEY` | Groq LLaMA API access |
| `OPENAI_API_KEY` | OpenAI API access |
| `GMAIL_USER` | Gmail SMTP username |
| `GMAIL_PASSWORD` | Gmail app password |
| `BREVO_API_KEY` | Brevo email service |
| `NEXT_PUBLIC_APP_URL` | App base URL |
| `ADMIN_SECRET` | Admin endpoint auth |

---

## Known Issues

1. **Strava webhook** — Code exists but auto-registration requires manual env setup
2. **Save as Template** — Navigates to non-existent `/templates` page (broken)
3. **Custom domain** — `thedailyathlete.in` has DNS/NXDOMAIN issues (Squarespace)
4. **Legacy 'student' role** — Still appears in some type definitions and old data

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
| AI | Groq SDK (LLaMA 3.3 70B + 8B instant fallback) for tagging/comments/import, OpenAI SDK for reports/suggestions |
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
│   │   ├── profile/             # Read-only profile (stats, charts, PRs)
│   │   ├── settings/            # Profile editing, Strava, account settings
│   │   ├── onboarding/          # 3-step onboarding flow (sports, goals, about)
│   │   ├── ai-coach/            # AI coach chat
│   │   ├── progress/            # Progress tracking
│   │   └── records/             # Personal records
│   ├── athlete/[username]/      # Public athlete profile page (SSR)
│   ├── api/                     # ~45 API routes
│   │   ├── ai/                  # AI: chat, suggestions, reports, tagging, profanity
│   │   ├── auth/                # User creation (Admin SDK), Strava OAuth (authorize, callback, disconnect)
│   │   ├── strava/              # Sync, webhook, cleanup, migration
│   │   ├── workouts/            # Workout CRUD + copy + format + dedup
│   │   ├── cron/                # send-reminders, send-summaries
│   │   ├── workouts/            # Workout CRUD + import (CSV/XLSX with AI + programmatic date detection)
│   │   ├── push/                # Web Push notification subscribe/unsubscribe
│   │   ├── reports/             # Report generation + email
│   │   ├── notifications/       # Comment notifications
│   │   └── admin/               # assign-athletes
│   ├── workout/[id]/            # Public workout preview (no auth)
│   ├── preview/[id]/            # Shareable workout preview (no auth)
│   ├── features/                # Marketing features page
│   └── contact/                 # Contact page
├── components/
│   ├── auth/                    # LoginForm, RegisterForm
│   ├── dashboard/               # Navbar, stats cards, ProfileCompletionBar, ProgressRing
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
│   ├── calendar/                # Calendar views, TYPE_CONFIG, getTypeData
│   ├── profile/                 # ProfileComponents (shared PieChart, StatCard, helpers), PhotoUpload
│   ├── reports/                 # Report sections, charts, tables
│   ├── onboarding/              # FileUploadStep, ImportPreview
│   ├── strava/                  # DuplicateDialog
│   ├── ai/                      # WorkoutRecommendations
│   └── ui/                      # shadcn/ui primitives
├── lib/
│   ├── firebase/
│   │   ├── config.ts            # getAuthInstance(), getDbInstance()
│   │   ├── auth.ts              # createUser, signIn, signOut, signInWithGoogle, getUserProfile, createUserViaAPI (calls server-side Admin SDK)
│   │   ├── firestore.ts         # All Firestore CRUD operations
│   │   └── admin.ts             # Firebase Admin SDK (API routes only)
│   ├── schemas/
│   │   ├── workout.ts           # Zod schemas for workout validation
│   │   └── profile.ts           # Zod schemas for profile
│   ├── stores/
│   │   └── authStore.ts         # Zustand auth state
│   ├── analytics.ts             # computeSummary, computeTypeDistribution for workout stats
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
  username?: string;                      // Unique URL slug for public profile
  role: 'coach' | 'athlete' | 'student'; // 'student' is legacy → use 'athlete'
  photoURL?: string;                      // Profile photo (Google or Firebase Storage upload)
  coachId?: string;                       // UID of assigned coach
  coachCode?: string;                     // 6-letter coach code (coaches only)
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Profile
  bio?: string;
  timezone?: string;
  profilePublic?: boolean;                // Whether public profile is visible
  profileTagline?: string;                // AI-generated athlete tagline
  sportPreferences?: string[];            // ['Running', 'Cycling', 'Swimming', 'Strength Training', 'Triathlon']
  ageRange?: string;                      // e.g., '18-24', '25-34', etc.
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

  // Push Notifications (Web Push API)
  pushSubscriptions?: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: string;
  }>;

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
  type: 'swim' | 'run' | 'bike' | 'strength' | 'triathlon' | 'other';
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

- **Navigation:** Minimal nav — logo + "Sign In" + "Get Started" buttons
- **Hero:** Centered layout with headline "Your training, all in one place", subtitle about tracking/Strava/no coach needed, two CTAs ("Start for free" + "I have an account"), inline sport pills (Running, Swimming, Cycling, Strength, Triathlon)
- **How It Works:** 3 simple steps with numbered circles — Create your account → Connect Strava → Train & improve
- **Features grid:** 6-card grid — Strava Sync, Visual Calendar, Progress Tracking, AI Coach, Multi-Sport, Email Reminders
- **FAQ:** 4 cards — Is it free? / Need a coach? / Watch compatibility? / Sports supported?
- **Final CTA:** "Ready to start training?" with signup button
- **Footer:** Logo + Contact link + copyright
- **Theme:** Dark (black bg), red (#ef4444) accent, minimal glow effects, welcoming tone (no aggressive ALL CAPS)

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

### Onboarding (`/onboarding`) — 5 Steps

1. **Intro** — Welcome splash screen with "Get Started" button
2. **Name** — Display name entry with profanity check via `/api/ai/profanity-check`
3. **Age** — Age range selection (7 ranges from "Under 18" to "65+")
4. **Import** — Workout history import. Drag-and-drop CSV/XLSX upload (max 10 MB). Supports Garmin, Apple Health, Strava exports. Processed via `/api/workouts/import` with AI-powered extraction + programmatic date detection. Shows success count and summary.
5. **Strava** — Strava OAuth connection with benefits list (auto-sync, stats, route maps, photos)

Progress dots, back/continue navigation, skip options. Data saved to Firestore user doc on finish. Redirects to dashboard.

### Dashboard (`/dashboard`)

- **Profile completion CTA** — Progress bar, links to finish setup (shown when < 100%)
- **Weekly Wrap banner** — Dismissible card with gift icon, shows last week's workout count, links to `/wrap`
- **Hero header** — Time-based greeting, this week's summary, "New Workout" button
- **Stats row** (4 cards, responsive 2x2 → 1x4):
  - Streak (consecutive completed workout days, Flame icon)
  - This Week (completed / total, Zap icon)
  - All-Time Completed (Trophy icon)
  - Total Workouts (Activity icon)
- **Weekly activity chart** (3 cols) — Recharts bar chart Mon-Sun, stacked completed + pending, today highlighted darker
- **Type breakdown** (2 cols) — Horizontal bars per sport type sorted by frequency, shows count + percentage, only from completed workouts
- **Upcoming workouts** (2 cols, left) — 4 upcoming incomplete workouts, date labels (Today/Tomorrow/date)
- **Recently done** (right column) — Last 3 completed workouts with date + checkmark
- **Event countdowns** (right column, conditional) — Color-coded: red ≤14d, orange ≤30d, gray >30d. Sorted by proximity, max 3.
- **Weekly Wrap CTA** (right column) — Gift icon, gradient, links to `/wrap`
- **Monthly Review CTA** (right column) — Calendar icon, blue gradient, links to `/review`
- **Quick links grid** (right column, 2x2) — Calendar, Reports, Profile, Workouts

### Workouts (`/workouts`)

**Layout (top to bottom):**
1. **Header:** Compact — title + small "+" create button (no gradient icon box)
2. **AI Workout Suggestions** — Collapsed by default behind a slim one-line trigger bar ("AI Workout Suggestions → Generate"). Expands to full suggestions panel on click. Orange sparkles icon, neutral card styling (no red). Each suggestion shows name, type badge, intensity, specs summary, description, warmup/mainSet/cooldown. "Use Workout" pre-fills the create form.
3. **Time Filter Tabs:** Planned | Past | All — small text-xs pills with counts (no icons). "Planned" shows future uncompleted (ascending), "Past" shows completed/past (descending), "All" shows everything (descending).
4. **Type Filter Tags:** All | Run | Bike | Swim | Strength | Other — horizontal pill row with counts. Neutral active state (`bg-foreground text-background`). Filters applied on top of time filter.
5. **Spacing:** Tight `space-y-3` throughout for mobile-first compact layout.

**Workout Rows:** Compact single-row cards with:
- Type emoji + workout name + type badge + optional "Late" badge
- Date + primary stat (distance) + duration + assigned athlete name (coach view)
- Garmin-style stat chips on right (HR bpm, elevation m, calories, pace /km, power W, sets/exercises for strength)
- Completion status icon: ✓ green (completed), ✓ amber (late), ⚠ red (missed), ○ gray (pending)
- Missed workouts shown with opacity + strikethrough name
- **Delete button** — Trash icon appears on hover for planned (future, uncompleted) workouts. Opens AlertDialog confirmation. Only shown when user can manage workouts (coaches or unconnected athletes).
- Each row links to `/workouts/[id]`

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

**Multi-view calendar system** with 4 view modes: day, week, month, year.

- **CalendarHeader** — View mode selector (day/week/month/year buttons), Today/prev/next navigation, coach athlete picker dropdown, centered "Add Workout" button (next to date label), Export Calendar (ICS), Send Report button
- **CalendarAddDropdown** — Per-day cell dropdown with "Add Workout" (→ `/workouts/new?date=...`), "Add Event" (→ `/workouts/new?date=...&tag=race`), "Add Note" (inline popup with textarea — saves as "other" type workout, refreshes calendar via `onNoteAdded` callback)
- **Strava auto-sync indicator** — Real-time phase label during sync

**Week View** (`CalendarWeekView.tsx`):
- 7-column grid with day headers, fixed height `calc(100vh - 230px)`
- Up to 8 workout pills per day (configurable `maxPillsPerCell`), "+X more" overflow
- Color-coded pills by workout type, today highlighted in red
- Garmin-style workout cards: 3px left border (type color), emoji + name + type badge, 2x2 stats grid, status badge
- Rest days show leaf emoji
- Interactive day selection + click to view details or toggle complete

**Month View** (`CalendarFullMonthView.tsx`):
- Full month grid with week rows, 3 pills per cell (compact)
- Grays out non-current-month dates
- Same height constraint and responsive pill sizing

**Year View** (`CalendarYearView.tsx`):
- Grid of mini months (2-4 cols depending on screen)
- Heatmap-style display: intensity by workout count (0, 1, 2, 3+ workouts = green density scale)
- Legend showing less/more activity
- Clicking a day switches to day view

**Day View** — `CalendarDayWorkouts.tsx` renders full list for selected date

**Mobile** — `MobileWeekStrip.tsx` for week navigation with scrollable day pills, simplified layouts

**Desktop Detail Panel** — `WorkoutDetailPanel.tsx` right sidebar shows full workout details

**Components directory:** `src/components/calendar/` — types.ts (TYPE_CONFIG, getTypeData with sport-specific stats extraction, duration formatters)

### Reports (`/reports`)

6-tab navigation (mobile: horizontal scroll pills, desktop: sticky sidebar):
1. **Dashboard Overview** — Key metrics summary
2. **Training Analysis** — Volume, intensity, frequency analysis with charts
3. **Exercise Insights** — Strength exercise breakdowns, PRs, volume tracking
4. **Calendar Views** — Heatmap-style calendar visualization
5. **Type Distribution** — Pie/donut charts for sport breakdown
6. **Duplicates** — DuplicateRemover component to find/merge duplicate workouts

Share Reports button with modal. Time-aware greeting.

### Weekly Wrap (`/wrap`)

Full-screen immersive "Your Week's Capsule" page with week-by-week navigation. **Monday–Sunday week boundaries** (ISO 8601, `weekStartsOn: 1`).

- **Top bar:** Close (X → dashboard), week nav arrows, week date range label, theme toggle
- **Brand header:** CT red badge + "Your Week's Capsule" label
- **Greeting:** "Dear {firstName}, this week was {rating}" with emoji
  - Rating system: incredible 🔥 (≥30% more), solid 💪 (≥10% more), consistent ✅ (±10%), recovery 🧘 (<10% less), quiet 😴 (no workouts), a great start 🚀 (first week)
- **Per-sport stats:** Each sport row shows emoji + "You {ran/cycled/swam/lifted} {distance/duration}" in sport color, with ↑/↓ % change vs last week
- **Highlight card:** Longest workout (≥60 min) or furthest session (≥5km), shows photo if available from Strava
- **Footer stats:** workout count + completed count + week label
- **Sticky share bar:** "Send to friends" button → ShareButtons (Instagram, WhatsApp, X, iMessage, Save Image, Copy Link)
- **Image export:** `html-to-image` toPng with pixelRatio 2, captures entire cardRef div

**Key functions:** `computeWeeklySportStats()`, `detectHighlight()`, `getWeekRating()`, `pctChange()`

### Monthly Review (`/review`)

Rich monthly training report with month-by-month navigation.

- **Nav bar:** Close → dashboard, month arrows, month label, theme toggle
- **"Not ready" gate:** If current/future month, shows lock screen with "View {lastMonth} instead" button
- **ROW 1 — Hero:** CT brand + "Month in Review" + "Dear {name}, this was {rating}" + 4 big stat badges (workouts, distance km, time hrs, active days of total)
- **ROW 2 — 3-column grid:**
  - Activity Calendar: mini month grid with active-day green dots, day-of-week headers
  - By Sport: per-sport cards with gradient bg, emoji, metric, session count, duration, ±% vs last month
  - Pie chart breakdown (Recharts) + vs Last Month (3-col % comparison with trend arrows) + highlight card with photo
- **ROW 3 — Daily Activity:** Full-width Recharts bar chart, one bar per day, green for active, muted for rest, tooltip with date + count
- **ROW 4 — Weekly Trends:** Side-by-side area charts for weekly distance (km, green) and weekly duration (min, blue)
- **Sticky share bar:** Same ShareButtons pattern as wrap

**Key functions:** `computeMonthlySportStats()`, `detectMonthHighlight()`, `getMonthRating()`, `ActivityCalendar` component

### Yearly Wrapped (`/wrapped`)

8-slide interactive carousel for annual training review (currently hardcoded to 2025).

- **Slides:** guess → reveal → stats → breakdown → records → heatmap → summary → final
- **Guess slide:** Interactive workout count guessing game with slider, emoji reactions based on accuracy
- **Stats slide:** Key annual stats (total workouts, distance, hours, calories, active days, max streak)
- **Breakdown slide:** Recharts pie chart with sport type distribution + per-sport stat rows
- **Records slide:** Personal records showcase with trophy badges
- **Heatmap slide:** GitHub-style activity heatmap for the year, 12-month grid with intensity colors
- **Summary slide:** VeloViewer-style summary with AI-generated narrative
- **Final slide:** CTA to share, with animated gradient background
- **Progress dots** at bottom for slide navigation
- **Public sharing route:** `/athlete/[username]/wrapped` — SSR, OG image generation, privacy-gated via `profilePublic` flag
- **Components:** `src/components/wrapped/WrappedSlides.tsx` (6 slide components + `computeYearStats()`)

### Profile (`/profile`) — Read-Only Public-Style View

Displays the same layout as the public athlete profile (`/athlete/[username]`):
- **Hero:** Profile photo (with PhotoUpload) + display name + @username + AI-generated tagline + bio + sport preference pills
- **"Edit Profile" button** — links to `/settings` (no inline editing)
- **Stats grid:** Total workouts, hours trained, total distance, calories burned (computed via `computeSummary()` from `src/lib/analytics.ts`)
- **Training breakdown:** Pie chart showing workout type distribution (computed via `computeTypeDistribution()`)
- **Recent workouts:** Latest 5 workouts with type emoji, name, date, key stats
- **Personal records:** PR showcase with badges
- **Empty state:** Shown when no workouts exist yet

Shared components (`PieChart`, `StatCard`, format helpers) live in `src/components/profile/ProfileComponents.tsx` — used by both `/profile` and `/athlete/[username]`.

### Settings (`/settings`)

- **Edit Profile** card — full profile edit form:
  - **Basic Info:** Display name, bio (300 char limit), timezone dropdown
  - **About You:** Age range, experience level, height (with cm/ft toggle), weight (with kg/lbs toggle)
  - **Sports:** SPORT_OPTIONS badge toggles (Running, Cycling, Swimming, Strength Training, Triathlon)
  - **Training For:** TRAINING_FOR_OPTIONS badge toggles + inline event name/date fields for each selected goal
  - **Role display** (read-only) + Save button with Firestore update
- **Public Profile** toggle — enable/disable `/athlete/[username]` page
- **Strava integration:**
  - Connect/disconnect buttons
  - Manual sync with duplicate detection dialog
  - Auto-sync status indicator
  - Link to Garmin-Strava connection guide
- **Account:** Change password link, Sign out button

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

### Public Athlete Profile (`/athlete/[username]`)

- Server-rendered (SSR), no auth required
- OpenGraph + Twitter card metadata for rich link previews
- **Hero:** Avatar + display name + @username + AI-generated tagline + bio + sport pills
- **Stats grid:** Total workouts, hours trained, total distance, calories
- **Training breakdown pie chart** + **Recent workouts** (side by side)
- **Personal records** showcase with PR badges
- **CTA banner:** "Join The Daily Athlete" for visitors (not shown for logged-in profile owner)
- **Share button:** Copy link to clipboard
- Privacy: Only shows aggregate stats + workout names, not full descriptions or comments
- Uses shared components from `src/components/profile/ProfileComponents.tsx`
- **Public Wrapped sub-route:** `/athlete/[username]/wrapped` — SSR public yearly wrapped with 6 slides (no guess game), privacy-gated via `profilePublic`, dynamic OG image generation

### Admin Dashboard (`/admin`)

- **Hidden URL** — not linked from any nav, footer, or page. Type directly to access.
- **Password gate** (`/admin`) — standalone dark-themed page with a single password field. No username.
  - `POST /api/admin/verify` checks `ADMIN_PASSWORD` env var
  - Sets signed `httpOnly` cookie `admin_session` (4-hour expiry, signed with `ADMIN_SECRET`)
  - Wrong password: generic error, no detail
- **Dashboard** (`/admin/dashboard`) — requires valid cookie; redirects to `/admin` if missing.
  - **Section 1 — Overview:** user count, workout count, active today, last backup timestamp, server health
  - **Section 2 — Backups:** table of daily (7), weekly (4), monthly (12) snapshots from Firebase Storage. Restore button opens confirmation modal.
  - **Section 3 — Users:** paginated table with search. Per-row: View (side panel), Delete (soft), Restore.
  - **Section 4 — System Actions:** manual backup trigger, log viewer (last 50 cron runs from `adminLogs` collection)
- **Backup storage:** Firebase Storage at `backups/{type}/{ISO-timestamp}.json`. Metadata in Firestore `backups` collection.
- **New env vars:** `ADMIN_PASSWORD`, `ADMIN_SECRET`, `FIREBASE_STORAGE_BUCKET`
- **Files:** `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/dashboard/page.tsx`

### Sharing Infrastructure

**`ShareButtons` component** (`src/components/workouts/ShareWorkoutCard.tsx`) — Reusable share UI used by wrap, review, wrapped, and workout detail pages:
- **Instagram Story** — generates PNG, downloads to device, opens Instagram, copies caption
- **WhatsApp** — `wa.me/?text=...` with share text + URL
- **X/Twitter** — Twitter intent tweet endpoint
- **iMessage** — Web Share API for files, falls back to `sms:` protocol
- **Save Image** — `html-to-image` toPng (quality 0.95, pixelRatio 2, cacheBust, skipFonts), downloads PNG
- **Copy Link** — copies share URL to clipboard with toast
- Handles CORS by hiding cross-origin images before capture

**`ShareWorkoutCard` component** — Workout-specific wrapper: dark gradient card with workout name, type, stats, AI comment. Share URL: `/preview/{username}/{workoutId}`

### Other Public Pages

- **`/features`** — Marketing page: 3 pillars, 12-feature grid, workout tags showcase, How It Works
- **`/contact`** — Contact hub: 2 email cards + GitHub link

---

## API Routes

### Authentication
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/create-user` | POST | Server-side user creation via Admin SDK (bypasses Firestore security rules). Validates username, creates user doc + userMapping atomically. Idempotent. |
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
| `/api/workouts/import` | POST | CSV/XLSX import with AI extraction + programmatic DD/MM date detection. Model fallback: 70B → 8B on rate limit. |

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

### Push Notifications
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/push/subscribe` | POST | Register Web Push subscription (dedup by endpoint) |
| `/api/push/subscribe` | DELETE | Unsubscribe from push notifications |

### Admin
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/assign-athletes` | POST | Manually assign athletes to coaches |
| `/api/admin/verify` | POST | Verify admin password, set signed httpOnly session cookie |
| `/api/admin/backup` | GET | List all backup snapshots (daily/weekly/monthly) |
| `/api/admin/backup` | POST | Trigger manual backup — exports Firestore to Firebase Storage JSON |
| `/api/admin/backup/[id]` | GET | Get backup detail |
| `/api/admin/backup/[id]` | POST | Restore from backup snapshot |
| `/api/admin/users` | GET | List all users (Admin SDK) |
| `/api/admin/users/[uid]` | DELETE | Soft-delete user (disable Auth + set `deletedAt`) |
| `/api/admin/users/[uid]` | PATCH | Restore deleted user (re-enable Auth + clear `deletedAt`) |
| `/api/cron/backup` | GET | Scheduled backup cron handler (`?type=daily\|weekly\|monthly`) |

---

## Coach-Athlete System

Coach-athlete connections work via **unique 6-letter coach codes**.

**How it works:**
- Coaches receive a unique 6-letter code upon registration
- Athletes enter their coach's code during registration to connect
- Coach code system: coaches get a unique 6-letter `coachCode`, athletes enter it to set `coachId`
- Legacy hardcoded connections also exist for `rsareen@gmail.com` as coach

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

### Auto-Sync System

**Hook:** `src/hooks/useStravaAutoSync.ts` — progressive phase-based auto-sync on page load:
1. Phase 1: `period=2days` — fetch last 2 days
2. Phase 2: `period=7days` — fetch last 7 days
3. Phase 3: `period=30days` — fetch last 30 days
4. Stops early if quota exhausted (429) — graceful abort

**Store:** `src/lib/stores/stravaSyncStore.ts` — Zustand state machine:
- **Quota-safe POST mode** — when tokens are available (from auth store), sends them in request body → zero Firestore reads on server (bypasses Spark plan quota limits)
- **GET fallback** — reads tokens from Firestore, falls back to POST if quota hit
- **`toErrorString()` helper** — safely extracts string error messages from any value (including Firebase error objects `{code, message}`) to prevent React error #31

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
   - Auto-merge with matching imported workout (`source: 'import'`, same day, same type, distance within 10%)
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
- **AI Workout Suggestions:** 3-tier pipeline — Logic Engine (periodization, fatigue detection, deload awareness) → Groq enhancement (names, descriptions, warmup/mainSet/cooldown, coaching rationale) → Validator (enforces load bounds, intensity limits, max modifications). Retry on validation failure. Fallback to logic-only if AI fails. `max_tokens: 8000`.
- **Workout tagging:** Analyzes activity name, type, distance, duration, pace, HR, elevation, location, terrain → assigns 1-3 tags
- **Route comments:** Generates playful 1-sentence location-based comments with emoji
- **Profanity check:** Validates display names and comments
- **Deduplication:** AI-powered duplicate detection pipeline
- **Format assistance:** Cleans up imported workout descriptions

### OpenAI
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
- **Training summaries** (`/api/cron/send-summaries`): Sent every 10 days (configurable `SUMMARY_INTERVAL_DAYS`)
  - Waits 10 days from account creation before first send
  - Data: userName, totalAssigned/Completed, completionRate, byType breakdown, stravaStats (distance/calories/time)
  - Subject emoji varies by completion rate (🔥 80%+, 💪 50%+, 📋 <50%)
  - Dark-themed email: header branding, completion rate %, workout breakdown badges, Strava stats section, CTA → `/calendar`
  - CC'd to coach if athlete has assigned coach
  - Max 50 users per run, tracks `lastSummaryDate`
  - Template: `src/lib/email/summaryTemplate.ts`
- **Weekly Wrap email** template at `src/lib/email/wrapTemplate.ts`:
  - Dark theme with "Your Week's Capsule" branding
  - Per-sport stats with emoji, metrics, comparison arrows (vs last week)
  - Highlight section (best workout), CTA → `/wrap`

---

## Import System

**Single-step import** via `/api/workouts/import` (POST):

1. **Upload:** CSV, .xlsx, .xls via drag-and-drop (onboarding step 4 or future standalone)
2. **Parse:** PapaParse for CSV, SheetJS for XLSX. Max 500 rows.
3. **Date Detection:** Programmatic column scanning with 8 regex patterns. Detects DD/MM vs MM/DD format at column level (if any value has first number >12, entire column is DD/MM). Pre-parses dates to ISO strings.
4. **AI Extraction:** Groq (70B with 8B fallback) extracts workout type, name, description, duration, distance from non-date columns. Row indices for cross-referencing.
5. **Date Override:** Pre-parsed dates replace AI dates (AI hallucinates dates — this is the critical fix).
6. **Create:** Batch Firestore writes with `source: 'import'`. Type-specific sub-objects, actualStats.
7. **Strava Merge:** When Strava syncs later, imported workouts are matched by day+type+distance(±10%) and merged instead of duplicated.

---

## Push Notifications

Web Push API with VAPID authentication for real-time browser notifications.

### Components
| File | Purpose |
|------|---------|
| `src/components/PushNotificationManager.tsx` | Client component, prompts for permission in standalone (PWA) mode |
| `src/lib/push.ts` | Server-side notification sending via `web-push` SDK |
| `/api/push/subscribe` | POST/DELETE endpoints for subscription management |

### Features
- VAPID authentication for secure push delivery
- Multi-device support (array of subscriptions per user)
- Auto-subscription when permission granted; prompt in default state
- Subscription deduplication by endpoint URL
- Automatic cleanup of expired subscriptions (410/404 responses)
- Non-blocking error handling (failed sends don't throw)
- Use cases: Strava sync completion, weekly wrap ready notifications

### Storage
Push subscriptions stored on user doc as `pushSubscriptions: Array<{endpoint, keys: {p256dh, auth}, createdAt}>`.

---

## State Management

### Zustand Stores

#### Auth Store (`src/lib/stores/authStore.ts`)

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

#### Strava Sync Store (`src/lib/stores/stravaSyncStore.ts`)

```typescript
interface StravaSyncState {
  status: 'idle' | 'syncing' | 'done' | 'error';
  result: SyncResult | null;
  error: string | null;
  needsReconnect: boolean;
  startSync: (username, decisions?, tokens?) => void;
  checkDuplicates: (username) => Promise<...>;
  clearResult: () => void;
}
```

- Module-level `activeSyncPromise` prevents duplicate syncs across component remounts
- `toErrorString()` helper safely extracts strings from any error value (objects, strings, unknown)
- `handleSyncResponse()` shared handler for both GET and POST sync paths

---

## Zod Schemas

### `src/lib/schemas/workout.ts`
- `swimDataSchema`, `bikeDataSchema`, `runDataSchema`
- `strengthExerciseSchema`, `strengthDataSchema`
- `otherDataSchema`
- `workoutSchema` — Main schema with type-based refinements
- `RECURRING_FREQUENCIES` — `['daily', 'weekly', 'biweekly', 'monthly']`

### `src/lib/schemas/profile.ts`
- `SPORT_OPTIONS` — `['Running', 'Cycling', 'Swimming', 'Strength Training', 'Triathlon']`
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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |

---

## PWA Support

The app is installable as a Progressive Web App on iOS and Android.

### Files
| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | Static manifest (name, icons, display: standalone, theme: #09090b) |
| `public/sw.js` | Service worker with versioned caches |
| `public/offline.html` | Dark-themed offline fallback page |
| `src/components/ServiceWorkerRegister.tsx` | Client component — registers SW on mount |
| `public/icons/icon-192.png` | App icon 192x192 |
| `public/icons/icon-512.png` | App icon 512x512 |
| `public/icons/icon-maskable-512.png` | Maskable icon for Android |
| `public/icons/apple-touch-icon.png` | iOS home screen icon |

### Caching Strategies
| Pattern | Strategy |
|---------|----------|
| `/_next/static/`, `/icons/`, Google Fonts | Cache-first |
| Navigation requests | Network-first, falls back to `/offline.html` |
| `/api/` routes | Network-only (never cached) |
| Everything else | Network-first with cache fallback |

### Safe-Area Handling
- **Viewport:** `viewportFit: 'cover'` in root layout — allows content under notch
- **Navbar:** `pt-[env(safe-area-inset-top)]` — pushes content below status bar
- **MobileBottomNav:** `pb-[env(safe-area-inset-bottom)]` — accounts for home indicator
- **Dashboard layout:** `overflow-x-hidden` (NOT `overflow-hidden` — that breaks `position: sticky`)
- **Status bar:** `black-translucent` via `metadata.appleWebApp`

### Key Lessons
- Vercel doesn't reliably serve Next.js `manifest.ts` dynamic routes — use static `public/manifest.webmanifest`
- `metadata.manifest` in Next.js layout doesn't always generate `<link>` tag — use explicit `<head>` tag
- `overflow: hidden` on parent containers kills `position: sticky` on child elements

---

## Known Issues

1. **Strava webhook** — Code exists but auto-registration requires manual env setup
2. **Save as Template** — Navigates to non-existent `/templates` page (broken)
3. **Custom domain** — `thedailyathlete.in` has DNS/NXDOMAIN issues (Squarespace)
4. **Legacy 'student' role** — Still appears in some type definitions and old data
5. **Firebase Spark plan quota** — Daily read quota (50K reads/day) can be exhausted by Strava auto-sync across multiple users. Quota-safe POST mode mitigates but doesn't eliminate the issue. Consider upgrading to Blaze plan.
6. **Groq rate limits** — 100K tokens/day on `llama-3.3-70b-versatile`. Mitigated with `llama-3.1-8b-instant` fallback but both models can be rate-limited under heavy import usage.
7. **Admin dashboard** — Planned but not yet built. See `UI Mockups and Strategy Files/ADMIN_DASHBOARD.md` for full spec.
8. **Coaches completing workouts** — No guard prevents coaches from marking athlete workouts as complete (should be athlete-only action).

## Recent Fixes (March 2026)

| Issue | Fix |
|-------|-----|
| #67 — iOS PWA safe-area collision | Switched to inline `style={{ paddingTop: 'env(safe-area-inset-top)' }}` on landing page nav/main/footer |
| #73 — Calendar UTC timezone | Use `activity.start_date` (actual UTC) instead of `start_date_local` (misleading "Z" suffix) in Strava sync routes |
| #73 — Post-merge both workouts visible | Optimistic state removal of deleted Strava workout in calendar page after successful merge |
| #74 — Push notifications cross-user | Track subscription ownership in `localStorage`; clean up previous user's Firestore entry on login/logout |
| #76 — Reports page refresh loop | Fixed `useCallback` deps from full `user` object to stable primitives (`user?.username`, `user?.role`) |
| Notes in workouts page | Notes (`tags: ['note']`) filtered from `/workouts` before time/type tabs |

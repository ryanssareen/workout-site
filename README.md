# The Daily Athlete - Workout Tracking Platform

A modern workout tracking platform for athletes. Built with Next.js 16, React 19, Firebase, and TypeScript.

## Features

### Core Functionality
- **User Authentication**: Email/password + Google Sign-In
- **Workout Management**: Create, read, update, and delete workouts with flat list view and type filter tags
- **Multi-Sport Support**: Running, Cycling, Swimming, Walk, Strength Training, Triathlon, and Other
- **Calendar View**: Multi-view calendar (day/week/month/year) with workout type differentiation, color coding, heatmap year view, and inline note creation
- **Date Scheduling**: Schedule workouts with specific dates and durations
- **Completion Tracking**: Athletes mark workouts as complete with actual stats (distance, duration, heart rate)
- **Strava Integration**: OAuth connection with 2-stage sync (quick fill + paginated backfill), rate limit hardening with header parsing, timezone fix (`parseLocalDate()`), on-demand photo/detail loading, manual merge dialog, and webhook reconciliation
- **Theme System**: Light mode by default, global theme toggle (sun/moon icon), Light/Dark/System picker in Settings
- **Admin Dashboard**: Full admin console with backup system (daily/weekly/monthly via Vercel Blob), user management, API playground (88+ endpoints), audit logging

### Profile & Onboarding
- **5-Step Onboarding**: Intro (welcome splash) → Name (display name with profanity check) → Age (age range selection) → Import (CSV/XLSX workout history) → Strava Connect
- **Profile Page**: Public-style view with stats grid, training breakdown pie chart, recent workouts, and personal records
- **Edit Profile Dialog**: Modal accessible from the profile page for quick edits
- **Public Athlete Profiles**: Shareable `/athlete/[username]` pages with AI-generated taglines
- **Profile Photo Upload**: Firebase Storage-backed avatar uploads with compression
- **Edit Profile in Settings**: Full profile form (name, bio, timezone, sports, goals, body metrics) lives in `/settings`

### AI-Powered Features
- **AI Workout Suggestions**: 3-tier pipeline (Logic Engine periodization → Groq LLaMA 3.3 70B enhancement → Validator with retry) for personalized workout recommendations
- **AI Coach Chat**: Conversational AI coach with thread history
- **Reports Hub**: 3-zone layout with AI Insight Card, Ask Anything bar, and template-based deep-dive reports (Sport Deep Dive, Trend Report, PR Timeline, Recovery Report, Goal Tracker)
- **Daily AI Insights**: Cron-generated training insights cached in Firestore
- **Dynamic Reports**: Structured JSON reports with charts, tables, stat cards, and PR badges
- **Profile Taglines**: AI-generated athlete taglines

### Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`): Monday–Sunday boundaries with per-sport stats, week-over-week comparison, highlight of the week, and rating system
- **Monthly Review** (`/review`): Activity calendar grid, per-sport stats with month-over-month comparison, pie chart, daily bar chart, weekly trends. Mobile-first redesign with bold stats and stacked bar chart
- **Yearly Wrapped** (`/wrapped`): 8-slide interactive carousel (guess game → reveal → stats → breakdown → records → heatmap → summary → final). Public sharing at `/athlete/[username]/wrapped`
- **Social Sharing**: Share via Instagram Story, WhatsApp, X/Twitter, iMessage, and save image (via `html-to-image`)

### Additional Features
- **Push Notifications**: Web Push API with VAPID authentication, multi-device support, auto-dedup, cleanup of expired subscriptions
- **PostHog Analytics**: Product analytics integration for usage tracking
- **Firestore Cost Optimization**: Workout cache store (Zustand, 5-min TTL), batched Strava lookups, auth guards
- **New Pages**: `/portfolio` (feature tour), `/roadmap` (visual phase timeline), `/comic` (14-slide origin story)

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix primitives
- **Authentication**: Firebase Auth (email/password + Google Sign-In)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (profile photos) + Vercel Blob (backups)
- **AI**: Groq SDK (LLaMA 3.3 70B + 8B instant fallback) + OpenAI SDK
- **Email**: Nodemailer (Gmail SMTP) + Brevo
- **Integrations**: Strava API (OAuth + webhooks)
- **Charts**: Recharts + custom SVG pie charts
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod
- **Analytics**: PostHog
- **Push**: Web Push API with VAPID
- **Deployment**: Vercel

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0 or later
- **npm** or **yarn** package manager
- **Firebase account** (free tier works)
- **Groq API key** (for AI features)
- **Git** for version control

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/workout-site.git
cd workout-site
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it "workout-tracker" (or your preferred name)
4. Follow the setup wizard

#### Enable Authentication

1. In Firebase Console, navigate to **Build → Authentication**
2. Click "Get started"
3. Enable "Email/Password" provider
4. Enable "Google" provider
5. Click "Save"

#### Create Firestore Database

1. Navigate to **Build → Firestore Database**
2. Click "Create database"
3. Start in **test mode** (we'll add security rules later)
4. Choose your preferred region
5. Click "Enable"

#### Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the web icon (`</>`)
4. Register app name: "workout-tracker-web"
5. Copy the configuration object

### 4. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_json

# AI Configuration
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=sk-your-openai-api-key

# Admin Dashboard
ADMIN_UIDS=comma_separated_firebase_uids
ADMIN_SECRET=your_32_char_random_string

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important**: Never commit `.env.local` to version control. It's already in `.gitignore`. For production, environment variables are stored in Vercel.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure environment variables (copy from `.env.local`)
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

## Usage Guide

### Usage

1. **Register**: Create an account
2. **Onboarding**: Complete 5-step setup (Intro → Name → Age → Import CSV/XLSX → Strava Connect)
3. **View Workouts**: See all assigned workouts filtered by type, click for details
4. **Complete Workouts**: Mark workouts as done with actual stats
5. **Connect Strava**: Auto-sync with 2-stage sync, rate limit hardening, and duplicate detection
6. **Training Reviews**: Check Weekly Wrap (`/wrap`), Monthly Review (`/review`), Yearly Wrapped (`/wrapped`)
7. **Profile**: View stats, training breakdown, recent workouts, and PRs
8. **Public Profile**: Share `/athlete/[username]` page with AI-generated tagline
9. **Edit Profile**: Update via Settings page or quick Edit Profile dialog

## Project Structure

```
workout-site/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages (login, register, reset-password)
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── workouts/      # Workouts list + create/edit
│   │   │   ├── calendar/      # Calendar view (day/week/month/year)
│   │   │   ├── profile/       # Read-only profile (stats, charts, PRs)
│   │   │   ├── settings/      # Profile editing, Strava, theme, account
│   │   │   ├── onboarding/    # 5-step onboarding
│   │   │   ├── reports/       # Reports Hub + [reportType] deep-dives
│   │   │   ├── ai-coach/      # AI coach chat
│   │   │   ├── records/       # Personal records
│   │   │   ├── wrap/          # Weekly training wrap
│   │   │   ├── review/        # Monthly review
│   │   │   └── wrapped/       # Yearly wrapped experience
│   │   ├── youwillneverguessthisistheadmin/ # Hidden admin dashboard
│   │   ├── athlete/[username]/ # Public athlete profiles (SSR)
│   │   ├── portfolio/         # Feature tour page
│   │   ├── roadmap/           # Visual phase timeline
│   │   ├── comic/             # Origin story carousel
│   │   ├── api/               # API routes (ai, auth, admin, cron, push, reports, strava, webhooks, workouts)
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── auth/              # Login/register forms
│   │   ├── calendar/          # Calendar views, TYPE_CONFIG
│   │   ├── dashboard/         # Navbar, ProfileCompletionBar, ThemeToggle
│   │   ├── profile/           # ProfileComponents, PhotoUpload, EditProfileDialog
│   │   ├── reports/           # ReportContainer, ReportRenderer, hub/, sections/
│   │   ├── strava/            # DuplicateDialog, ManualMergeDialog
│   │   ├── wrapped/           # WrappedSlides
│   │   ├── workouts/          # WorkoutCard, WorkoutForm, AI suggestions, ShareWorkoutCard
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── analytics.ts       # Workout analytics
│   │   ├── admin-auth.ts      # Admin session verification, CSRF, audit logging
│   │   ├── backup.ts          # Shared backup logic
│   │   ├── firebase/          # Firebase config, auth, firestore, admin
│   │   ├── email/             # Email templates and sending
│   │   ├── schemas/           # Zod validation schemas
│   │   ├── training/          # AI workout pipeline
│   │   ├── reports/           # Report cache and templates
│   │   ├── stores/            # Zustand stores (auth, workouts, strava, workout cache)
│   │   └── api-registry.ts    # API endpoint catalog (88+ endpoints)
│   └── types/                  # TypeScript types
├── public/                     # Static assets, PWA manifest, service worker
├── vercel.json                 # Cron job schedules
├── package.json
└── README.md
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production (catches type errors)
npm run start    # Start production server
npm run lint     # Run ESLint
npx tsc --noEmit # Type check without building
```

## Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are set correctly
- Check Firebase project settings match `.env.local`
- Ensure Firestore is created and in test mode initially

### Build Errors
```bash
rm -rf .next
rm -rf node_modules package-lock.json
npm install
```

### Strava Sync Issues
- Verify Strava OAuth credentials in environment variables
- Check that `parseLocalDate()` is used for timezone correctness
- Review rate limit status in browser console logs

## Documentation Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Groq API](https://console.groq.com/docs)
- [PostHog Docs](https://posthog.com/docs)

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with Next.js and Firebase

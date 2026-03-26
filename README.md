# The Daily Athlete

A modern multi-sport workout tracking platform for athletes. Built with Next.js 16, React 19, Firebase, and TypeScript.

**Live at [thedailyathlete.in](https://thedailyathlete.in)**

## Features

### Core
- **Multi-Sport Tracking**: Running, Cycling, Swimming, Walking, Strength Training, and more
- **Strava Integration**: 2-stage sync (quick fill + paginated backfill), rate limit hardening, timezone handling, webhook reconciliation, manual merge dialog
- **Calendar**: Multi-view (day/week/month/year) with color-coded workout pills, heatmap year view, inline notes, and event creation
- **Theme System**: Light/Dark/System with global toggle across all pages

### AI-Powered
- **Workout Suggestions**: 3-tier pipeline (Logic Engine periodization, Groq LLaMA 3.3 70B enhancement, Validator)
- **Smart Workout Naming**: Auto-suggests workout names based on type and time of day
- **AI Coach Chat**: Conversational training assistant with thread history
- **Reports Hub**: 3-zone layout with daily AI insights, deep-dive reports (Sport Deep Dive, Trend Report, PR Timeline, Recovery Report, Goal Tracker)
- **Recovery Nudge**: Dashboard alert when 3+ consecutive training days detected

### Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`): 4-slide interactive experience — Verdict → Numbers (animated count-up) → Day by Day (bar chart) → By Sport
- **Monthly Review** (`/review`): 5-slide experience — Month → Numbers → vs Last Month → Calendar → Breakdown
- **Yearly Wrapped** (`/wrapped`): 8-slide interactive with guess game, confetti, light/dark toggle, heatmap, records, and public sharing
- **Swipe Navigation**: Touch swipe support on all review pages for mobile/tablet
- **Social Sharing**: Instagram Story, WhatsApp (native app), X/Twitter, iMessage (native app), save image

### Gamification & UX
- **Animated Page Transitions**: Smooth route transitions via `next-view-transitions`
- **Workout Completion Confetti**: CSS-only confetti burst celebration
- **Skeleton Loading States**: Shimmer placeholders across dashboard
- **Duolingo-Style Streak Widget**: Animated flame that scales with streak length
- **"This Time Last Month" Badge**: Comparison widget linking to trend report
- **GitHub-Style Activity Heatmap**: On profile page
- **Gold PR Badges**: Shown on workout cards when a personal record was set
- **Quick-Log FAB**: Floating action button on mobile for fast workout creation
- **Workout Templates**: Save and load reusable workout presets
- **Post-Workout Emoji Rating**: Rate effort after completion (😫😐😊🔥💀)

### Profile & Onboarding
- **5-Step Onboarding**: Welcome → Name → Age → Import (CSV/XLSX) → Strava Connect
- **Public Athlete Profiles**: Shareable `/athlete/[username]` pages with AI-generated taglines
- **Profile Photo Upload**: Firebase Storage-backed with compression

### Infrastructure
- **Push Notifications**: Web Push API with VAPID, multi-device support
- **Admin Dashboard**: Backup system (Vercel Blob), user management, API playground (88+ endpoints), audit logging
- **Firestore Optimization**: Zustand cache (5-min TTL), localStorage auth cache, batched queries, auth guards
- **Login Performance**: Sub-second returning user loads with localStorage cache + eager profile fetch
- **PWA Support**: Installable on iOS/Android with offline fallback
- **Email System**: Anthropic-inspired clean email digests via Brevo, broadcast capability

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.9
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix primitives
- **Auth**: Firebase Auth (email/password + Google Sign-In) with terms consent
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (user content) + Vercel Blob (backups)
- **AI**: Groq SDK (LLaMA 3.3 70B + 8B fallback) + OpenAI SDK
- **Email**: Brevo (transactional + broadcast)
- **Integrations**: Strava API (OAuth + webhooks), PostHog (analytics)
- **Charts**: Recharts + custom SVG
- **State**: Zustand + localStorage caching
- **Deploy**: Vercel

## Legal

- [Privacy Policy](https://thedailyathlete.in/privacy)
- [Terms of Service](https://thedailyathlete.in/terms)

## License

This is a proprietary project. All rights reserved.

---

Built by [Ryan Sareen](mailto:ryanssareen@gmail.com)

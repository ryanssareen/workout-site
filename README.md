# The Daily Athlete

A modern multi-sport workout tracking platform for athletes. Built with Next.js 16, React 19, Firebase, and TypeScript.

**Live at [thedailyathlete.in](https://thedailyathlete.in)**

## Features

### Core
- **Multi-Sport Tracking**: Running, Cycling, Swimming, Walking, Strength Training, and more
- **Strava Integration**: 2-stage sync (quick fill + paginated backfill), rate limit hardening, timezone handling, webhook reconciliation, manual merge dialog
- **Calendar**: Multi-view (day/week/month/year) with color-coded workout pills, heatmap year view, inline notes, and event creation
- **Theme System**: Light/Dark/System with global toggle

### AI-Powered
- **Workout Suggestions**: 3-tier pipeline (Logic Engine periodization, Groq LLaMA 3.3 70B enhancement, Validator)
- **AI Coach Chat**: Conversational training assistant with thread history
- **Reports Hub**: 3-zone layout with daily AI insights, deep-dive reports (Sport Deep Dive, Trend Report, PR Timeline, Recovery Report, Goal Tracker)
- **Dynamic Reports**: Structured JSON with charts, tables, stat cards, and PR badges

### Training Reviews & Sharing
- **Weekly Wrap** (`/wrap`): Per-sport stats, week-over-week comparison, highlight of the week, daily activity chart
- **Monthly Review** (`/review`): Activity calendar, sport breakdown, daily/weekly charts, vs-last-month comparison
- **Yearly Wrapped** (`/wrapped`): 8-slide interactive carousel with guess game, heatmap, records, and public sharing
- **Social Sharing**: Instagram Story, WhatsApp, X/Twitter, iMessage, and save image

### Profile & Onboarding
- **5-Step Onboarding**: Welcome → Name → Age → Import (CSV/XLSX) → Strava Connect
- **Public Athlete Profiles**: Shareable `/athlete/[username]` pages with AI-generated taglines
- **Profile Photo Upload**: Firebase Storage-backed with compression

### Infrastructure
- **Push Notifications**: Web Push API with VAPID, multi-device support
- **Admin Dashboard**: Backup system (Vercel Blob), user management, API playground (88+ endpoints), audit logging
- **Firestore Optimization**: Zustand cache (5-min TTL), batched queries, auth guards
- **PWA Support**: Installable on iOS/Android with offline fallback

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.9
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix primitives
- **Auth**: Firebase Auth (email/password + Google Sign-In)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (user content) + Vercel Blob (backups)
- **AI**: Groq SDK (LLaMA 3.3 70B + 8B fallback) + OpenAI SDK
- **Email**: Nodemailer (Gmail SMTP) + Brevo
- **Integrations**: Strava API (OAuth + webhooks), PostHog (analytics)
- **Charts**: Recharts + custom SVG
- **State**: Zustand
- **Deploy**: Vercel

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
```

## Legal

- [Privacy Policy](https://thedailyathlete.in/privacy)
- [Terms of Service](https://thedailyathlete.in/terms)

## License

This is a proprietary project. All rights reserved.

---

Built by [Ryan Sareen](mailto:ryanssareen@gmail.com)

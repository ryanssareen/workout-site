# The Daily Athlete — Product Strategy

**Focus:** Athletes-first. Reports as viral core differentiator. Coaches later.
**Team:** 2 people, ~$100/month budget, pre-launch.

---

## Part 1: Current Assessment

### What's Strong

| Area | Assessment | Notes |
|------|-----------|-------|
| **Strava Sync** | Production-ready | OAuth + webhooks + dedup + photos + routes. Well-executed. |
| **AI Suggestions** | Genuinely advanced | 3-tier pipeline (logic engine → Groq → validator), periodization-aware, fatigue-aware. Better than Final Surge, TrainingPeaks. |
| **Report Engine** | Solid foundation | 6 section types, Recharts charts, AI-generated reports via Groq, PNG/PDF/email export. |
| **Onboarding** | Streamlined | Simplified to 3 steps (Sports → Goals with event name/date → About You). Profile completion bar on dashboard for deferred fields. |
| **Multi-Sport** | Complete | Swim, bike, run, strength, triathlon, other — all with sport-specific fields. |
| **Email System** | Working | Brevo for transactional, cron for reminders/summaries. |

### What's Missing or Weak

| Area | Gap | Impact |
|------|-----|--------|
| **Report sharing UX** | Reports can export PNG/PDF but there's no beautiful, branded "year in review" or "weekly wrap" shareable card | HIGH — this is the viral opportunity |
| ~~**Public athlete profiles**~~ | ✅ DONE — `/athlete/[username]` with stats, pie chart, recent workouts, PRs, AI tagline | ~~HIGH~~ |
| **Product analytics** | Zero tracking of user behavior (no PostHog, no Amplitude, nothing) | HIGH — can't improve what you can't measure |
| **PWA / mobile install** | No manifest.json, no service worker, no "Add to Home Screen" | MEDIUM — athletes use phones |
| **Monetization** | No payment system, no tiers, no pricing page | MEDIUM — not urgent pre-PMF |
| **Push notifications** | Email-only engagement | MEDIUM |
| **Month calendar view** | Week-only limits training block planning | LOW-MEDIUM |
| **Streak gamification** | No visual streak, no streak notifications | MEDIUM — retention lever |

### Competitive Position

**The whitespace:** No competitor combines AI coaching + coach-athlete workflow. But since we're going athletes-first, our near-term positioning is:

**"The AI training companion that makes your data beautiful and shareable"**

| Competitor | AI | Reports/Sharing | Price | Weakness We Exploit |
|-----------|-----|----------------|-------|-------------------|
| Strava | Surface-level summaries | Good social but generic | $12/mo | No real coaching intelligence, reports are basic |
| TrainingPeaks | None | Functional but ugly | $20/mo | No AI, dated UX, no viral sharing |
| Humango | Strong coaching | Minimal sharing | $30/mo | No social/viral features, expensive |
| Garmin Connect | Basic insights | Device-locked | $7/mo | Walled garden, no sharing culture |
| Final Surge | None | None | Free | Zero AI, zero reports |

**Our edge:** Beautiful AI-powered reports that athletes actually want to share. No one does this well.

---

## Part 2: Roadmap Brainstorming

### The Reports-as-Viral-Growth Thesis

Athletes love sharing training milestones. Strava's "Year in Sport" gets millions of shares. Spotify Wrapped generates massive organic reach. The Daily Athlete can own **training reports that athletes share.**

**Types of shareable reports (brainstorm):**

1. **Weekly Training Wrap** — Auto-generated every Sunday. Beautiful card: total distance, hours, workouts completed, streak, top workout, AI coach note. One-tap share to Instagram Stories / WhatsApp / X.

2. **Monthly Training Report** — Richer version: progress charts, PR highlights, consistency score, AI insights ("Your running pace improved 8% this month"), type breakdown donut chart. Downloadable as branded PNG.

3. **Race Recap Card** — After a tagged "race" workout: finish time, distance, elevation, route map, AI congratulations, pace splits. Designed for immediate social sharing.

4. **Personal Record Cards** — When a PR is hit: bold visual with the record, improvement %, history chart. "New PR: 5K in 22:14 — 45 seconds faster than my previous best!"

5. **Milestone Cards** — 100th workout, 1000km run, 365-day streak, first triathlon brick session. Auto-detected achievements with beautiful branded cards.

6. **Training Block Summary** — End-of-training-block report for event prep: "12 weeks to marathon — here's how you prepared." Volume progression, peak week, taper visualization.

7. **Year in Review** — Annual version: total stats, month-by-month heatmap, top achievements, sport breakdown, AI narrative summary. The "Spotify Wrapped" of training.

### Viral Mechanics

Every shared card includes:
- The Daily Athlete branding (logo + URL)
- "Track your training at thedailyathlete.com" subtle CTA
- Beautiful dark theme design (stands out on social feeds)
- QR code or short link to sign up

**Growth flywheel:**
```
Athlete trains → Strava syncs → AI generates report →
  Athlete shares beautiful card → Friends see it →
  Friends sign up → They train → They share → ...
```

### Feature Ideas (Ranked by Viral Potential × Effort)

| # | Feature | Viral Potential | Effort | Priority |
|---|---------|----------------|--------|----------|
| 1 | Weekly Training Wrap card (auto-generated, one-tap share) | Very High | Medium | P0 |
| 2 | PR Achievement cards (auto-detected, shareable) | Very High | Low-Medium | P0 |
| 3 | Public athlete profile page (`/athlete/[username]`) | High | Medium | P1 |
| 4 | Monthly Training Report card | High | Medium | P1 |
| 5 | Milestone badges (100th workout, 1000km, etc.) | High | Low | P1 |
| 6 | Race Recap card | High | Medium | P1 |
| 7 | Year in Review ("Wrapped") | Very High | High | P2 (December) |
| 8 | Embeddable stats widget (for blogs/Linktree) | Medium | Medium | P2 |
| 9 | Training block summary | Medium | High | P2 |
| 10 | Comparison cards ("This month vs last month") | Medium | Low | P2 |

---

## Part 3: Implementation Plan

Each item below is a standalone implementation task. Pick any one and ask Claude to build it.

---

### Implementation 1: Weekly Training Wrap Card

**What:** Every Sunday (or on-demand), generate a beautiful shareable image card summarizing the athlete's training week.

**Card content:**
- Week date range header
- Total workouts completed (with target if set)
- Total distance (running + cycling combined, in km/mi)
- Total training time (hours:minutes)
- Current streak count
- Workout type breakdown (mini donut or icon row)
- "Highlight of the week" — best workout by AI analysis
- AI coach one-liner ("Consistent week! Your Tuesday intervals were fire.")
- The Daily Athlete branding + signup CTA

**Technical approach:**
- New component: `src/components/reports/WeeklyWrapCard.tsx` — React component rendering the card
- New API route: `POST /api/reports/weekly-wrap` — computes week data, generates AI summary via Groq
- Export via `html-to-image` (already used in ReportContainer)
- Share via existing `ShareButtons` component (WhatsApp, X, iMessage, download, native share)
- Auto-trigger: Add to existing `/api/cron/send-summaries` to email the card every Sunday
- Dashboard widget: Show "Your Week" card on dashboard with share button

**Key files to modify:**
- `src/lib/analytics.ts` — reuse `computeSummary()`, `computeTimeSeries()`
- `src/components/reports/ReportContainer.tsx` — reuse PNG/PDF export logic
- `src/components/workouts/ShareWorkoutCard.tsx` — reuse share modal pattern
- `src/app/(dashboard)/dashboard/page.tsx` — add weekly wrap widget
- New: `src/components/reports/WeeklyWrapCard.tsx`
- New: `src/app/api/reports/weekly-wrap/route.ts`

**Design:** Dark card (slate-900 bg), red accent (#ef4444), white text. 1080x1350px (Instagram Stories ratio). The Daily Athlete logo bottom-right.

---

### Implementation 2: PR Achievement Cards

**What:** When a personal record is detected (fastest 5K, longest ride, heaviest deadlift, etc.), auto-generate a shareable celebration card.

**Card content:**
- "NEW PERSONAL RECORD" header with trophy icon
- Exercise/activity name
- New record value (bold, large)
- Previous record + improvement % ("12% faster than your previous best")
- Date achieved
- Mini sparkline showing PR progression over time
- AI congratulations ("Crushed it! That's your 3rd running PR this month.")
- The Daily Athlete branding

**Technical approach:**
- PR detection already exists in `src/lib/analytics.ts` → `computePRTimeline()`
- New component: `src/components/reports/PRAchievementCard.tsx`
- Trigger: After Strava sync completes, check for new PRs → show celebration modal with share option
- Also accessible from `/reports` → Exercise Insights section
- Reuse `html-to-image` export and `ShareButtons`

**Key files to modify:**
- `src/app/api/strava/sync/route.ts` — add PR detection after sync
- `src/lib/analytics.ts` — reuse PR computation functions
- `src/app/(dashboard)/dashboard/page.tsx` — show PR celebration if detected
- New: `src/components/reports/PRAchievementCard.tsx`

---

### Implementation 3: Public Athlete Profile Page ✅ DONE

**Status:** Fully implemented. Public profile pages live at `/athlete/[username]` with SSR, OpenGraph metadata, and full stats.

**What was built:**
- Server-rendered public profile at `/athlete/[username]` — no login required
- Hero section: avatar + name + @username + AI-generated tagline + bio + sport pills
- Stats grid: total workouts, hours, distance, calories
- Training breakdown pie chart + recent workouts (side by side)
- Personal records showcase with PR badges
- "Join The Daily Athlete" CTA banner for visitors
- Shared components extracted to `src/components/profile/ProfileComponents.tsx` (PieChart, StatCard, helpers) — used by both `/profile` and `/athlete/[username]`
- Username field on user profile (unique, slugified)
- `getUserByUsername()` + `getUserWorkouts()` + `getPersonalRecords()` in Firestore
- Profile page (`/profile`) rewritten as read-only public-style view matching the public page layout
- Edit profile moved to `/settings` page

---

### Implementation 4: Milestone Badge System

**What:** Auto-detect training milestones and award visual badges that athletes can share.

**Milestones (examples):**
- Workout count: 10, 25, 50, 100, 250, 500, 1000
- Distance: 100km, 500km, 1000km, 5000km (running or cycling)
- Streak: 7 days, 14 days, 30 days, 60 days, 100 days, 365 days
- First-ever: First swim, first brick session, first strength workout
- Consistency: 4 weeks in a row with 3+ workouts
- Sport milestones: First century ride (100mi/160km), first marathon distance, first open water swim

**Card content per milestone:**
- Badge icon (custom per milestone type)
- Milestone title ("CENTURY CLUB" or "100 WORKOUTS")
- Achievement description
- Date earned
- The Daily Athlete branding

**Technical approach:**
- New: `src/lib/milestones.ts` — milestone definitions + detection logic
- New: `src/components/reports/MilestoneBadge.tsx` — shareable badge card
- Check milestones after each workout completion / Strava sync
- Store earned milestones in Firestore (`users/{uid}/milestones` subcollection)
- Dashboard widget: Show recently earned badges
- Profile page: Display badge collection

**Key files to modify:**
- `src/app/api/strava/sync/route.ts` — trigger milestone check after sync
- `src/app/(dashboard)/dashboard/page.tsx` — show milestone celebrations
- New: `src/lib/milestones.ts`
- New: `src/components/reports/MilestoneBadge.tsx`
- New: Firestore subcollection `users/{uid}/milestones`

---

### Implementation 5: Monthly Training Report Card

**What:** A comprehensive monthly report card — a single beautiful image summarizing the entire month of training.

**Card content:**
- Month + year header
- Key stats row: Total workouts, hours, distance, completion rate
- Week-by-week volume bar chart (4-5 bars)
- Sport type breakdown (icon row with counts)
- Top 3 workouts of the month (name + key stat)
- PRs hit this month (if any)
- AI monthly summary (2-3 sentences: trends, improvements, recommendations)
- Month-over-month comparison arrow ("+15% more distance than last month")
- The Daily Athlete branding

**Technical approach:**
- New component: `src/components/reports/MonthlyReportCard.tsx`
- New API route: `POST /api/reports/monthly-report` — computes monthly data + AI summary
- Reuse `src/lib/analytics.ts` functions with monthly time range filter
- Auto-generate on 1st of each month, notify via email
- Accessible from Reports page and dashboard

**Key files to modify:**
- `src/lib/analytics.ts` — reuse existing computation, may need month-specific helpers
- `src/components/reports/ReportContainer.tsx` — reuse export logic
- New: `src/components/reports/MonthlyReportCard.tsx`
- New: `src/app/api/reports/monthly-report/route.ts`

---

### Implementation 6: Simplified Onboarding (3 Steps) + Profile Completion Bar ✅ DONE

**Status:** Fully implemented. Onboarding reduced to 3 focused steps. Profile completion bar on dashboard. Edit profile form lives in `/settings`.

**What was built:**

**3-step onboarding flow (`/onboarding/profile`):**
1. **Sports** — Multi-select from SPORT_OPTIONS: Running, Cycling, Swimming, Strength Training, Triathlon. Sport emoji badges with toggle selection.
2. **Goals** — Multi-select from 14 TRAINING_FOR_OPTIONS + inline event name and event date fields for each selected goal. Events saved as `Array<{ goal, eventName, eventDate }>`.
3. **About You** — Age range (dropdown), experience level (dropdown), height (with cm/ft toggle), weight (with kg/lbs toggle).

Progress dots, back/continue navigation, "Skip for now" option. Data saved to Firestore user doc on finish.

**Profile completion bar (dashboard):**
- `ProfileCompletionBar` component shows progress percentage + links to `/settings` to complete remaining fields
- Appears on dashboard when profile < 100% complete
- `getProfileCompletionInfo()` utility calculates completion based on all profile fields

**Edit profile in settings:**
- Full profile edit form added to `/settings` page (not `/profile`)
- Sections: Basic Info (name, bio, timezone), About You (age, experience, height, weight), Sports, Training For (with event name/date), Notifications
- `/profile` is now a read-only public-style view with "Edit Profile" linking to `/settings`

---

### Implementation 7: Add Product Analytics

**What:** Add PostHog (free tier, 1M events/month) to track user behavior.

**Events to track:**
- `user_signed_up` — registration method (email/Google)
- `strava_connected` — Strava OAuth completed
- `onboarding_completed` — finished onboarding
- `workout_synced` — Strava sync triggered
- `workout_completed` — manually marked complete
- `ai_suggestion_viewed` — viewed AI workout suggestion
- `ai_suggestion_accepted` — created workout from AI suggestion
- `report_viewed` — which report section
- `report_shared` — which platform (WhatsApp/X/download/etc.)
- `report_exported` — format (PNG/PDF/email)
- `page_viewed` — standard page tracking

**Technical approach:**
- Install `posthog-js` package
- Create `src/lib/posthog.ts` — PostHog client init with env var
- Add `PostHogProvider` to app layout
- Add `track()` calls at key interaction points
- PostHog dashboard: set up funnels (signup → Strava → first share)

**Key files to modify:**
- `package.json` — add posthog-js
- New: `src/lib/posthog.ts`
- `src/app/layout.tsx` — add PostHogProvider
- Various components — add track() calls at key points

---

### Implementation 8: PWA Support (Add to Home Screen)

**What:** Add Progressive Web App manifest and basic service worker so athletes can install the app on their phone home screen.

**What this enables:**
- "Add to Home Screen" prompt on mobile browsers
- App icon on phone (looks like native app)
- Full-screen mode (no browser chrome)
- Faster loading via service worker caching

**Technical approach:**
- Add `public/manifest.json` with app name, icons, theme color (#ef4444), display: standalone
- Add app icons (192x192, 512x512) to `public/`
- Add `<link rel="manifest">` to `src/app/layout.tsx`
- Add basic service worker for static asset caching (next-pwa or manual)
- Add meta tags for iOS (apple-mobile-web-app-capable, status-bar-style)

**Key files to modify:**
- New: `public/manifest.json`
- New: `public/icons/` — app icons at multiple sizes
- `src/app/layout.tsx` — add manifest link + meta tags
- `next.config.ts` — configure next-pwa if used

---

### Implementation 9: Race Recap Card

**What:** When a workout is tagged as "race", auto-generate a special shareable race recap card.

**Card content:**
- Race name (workout name)
- Finish time (large, bold)
- Distance
- Average pace
- Elevation gain
- Route map thumbnail (if Strava polyline exists)
- Heart rate stats (avg/max)
- AI race commentary ("A strong negative split — you paced this perfectly!")
- Strava photos (if available)
- The Daily Athlete branding

**Technical approach:**
- New component: `src/components/reports/RaceRecapCard.tsx`
- Trigger: When viewing a workout with "race" tag, show "Generate Race Recap" button
- Uses existing workout data + route map + Strava photos
- AI commentary via Groq (one API call)
- Share via existing ShareButtons

**Key files to modify:**
- `src/app/(dashboard)/workouts/[id]/page.tsx` — add Race Recap button for race-tagged workouts
- `src/components/workouts/RouteMap.tsx` — reuse for mini map in card
- New: `src/components/reports/RaceRecapCard.tsx`

---

### Implementation 10: Streak System with Notifications

**What:** Visual training streak on dashboard with email nudges when streak is at risk.

**What it tracks:**
- Current streak (consecutive days with a completed workout)
- Longest streak ever
- Streak status: safe / at risk (no workout today yet) / broken

**Dashboard display:**
- Flame icon + streak count (large number)
- "Longest streak: X days" subtitle
- Color: green (safe), amber (at risk after 6pm), red (broken today)
- Animation on streak milestone (7, 14, 30, etc.)

**Notification:**
- At 6pm local time (if no workout logged today and streak > 3): push email "Don't break your X-day streak! Log a workout today."
- Uses existing cron + Brevo infra

**Technical approach:**
- Streak already computed in `src/lib/analytics.ts` → `computeSummary()`
- New dashboard widget: `src/components/dashboard/StreakWidget.tsx`
- Add streak-at-risk check to `/api/cron/send-reminders`
- Store `longestStreak` on user doc for quick access

**Key files to modify:**
- `src/app/(dashboard)/dashboard/page.tsx` — add streak widget
- `src/app/api/cron/send-reminders/route.ts` — add streak-at-risk logic
- `src/lib/firebase/firestore.ts` — add longestStreak field management
- New: `src/components/dashboard/StreakWidget.tsx`

---

## Part 4: Recommended Execution Order

**Phase 1 — Foundation (Week 1-2):**
1. Implementation 7: Product Analytics (PostHog) — measure everything from day one
2. ~~Implementation 6: Simplified Onboarding~~ ✅ DONE — 3-step onboarding + profile completion bar + edit profile in settings
3. Implementation 8: PWA Support — mobile install capability

**Phase 2 — Viral Reports Core (Week 3-6):**
4. Implementation 1: Weekly Training Wrap Card — the flagship shareable
5. Implementation 2: PR Achievement Cards — celebration moments
6. Implementation 10: Streak System — retention hook

**Phase 3 — Expand Viral Surface (Week 7-10):**
7. Implementation 4: Milestone Badge System — more share moments
8. Implementation 5: Monthly Training Report Card — monthly viral loop
9. Implementation 9: Race Recap Card — high-emotion share moment

**Phase 4 — Growth Infrastructure (Week 11-14):**
10. ~~Implementation 3: Public Athlete Profile~~ ✅ DONE — `/athlete/[username]` with stats, charts, PRs, AI tagline

**Then:** Launch marketing push (Product Hunt, Reddit, Strava clubs), measure viral coefficient, iterate on highest-performing card types, add monetization when hitting 100+ active users.

---

## Appendix: Monetization (When Ready)

**Free tier (always):**
- Strava sync, manual logging, calendar, basic dashboard
- 3 AI suggestions/week
- Weekly Wrap card (with The Daily Athlete branding/watermark)
- All shareable cards (with branding — this IS your marketing)

**Pro tier ($8-12/month, implement after 100+ users):**
- Unlimited AI suggestions + AI chat coach
- AI-generated reports
- Monthly/annual report cards
- Remove branding from shared cards (optional)
- Training plan generation
- Data export (CSV/JSON)
- Advanced analytics
- Priority support

**Payment:** LemonSqueezy (simpler than Stripe for indie SaaS, handles global tax).

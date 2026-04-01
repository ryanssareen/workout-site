# The Daily Athlete — Product Strategy

**Focus:** Athletes-first. Reports as viral core differentiator.
**Team:** 2 people, ~$100/month budget, pre-launch.

---

## Part 1: Current Assessment

### What's Strong

| Area | Assessment | Notes |
|------|-----------|-------|
| **Strava Sync (Overhauled)** | Production-ready | 2-stage sync (quick fill + backfill), rate limit hardening with header parsing, timezone fix, on-demand photo loading, manual merge dialog, webhook improvements. Quota-safe POST mode sends tokens in body (zero Firestore reads). Progressive auto-sync (2d → 7d → 30d). Graceful 429 handling. `toErrorString()` prevents React error #31. |
| **AI Suggestions** | Genuinely advanced | 3-tier pipeline (logic engine → Groq → validator), periodization-aware, fatigue-aware, deload-aware. `max_tokens: 8000` for full workout details. Better than Final Surge, TrainingPeaks. |
| **Report Engine** | Production-ready | 7 section types (stat, chart, table, text, highlight, pr, divider), Recharts charts, AI-generated reports via Groq, PNG/PDF/email export. Reports Hub with 3-zone layout, daily AI insights cron, template-based deep-dive reports (Sport Deep Dive, Trend Report, PR Timeline, Recovery Report, Goal Tracker) with Firestore caching. |
| **Reports Hub** | Production-ready | 3-zone layout (AI Insight + Ask Anything + periodic reports + deep-dive cards), 5 AI report templates with Firestore caching, daily insight cron. |
| **Admin Dashboard** | Production-ready | Full admin console with backup system (Vercel Blob), user management, API playground (100+ endpoints), audit logging, HMAC auth + rate limiting. |
| **Theme System** | Production-ready | Light mode default, global toggle (Sun/moon), Light/Dark/System in Settings, theme-aware CSS variables across all pages. |
| **Firestore Optimization** | Production-ready | Zustand workout cache (5-min TTL), batched Strava lookups, auth store fix, auth guards on open routes. |
| **PostHog Analytics** | Integrated | Product analytics with event tracking (signups, completions, shares, suggestions). |
| **Onboarding** | Streamlined | 5 steps (Intro → Name → Age → Import workout history → Strava Connect). Profile completion bar on dashboard for deferred fields. |
| **Landing Page** | Polished | Simplified dark-themed design: centered hero, sport pills, 3-step how-it-works, 6-card feature grid, FAQ, CTA. Welcoming tone, no aggressive branding. |
| **Multi-Sport** | Complete | Swim, bike, run, strength, walk, triathlon, other — all with sport-specific fields. |
| **Email System** | Working | Brevo for transactional, cron for reminders/summaries. |
| **PWA** | Production-ready | Static manifest, service worker (cache-first static, network-first nav, offline fallback), safe-area handling, installable on iOS/Android. |
| **Workouts UX** | Clean mobile-first | Compact header, AI suggestions collapsed by default, tight spacing, Garmin-style stat chips, neutral/orange color scheme. Delete planned workouts with AlertDialog confirmation. |
| **Streak Tracking** | Functional | Streak counter on dashboard stats row, profile page, and public athlete profile. Computed from consecutive completed workout days. |
| **Calendar Actions** | Production-ready | CalendarAddDropdown per day cell: Add Workout (→ form), Add Event (→ form with race tag), Add Note (inline popup saves as workout). Add Workout button centered in header. |
| **Achievements System** | Production-ready | Auto-detected PRs (run/bike/swim/walk/strength) + milestones (workout count, distance, streak, first-ever). CelebrationModal with confetti + carousel. Dashboard achievements section. Shareable via ShareButtons. |
| **MCP Integration** | Production-ready | Model Context Protocol server at `/api/mcp` — exposes workout CRUD, user data, stats, PRs, comments for AI agent access. Token-based auth. |
| **Training Plan Engine** | Functional | Deterministic multi-week plan scheduling (`planEngine.ts`): picks dates, types, intensity, duration based on periodization principles. AI fills in details on top. |
| **Workout Import** | Production-ready | AI-powered CSV/XLSX import with programmatic date detection (DD/MM vs MM/DD). 5 import modules (parser, mapper, enricher, transformer, validator). Used in onboarding step 4. |

### What's Missing or Weak

| Area | Gap | Impact |
|------|-----|--------|
| ~~**Report sharing UX**~~ | ✅ DONE — `/wrap` (weekly shareable card), `/review` (monthly shareable card), `/wrapped` (yearly 8-slide interactive with public sharing at `/athlete/[username]/wrapped`). All use ShareButtons (Instagram Story, WhatsApp, X, iMessage, Save Image via html-to-image, Copy Link) | ~~HIGH~~ |
| ~~**Workouts UX**~~ | ✅ DONE — Compact mobile-first layout, AI suggestions collapsed by default behind slim trigger bar, tight spacing, Garmin-style stat chips, neutral/orange color scheme (no red), workout preview dialog | ~~MEDIUM~~ |
| ~~**Public athlete profiles**~~ | ✅ DONE — `/athlete/[username]` with stats, pie chart, recent workouts, PRs, AI tagline | ~~HIGH~~ |
| ~~**Product analytics**~~ | ✅ DONE — PostHog implemented (`posthog-js`). Events: `user_signed_up`, `workout_completed`, `report_shared`, `ai_suggestion_viewed`, `ai_suggestion_accepted`, `strava_connected`, `onboarding_completed`. `NEXT_PUBLIC_POSTHOG_KEY` set in Vercel. | ~~HIGH~~ |
| ~~**PWA / mobile install**~~ | ✅ DONE — Static manifest, service worker (cache-first static, network-first nav, offline fallback), Apple web app support, safe-area handling, installable on iOS/Android | ~~MEDIUM~~ |
| **Monetization** | No payment system, no tiers, no pricing page | MEDIUM — not urgent pre-PMF |
| ~~**Push notifications**~~ | ✅ DONE — Web Push API with VAPID, multi-device support, auto-cleanup, scoped to logged-in user (cross-user leakage fixed #74). Used for Strava sync + weekly wrap. | ~~MEDIUM~~ |
| **Month calendar view** | ✅ DONE — Calendar now has 4 views (day/week/month/year) with heatmap year view | ~~LOW-MEDIUM~~ |
| ~~**Streak gamification**~~ | ✅ DONE — Duolingo-style streak widget on dashboard with animated flame icon that scales with streak length, flame glow effect, recovery nudge after 3+ consecutive days | ~~MEDIUM~~ |
| **Firebase Spark quota** | ✅ MUCH IMPROVED — Zustand workout cache (5-min TTL + dedup), localStorage auth cache, batched lookups, auth guards. Reports/dashboard gracefully handle quota errors. Blaze upgrade recommended for scale. | MEDIUM — mitigated by caching |
| ~~**Legal pages**~~ | ✅ DONE — `/privacy` + `/terms` pages. Terms consent checkbox on registration. Footer links on all public pages. | ~~HIGH~~ |
| **Garmin Connect sync** | 🔄 IN PROGRESS — API application submitted with privacy policy + ToS. Pending Garmin approval. | HIGH |
| ~~**UX gamification**~~ | ✅ DONE — Page transitions, workout completion confetti, skeleton loaders, gradient stat cards, PR badges on cards, post-workout emoji rating, smart workout naming, quick-log FAB, workout templates fixed, swipe nav on reviews | ~~HIGH~~ |
| ~~**Login performance**~~ | ✅ DONE — Removed redundant `setPersistence()` (was 20-30s latency), localStorage auth cache, eager profile fetch, workout prefetch from auth store | ~~HIGH~~ |
| ~~**Share UX**~~ | ✅ DONE — WhatsApp/iMessage now open native apps. Month comparison badge links to trend report. | ~~MEDIUM~~ |
| ~~**Date safety**~~ | ✅ DONE — All client-side and server-side `.date.toDate()` calls guarded with `safeDate()`. All 5 report templates patched. | ~~MEDIUM~~ |

### Competitive Position

**The whitespace:** No competitor combines AI-powered training insights with beautiful shareable reports. Our positioning:

**"The AI training companion that makes your data beautiful and shareable"**

| Competitor | AI | Reports/Sharing | Price | Weakness We Exploit |
|-----------|-----|----------------|-------|-------------------|
| Strava | Surface-level summaries | Good social but generic | $12/mo | No real coaching intelligence, reports are basic |
| TrainingPeaks | None | Functional but ugly | $20/mo | No AI, dated UX, no viral sharing |
| Humango | Strong coaching | Minimal sharing | $30/mo | No social/viral features, expensive |
| Garmin Connect | Basic insights | Device-locked | $7/mo | Walled garden, no sharing culture |
| Final Surge | None | None | Free | Zero AI, zero reports |

**Our edge:** Beautiful AI-powered reports that athletes actually want to share + AI workout suggestions with full periodization awareness. No one does this well.

---

## Part 2: Roadmap Brainstorming

### The Reports-as-Viral-Growth Thesis

Athletes love sharing training milestones. Strava's "Year in Sport" gets millions of shares. Spotify Wrapped generates massive organic reach. The Daily Athlete can own **training reports that athletes share.**

**Shareable reports — current state:**

| Report Type | Status | Route |
|-------------|--------|-------|
| Weekly Training Wrap | ✅ DONE | `/wrap` — per-sport stats, week-over-week %, highlight, rating, ShareButtons |
| Monthly Training Report | ✅ DONE | `/review` — activity calendar, pie chart, daily/weekly charts, vs last month |
| Year in Review (Wrapped) | ✅ DONE | `/wrapped` — 8-slide carousel, guess game, public sharing + OG images |
| Comparison Cards | ✅ DONE | Built into `/review` as "vs Last Month" section |
| Public Athlete Profile | ✅ DONE | `/athlete/[username]` — SSR with stats, charts, PRs, AI tagline |
| Reports Hub (AI Deep Dives) | ✅ DONE | `/reports` hub with Sport Deep Dive, Trend Report, PR Timeline, Recovery Report, Goal Tracker — AI-generated via Groq with Firestore caching |
| Daily AI Insight | ✅ DONE | Cron-generated 1-sentence training insight, shown in Reports Hub |
| Ask Anything | ✅ DONE | Free-text training questions answered by AI in Reports Hub |
| Race Recap Card | Not started | High-emotion share moment after race-tagged workouts |
| PR Achievement Cards | ✅ DONE | Auto-detected celebration cards with CelebrationModal, confetti, PRCard component. Shareable via ShareButtons. |
| Milestone Badges | ✅ DONE | Achievement badges across 4 categories (workout count, distance, streak, first-ever). MilestoneCard + CelebrationModal carousel. |
| Training Block Summary | Not started | Pre-event preparation report with volume progression |

**Shareable reports still to build:**

1. **Race Recap Card** — After a tagged "race" workout: finish time, distance, elevation, route map, AI congratulations, pace splits. Designed for immediate post-race social sharing.

2. **Personal Record Cards** — When a PR is hit: bold visual with the record, improvement %, history chart. "New PR: 5K in 22:14 — 45 seconds faster than my previous best!"

3. **Milestone Cards** — 100th workout, 1000km run, 365-day streak, first triathlon brick session. Auto-detected achievements with beautiful branded cards.

4. **Training Block Summary** — End-of-training-block report for event prep: "12 weeks to marathon — here's how you prepared." Volume progression, peak week, taper visualization.

### Viral Mechanics

Every shared card includes:
- The Daily Athlete branding (logo + URL)
- "Track your training at thedailyathlete.com" subtle CTA
- Beautiful dark theme design (stands out on social feeds)
- QR code or short link to sign up

**Growth flywheel (proven with wrap/review/wrapped):**
```
Athlete trains → Strava syncs → AI generates report →
  Athlete shares beautiful card → Friends see it →
  Friends sign up → They train → They share → ...
```

The sharing infrastructure is fully built: ShareButtons component supports Instagram Story, WhatsApp, X, iMessage, Save Image (html-to-image), Copy Link. Every new card type plugs into this existing system.

### Feature Ideas — Next Wave

The viral report core is built. The next wave focuses on **retention** (keeping athletes engaged daily), **growth infrastructure** (analytics, PWA, SEO), and **monetization readiness**.

| # | Feature | Category | Impact | Effort | Priority |
|---|---------|----------|--------|--------|----------|
| ~~1~~ | ~~Product Analytics (PostHog)~~ | ~~Growth infra~~ | ✅ DONE | ~~Low~~ | ~~**P0**~~ |
| ~~2~~ | ~~PWA Support (Add to Home Screen)~~ | ~~Growth infra~~ | ✅ DONE | ~~Low~~ | ~~**P0**~~ |
| ~~3~~ | ~~PR Achievement Cards (shareable)~~ | ~~Viral / retention~~ | ✅ DONE — CelebrationModal with confetti, PRCard component, auto-detected after workout completion + Strava sync. Shareable via ShareButtons. | ~~Low-Medium~~ | ~~**P0**~~ |
| 4 | Streak System Enhancement | Retention | ✅ PARTIAL — streak counter + widget done, recovery nudge done. Still need: at-risk email nudges at 6pm | Low | **P0** |
| ~~5~~ | ~~Milestone Badge System~~ | ~~Viral / retention~~ | ✅ DONE — Auto-detected milestones across 4 categories (workout count, distance, streak, first-ever). MilestoneCard component, CelebrationModal carousel, DashboardAchievements display. | ~~Medium~~ | ~~**P1**~~ |
| 6 | Race Recap Card | Viral | HIGH — highest-emotion share moment in endurance sports | Medium | **P1** |
| 7 | AI Race Predictions | Differentiation | HIGH — predict race times based on training data | Medium | **P1** |
| ~~8~~ | ~~Training Plans / Programs~~ | ~~Core product~~ | ✅ PARTIAL — `planEngine.ts` for deterministic multi-week plan scheduling. AI enhances skeletons. Still need: calendar integration showing full plan, auto-adjustment. | ~~High~~ | ~~**P1**~~ |
| 9 | Smart Notifications | Retention | ✅ PARTIAL — Web Push infrastructure built, used for Strava sync + wrap. Still need: AI nudges (rest day advice, streak warnings, PR alerts) | Medium | **P2** |
| 10 | Social Feed / Follow Athletes | Growth | HIGH — activity feed, kudos/reactions, follow system | High | **P2** |
| 11 | Embeddable Stats Widget | Growth | MEDIUM — for blogs, Linktree, personal sites | Medium | **P2** |
| 12 | Training Block Summary | Viral | MEDIUM — pre-event preparation report | High | **P2** |
| 13 | Import from Other Platforms | Growth | ✅ PARTIAL — CSV/XLSX import with AI extraction + programmatic date detection in onboarding. Garmin API application submitted (privacy policy + ToS pages live). Still need: direct Garmin Connect sync, Apple Health, Wahoo API imports | High | **P2** |
| 14 | Group Challenges | Growth / retention | HIGH — weekly/monthly challenges between friends | High | **P3** |
| 15 | Advanced Training Load Analytics | Differentiation | MEDIUM — TSS/CTL/ATL fitness-fatigue chart, HR zones | High | **P3** |

### New Feature Concepts (Detailed)

**AI Race Predictions (#7):**
Based on recent training data (volume, pace trends, long run distances), predict finish times for upcoming events. "Based on your last 8 weeks: predicted marathon time 3:42–3:48." Updates weekly as training progresses. Shareable prediction card with confidence range. Athletes LOVE seeing predicted race times — this is a differentiator no competitor does well.

**Training Plans / Programs (#8):**
Move beyond single-day AI suggestions to structured multi-week programs. Athlete selects a goal event (already captured in onboarding), AI generates a periodized plan: base → build → peak → taper. Calendar integration shows the full plan. Week-by-week progression with auto-adjustment based on completed workouts. This is the feature that converts casual users to daily users.

**Social Feed / Follow Athletes (#10):**
Light social layer: follow other athletes, see their completed workouts in a feed, give kudos/reactions. NOT a full social network — just enough to create accountability loops. "Sarah completed a 10K run" → tap to congratulate. Athletes who see friends training are more likely to train themselves. Critical for retention at scale.

**Group Challenges (#14):**
Time-boxed challenges between friends or public: "Most distance in January", "7-day streak challenge", "Run 100km this month." Leaderboard, progress bars, completion badges. Shareable challenge cards. This is the feature that makes people invite friends — "Join my January challenge!"

---

## Part 3: Implementation Plan

Each item below is a standalone implementation task. Pick any one and ask Claude to build it.

---

### Implementation 1: Weekly Training Wrap Card ✅ DONE

**Status:** Fully implemented as an immersive full-page experience at `/wrap`.

**What was built:**
- Full-screen "Your Week's Capsule" page at `src/app/(dashboard)/wrap/page.tsx`
- Week-by-week navigation with offset arrows
- Per-sport stats rows: emoji + "You {ran/cycled/swam/lifted} {metric}" in sport color, with ↑/↓ % change vs last week
- Rating system: incredible 🔥 / solid 💪 / consistent ✅ / recovery 🧘 / quiet 😴 / great start 🚀 (based on week-over-week ratio)
- Highlight of the week: longest workout (≥60 min) or furthest session (≥5km), with Strava photo if available
- Sticky share bar: ShareButtons integration (Instagram, WhatsApp, X, iMessage, Save Image, Copy Link)
- Image export via `html-to-image` toPng (pixelRatio 2, quality 0.95)
- Dashboard CTA: "Weekly Wrap" banner + sidebar card linking to `/wrap`
- Email template: `src/lib/email/wrapTemplate.ts` for weekly digest
- Key functions: `computeWeeklySportStats()`, `detectHighlight()`, `getWeekRating()`, `pctChange()`

---

### Implementation 2: PR Achievement Cards ✅ DONE

**Status:** Fully implemented with auto-detection, celebration modal, and sharing.

**What was built:**
- `src/lib/pr-detection.ts` — `extractPRCandidates()` detects PRs across all sport types (longest run, fastest pace, heaviest lift, longest swim, etc.)
- `src/components/achievements/PRCard.tsx` — shareable PR celebration card
- `src/components/achievements/CelebrationModal.tsx` — full-screen confetti celebration with carousel for multiple PRs
- `src/components/achievements/DashboardAchievements.tsx` — dashboard section showing recent PRs
- `src/types/achievements.ts` — `DetectedPR`, `ConfirmedPR` types
- Auto-triggered after workout completion and Strava sync
- Shareable via existing ShareButtons (Instagram, WhatsApp, X, iMessage, save image)
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

### Implementation 4: Milestone Badge System ✅ DONE

**Status:** Fully implemented with 4 milestone categories, celebration UI, and dashboard display.

**What was built:**
- `src/lib/milestones.ts` — milestone definitions + detection logic across 4 categories:
  - **Workout count:** 10, 25, 50, 100, 250, 500, 1000
  - **Distance:** 100km, 500km, 1000km, 5000km
  - **Streak:** 7, 14, 30, 60, 100, 365 days
  - **First-ever:** First swim, first ride, first strength workout, etc.
- `src/components/achievements/MilestoneCard.tsx` — shareable milestone card with badge icon
- `src/components/achievements/CelebrationModal.tsx` — confetti + carousel for multiple milestone reveals
- `src/components/achievements/DashboardAchievements.tsx` — dashboard section showing milestones + PRs
- `src/types/achievements.ts` — `Milestone`, `MilestoneCategory`, `DetectedMilestone`, `AchievementResult`
- Auto-triggered after workout completion and Strava sync
- Admin fix endpoint at `/api/admin/fix-milestones`

---

### Implementation 5: Monthly Training Report Card ✅ DONE

**Status:** Fully implemented as a rich monthly review page at `/review`.

**What was built:**
- Full-page monthly review at `src/app/(dashboard)/review/page.tsx`
- Month-by-month navigation with "not ready" gate for current/future months
- ROW 1 — Hero: CT brand + rating + 4 big stat badges (workouts, distance km, time hrs, active days)
- ROW 2 — 3-column grid: Activity calendar (mini month grid with green dots), By Sport (per-sport cards with ±% vs last month), Pie chart breakdown + vs Last Month (3-col % comparison) + highlight card
- ROW 3 — Daily activity bar chart (Recharts, one bar per day, green/muted)
- ROW 4 — Weekly trends: side-by-side area charts for distance (km) and duration (min)
- Sticky share bar with ShareButtons
- Dashboard CTA: "Monthly Review" sidebar card linking to `/review`
- Rating system: incredible 🔥 / productive 💪 / consistent ✅ / recovery 🧘 / quiet 😴 / great start 🚀
- Key functions: `computeMonthlySportStats()`, `detectMonthHighlight()`, `getMonthRating()`, `ActivityCalendar` component

---

### Implementation 6: Onboarding (5 Steps) + Profile Completion Bar ✅ DONE

**Status:** Fully implemented. Onboarding expanded to 5 steps with workout import and Strava connect. Profile completion bar on dashboard. Edit profile form lives in `/settings`.

**What was built:**

**5-step onboarding flow (`/onboarding`):**
1. **Intro** — Welcome splash screen with "Get Started" button
2. **Name** — Display name entry with profanity check via `/api/ai/profanity-check`
3. **Age** — Age range selection (7 ranges from "Under 18" to "65+")
4. **Import** — Workout history import. Drag-and-drop CSV/XLSX upload (max 10 MB). Supports Garmin, Apple Health, Strava exports. Processed via `/api/workouts/import` with AI-powered extraction + programmatic DD/MM date detection. Shows success count and summary.
5. **Strava** — Strava OAuth connection with benefits list (auto-sync, stats, route maps, photos)

Progress dots, back/continue navigation, skip options. Data saved to Firestore user doc on finish.

**Profile completion bar (dashboard):**
- `ProfileCompletionBar` component shows progress percentage + links to `/settings` to complete remaining fields
- Appears on dashboard when profile < 100% complete
- `getProfileCompletionInfo()` utility calculates completion based on all profile fields

**Edit profile in settings:**
- Full profile edit form added to `/settings` page (not `/profile`)
- Sections: Basic Info (name, bio, timezone), About You (age, experience, height, weight), Sports, Training For (with event name/date), Notifications
- `/profile` is now a read-only public-style view with "Edit Profile" linking to `/settings`

---

### Implementation 7: Add Product Analytics ✅ DONE

**Status:** Fully implemented with PostHog.

**What was built:**
- `posthog-js` integrated with `NEXT_PUBLIC_POSTHOG_KEY` env var on Vercel
- `PostHogProvider` added to app layout
- Events tracked: `user_signed_up`, `workout_completed`, `report_shared`, `ai_suggestion_viewed`, `ai_suggestion_accepted`, `strava_connected`, `onboarding_completed`
- Standard page view tracking via PostHog autocapture
- PostHog dashboard configured for funnel analysis (signup → Strava → first share)

---

### Implementation 8: PWA Support (Add to Home Screen) ✅ DONE

**Status:** Fully implemented. Manual approach (no next-pwa/serwist packages).

**What was built:**
- Static `public/manifest.webmanifest` (Vercel requires static file, not Next.js dynamic `manifest.ts` route)
- `public/sw.js` — Service worker with versioned caches (`static-v1`, `offline-v1`). Cache-first for `/_next/static/`, `/icons/`, fonts. Network-first for navigation (falls back to offline page). Network-only for `/api/`. Network-first with cache fallback for everything else.
- `public/offline.html` — Self-contained dark-themed offline fallback with "You're offline" message and retry button
- `src/components/ServiceWorkerRegister.tsx` — Client component that registers SW on mount
- `public/icons/` — 4 icons: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- `src/app/layout.tsx` — Explicit `<link rel="manifest">` in `<head>` tag, viewport with `viewportFit: 'cover'`, Apple web app meta tags (`capable`, `black-translucent` status bar)
- Safe-area handling: Navbar `pt-[env(safe-area-inset-top)]`, MobileBottomNav `pb-[env(safe-area-inset-bottom)]`, dashboard layout `overflow-x-hidden` (not `overflow-hidden` which breaks `position: sticky`)

**Key lesson:** On Vercel, static files in `public/` with explicit HTML tags are more reliable than Next.js framework abstractions (`manifest.ts` route, `metadata.manifest` field).

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

### Implementation 11: Year in Review ("Wrapped") ✅ DONE

**Status:** Fully implemented as an 8-slide interactive carousel at `/wrapped` with public sharing.

**What was built:**
- 8-slide interactive carousel at `src/app/(dashboard)/wrapped/page.tsx`:
  - **guess** — Interactive workout count guessing game with slider, emoji reactions based on accuracy
  - **reveal** — Animated reveal of actual count
  - **stats** — Key annual stats (total workouts, distance, hours, calories, active days, max streak)
  - **breakdown** — Recharts pie chart with sport type distribution + per-sport stat rows
  - **records** — Personal records showcase with trophy badges
  - **heatmap** — GitHub-style activity heatmap for the year, 12-month grid with intensity colors
  - **summary** — VeloViewer-style summary with AI-generated narrative
  - **final** — CTA to share with animated gradient background
- Progress dots navigation, slide animations
- **Public sharing route:** `/athlete/[username]/wrapped` — SSR with 6 slides (no guess/reveal), privacy-gated via `profilePublic`, dynamic OG image generation
- Components: `src/components/wrapped/WrappedSlides.tsx` (6 slide components + `computeYearStats()`)
- Year currently hardcoded to 2025 (`YEAR` constant)

---

### Implementation 12: Strava Sync Overhaul ✅ DONE

**Status:** Fully overhauled with 2-stage architecture, rate limit hardening, and multiple bug fixes.

**What was built:**
- **2-stage sync architecture** — Quick fill (recent activities first for fast UX) + backfill (older activities in background). Replaces single-pass approach that was slow and quota-heavy.
- **Rate limit hardening** — Parses Strava API rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Usage`) to proactively pause before hitting limits. Exponential backoff on 429 responses. Tracks 15-min and daily quotas separately.
- **Timezone fix (#86)** — Always uses `activity.start_date_local` instead of `start_date` (UTC). Fixes wrong date parsing for non-UTC timezone users (e.g., 5:30h offset for IST).
- **On-demand photo loading** — Photos fetched lazily when viewing workout detail, not during sync. Reduces sync time and API calls.
- **Planned workout merge fix (#84)** — Strava activities correctly merge with planned/assigned workouts by matching date + type + distance within 10%. Strength workouts match by type+date alone.
- **Manual merge dialog** — DuplicateDialog component (`src/components/strava/DuplicateDialog.tsx`) shows side-by-side comparison when auto-merge is ambiguous, letting user choose which to keep.
- **Webhook improvements** — Better webhook event handling for activity create/update/delete events.
- **Quota-safe cleanup** — Removed unnecessary Firestore reads during sync. POST mode sends tokens in body (zero server-side reads).

---

### Implementation 13: Admin Dashboard ✅ DONE

**Status:** Fully implemented as a hidden admin console with comprehensive management tools.

**What was built:**
- **Hidden admin route** at `/admin` — standalone layout, no dashboard chrome, not linked from any navigation
- **Authentication** — Firebase Auth + UID allowlist (`ADMIN_UIDS` env var). Flow: Google sign-in → ID token → `POST /api/admin/verify` → Firebase `createSessionCookie` → `httpOnly` cookie (4h). Rate limit: 5 attempts/IP/15 min with 2s delay on failures.
- **CSRF protection** — All mutating routes check `Origin` header
- **Backup system** — Vercel Blob storage for backup snapshots. Daily/weekly/monthly cron jobs (`/api/cron/backup`). Full snapshot with integrity check. Manual trigger from admin UI. Auto prunes old backups.
- **Restore** — Full restore (with automatic pre-restore snapshot) and per-user restore from any snapshot
- **User management** — List all users, soft-delete (disables Firebase Auth), restore, CSV + JSON export
- **API playground** — Interactive API explorer for 88+ registered endpoints. Test any API route directly from admin UI with auto-populated auth headers.
- **API registry** — Centralized registry of all API endpoints with method, path, description, and auth requirements
- **Audit logging** — All admin actions written to `adminLogs` Firestore collection with acting UID, timestamp, action type, and target details. Actions: `backup_triggered`, `restore_triggered`, `user_deleted`, `user_restored`, `cron_backup`, etc.
- **System health** — Overview tab with user/workout counts, last backup timestamps, cron health monitoring via `system/lastCron` doc

---

### Implementation 14: Reports Hub Redesign ✅ DONE

**Status:** Fully redesigned with 3-zone layout and AI-powered deep-dive reports.

**What was built:**
- **3-zone layout** — Zone 1: AI Insight Card (daily cron-generated insight) + Ask Anything bar (free-text AI questions). Zone 2: Periodic report links (weekly wrap, monthly review, yearly wrapped). Zone 3: Deep-dive report cards (contextual, template-based).
- **5 AI report templates** — Sport Deep Dive (per-sport analysis), Trend Report (multi-week trends), PR Timeline (record progression), Recovery Report (rest patterns + training load), Goal Tracker (event preparation progress). Each template uses structured prompts sent to Groq.
- **Firestore caching** — Generated reports cached in Firestore with TTL. Re-requests within TTL serve cached version (zero AI API calls). Cache key based on template + user + date range.
- **Daily insight cron** — `/api/cron/daily-insight` runs at 6am UTC via Vercel cron. Uses Groq 8B instant model for cost efficiency. Generates 1-sentence personalized training insight per user. 24h TTL.
- **Ask Anything** — Free-text input in Reports Hub. User types any training question, AI responds with personalized answer based on their workout data. Powered by Groq with user context injection.
- **Report rendering** — `ReportRenderer` component handles 7 section types (stat, chart, table, text, highlight, pr, divider) with Recharts integration for charts.

---

## Part 4: Recommended Execution Order

### What's Done (Phases 1-5 Original Roadmap)

| Feature | Status |
|---------|--------|
| Simplified Onboarding (3 steps + profile completion bar) | ✅ DONE |
| Weekly Training Wrap (`/wrap`) | ✅ DONE |
| Monthly Training Report (`/review`) | ✅ DONE |
| Year in Review / Wrapped (`/wrapped`) | ✅ DONE |
| Public Athlete Profile (`/athlete/[username]`) | ✅ DONE |
| Comparison Cards (vs Last Month in `/review`) | ✅ DONE |
| Report Sharing UX (ShareButtons on all review pages) | ✅ DONE |
| Calendar 4-View System (day/week/month/year) | ✅ DONE |
| Workouts UX (AI suggestions collapsed by default, time filters, stat chips, neutral theme) | ✅ DONE |
| Landing Page (dark theme, feature grid, FAQ) | ✅ DONE |
| PWA Support (manifest, service worker, offline fallback, installable, safe-area) | ✅ DONE |
| Streak Counter (profile + public profile display) | ✅ DONE (partial — notifications pending) |
| Calendar Actions (Add Note popup, Add Event, centered Add Workout) | ✅ DONE |
| Delete Planned Workouts (trash icon on hover + AlertDialog confirmation) | ✅ DONE |
| Strava Quota-Safe Sync (POST mode, progressive auto-sync, error safety) | ✅ DONE |
| Push Notifications (Web Push API, VAPID, multi-device, Strava sync + wrap) | ✅ DONE |
| Push notifications scoped to logged-in user — cross-user leakage fix (#74) | ✅ DONE |
| Reports page continuous refresh loop fix (#76) — stable useCallback deps | ✅ DONE |
| Calendar UTC timezone fix (#73) — use `start_date_local` not `start_date` from Strava | ✅ DONE |
| Calendar merge UI fix (#73) — optimistic removal of deleted Strava workout after merge | ✅ DONE |
| iOS PWA safe-area fix (#67) — inline styles instead of Tailwind arbitrary classes | ✅ DONE |
| Notes hidden from workouts page — filtered by `tags: ['note']` before time/type tabs | ✅ DONE |
| Weekly Wrap Monday–Sunday boundaries (ISO 8601) | ✅ DONE |
| Reports Hub (3-zone layout: AI Insight + Ask Anything + periodic report links + contextual deep-dive cards) | ✅ DONE |
| AI Deep-Dive Reports (Sport Deep Dive, Trend Report, PR Timeline, Recovery Report) with template system + Firestore caching | ✅ DONE |
| Daily AI Insight Cron (Groq 8B, 6am UTC, 24h TTL) | ✅ DONE |
| Workout Import in Onboarding (CSV/XLSX with AI + programmatic date detection) | ✅ DONE |
| Strava-Import Merge (auto-merge imported workouts when Strava syncs) | ✅ DONE |
| Server-Side User Creation (Admin SDK, fixes Google Sign-In registration bug) | ✅ DONE |
| Groq Model Fallback (70B → 8B instant on rate limit) | ✅ DONE |
| Admin Dashboard (`/admin`) — Firebase Auth + UID allowlist, session cookies, rate limiting, CSRF protection | ✅ DONE |
| Backup System — daily/weekly/monthly cron snapshots to Vercel Blob, integrity check, manual trigger | ✅ DONE |
| Backup Restore — full restore (with pre-restore auto-snapshot), per-user restore from any snapshot | ✅ DONE |
| Admin Users Management — list all users, soft-delete (disable Auth), restore, CSV + JSON export | ✅ DONE |
| Admin Action Log — all admin actions written to `adminLogs` with acting UID and timestamp | ✅ DONE |
| Strava Sync Overhaul — 2-stage architecture (quick fill + backfill), rate limit hardening with header parsing, timezone fix (#86), on-demand photo loading, planned workout merge fix (#84), webhook improvements, manual merge dialog, quota-safe cleanup | ✅ DONE |
| Reports Hub Redesign (#69) — 3-zone layout, AI Insight Card, Ask Anything bar, 5 template-based deep-dive reports with Firestore caching, daily insight cron | ✅ DONE |
| Firestore Cost Optimization — Zustand workout cache (5-min TTL + dedup), auth store double-call fix, batched Strava lookups, coach students query optimization, auth guards, cache invalidation (#85) | ✅ DONE |
| Theme System — Light mode default, global theme toggle (Sun/moon), Settings Appearance section, theme-aware CSS variables across all pages | ✅ DONE |
| Edit Profile Dialog — Modal accessible from profile page | ✅ DONE |
| Walk Workout Type (#81) — First-class walk type across 33 files | ✅ DONE |
| New Pages — /portfolio (feature tour), /roadmap (visual timeline), /comic (14-slide origin story) | ✅ DONE |
| Monthly Review Redesign — Mobile-first, bold stats, stacked bar chart, PNG to JPG share images | ✅ DONE |
| Weekly Wrap Redesign — Social sharing redesign matching monthly review | ✅ DONE |
| Share Fix (#61) — Monthly review sharing uses images instead of login-required links | ✅ DONE |
| Dashboard Fix (#56, #60) — Unified view, fixed past workouts in "Coming up", fixed /records link (#58) | ✅ DONE |
| Recurring Workouts — Only show in Planned tab within next 7 days | ✅ DONE |
| Safari Favicon — 32x32 PNG with explicit link tags | ✅ DONE |
| Strength Form (#52) — Simplified, removed mandatory exercise details | ✅ DONE |
| PostHog Analytics — Product analytics integration with event tracking | ✅ DONE |
| Vercel Blob — Replaced Firebase Storage for backups | ✅ DONE |
| Timezone Fix Migration — `/api/workouts/fix-timezone` | ✅ DONE |
| API Playground — Interactive API explorer (88+ endpoints) in admin dashboard | ✅ DONE |

### What's Next

**Phase 6 — Retention & Viral Growth (P0):**
1. PR Achievement Cards — highest-value quick win (shareable, low effort)
2. Streak System Enhancement — counter on profiles done, still need at-risk email nudges + visual enhancements

**Phase 7 — Differentiation (P1):**
3. Milestone Badge System — collectible achievements, shareable cards
4. Race Recap Card — high-emotion post-race sharing
5. AI Race Predictions — predict finish times from training data (unique differentiator)
6. Training Plans / Programs — structured multi-week periodized programs

**Phase 8 — Scale & Social (P2):**
7. Smart Notifications — AI-powered nudges based on behavior patterns
8. Social Feed / Follow Athletes — light social layer for accountability
9. Embeddable Stats Widget — for blogs and Linktree
10. Training Block Summary — pre-event preparation report
11. Import from Other Platforms — Garmin Connect, Apple Health, Wahoo

**Phase 9 — Platform (P3):**
12. Group Challenges — time-boxed challenges with leaderboards
13. Advanced Training Load Analytics — TSS/CTL/ATL, HR zones, fitness-fatigue

**Immediate next actions:** PostHog analytics, admin dashboard, reports hub redesign, Strava overhaul, theme system, and Firestore optimization are all done. Remaining Phase 6: PR Achievement Cards + streak at-risk nudges (push infra ready, just need logic). Both are low-effort, high-impact.

---

## Appendix: Monetization (When Ready)

**Free tier (always):**
- Strava sync, manual logging, calendar, basic dashboard
- 3 AI suggestions/week
- Weekly Wrap, Monthly Review, Yearly Wrapped (with The Daily Athlete branding/watermark)
- All shareable cards (with branding — this IS your marketing)
- Public athlete profile
- Basic streak tracking

**Pro tier ($8–12/month, implement after 100+ users):**
- Unlimited AI suggestions + AI chat coach
- AI-generated reports (PDF/email)
- AI race predictions
- Structured training plans / programs
- Remove branding from shared cards (optional)
- Advanced analytics (training load, HR zones, fitness-fatigue)
- Data export (CSV/JSON)
- Priority support

**Revenue streams:**
1. Pro subscriptions (primary)
2. Team/club plans (flat rate for groups)

**Payment:** LemonSqueezy (simpler than Stripe for indie SaaS, handles global tax).

# The Daily Athlete — Product Strategy

**Focus:** Athletes-first. Reports as viral core differentiator. Coaches later.
**Team:** 2 people, ~$100/month budget, pre-launch.

---

## Part 1: Current Assessment

### What's Strong

| Area | Assessment | Notes |
|------|-----------|-------|
| **Strava Sync** | Production-ready | OAuth + webhooks + dedup + photos + routes. Well-executed. |
| **AI Suggestions** | Genuinely advanced | 3-tier pipeline (logic engine → Groq → validator), periodization-aware, fatigue-aware, deload-aware. `max_tokens: 8000` for full workout details. Better than Final Surge, TrainingPeaks. |
| **Report Engine** | Solid foundation | 6 section types, Recharts charts, AI-generated reports via Groq, PNG/PDF/email export. |
| **Onboarding** | Streamlined | 5 steps (Intro → Name → Age → Import workout history → Strava Connect). Profile completion bar on dashboard for deferred fields. |
| **Landing Page** | Polished | Simplified dark-themed design: centered hero, sport pills, 3-step how-it-works, 6-card feature grid, FAQ, CTA. Welcoming tone, no aggressive branding. |
| **Multi-Sport** | Complete | Swim, bike, run, strength, triathlon, other — all with sport-specific fields. |
| **Email System** | Working | Brevo for transactional, cron for reminders/summaries. |
| **PWA** | Production-ready | Static manifest, service worker (cache-first static, network-first nav, offline fallback), safe-area handling, installable on iOS/Android. |
| **Workouts UX** | Clean mobile-first | Compact header, AI suggestions collapsed by default, tight spacing, Garmin-style stat chips, neutral/orange color scheme. Delete planned workouts with AlertDialog confirmation. |
| **Streak Tracking** | Functional | Streak counter on dashboard stats row, profile page, and public athlete profile. Computed from consecutive completed workout days. |
| **Calendar Actions** | Production-ready | CalendarAddDropdown per day cell: Add Workout (→ form), Add Event (→ form with race tag), Add Note (inline popup saves as workout). Add Workout button centered in header. |
| **Strava Quota Safety** | Production-ready | Quota-safe POST mode sends tokens in body (zero Firestore reads). Progressive auto-sync (2d → 7d → 30d). Graceful 429 handling. `toErrorString()` prevents React error #31. |

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
| **Streak gamification** | ✅ PARTIAL — Streak counter on profile/public profile, dashboard stats row. Still missing: streak notifications, at-risk nudges, visual enhancements | MEDIUM — retention lever |
| **Firebase Spark quota** | Quota-safe POST mode mitigates but daily 50K read limit still hit by multi-user auto-sync. Consider Blaze plan upgrade. | HIGH — affects all users when quota exhausted |

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
| Race Recap Card | Not started | High-emotion share moment after race-tagged workouts |
| PR Achievement Cards | Not started | Auto-detected celebration cards for personal records |
| Milestone Badges | Not started | Achievement badges (100th workout, 1000km, streaks) |
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
| 1 | Product Analytics (PostHog) | Growth infra | HIGH — can't optimize what you can't measure | Low | **P0** |
| ~~2~~ | ~~PWA Support (Add to Home Screen)~~ | ~~Growth infra~~ | ✅ DONE | ~~Low~~ | ~~**P0**~~ |
| 3 | PR Achievement Cards (shareable) | Viral / retention | HIGH — celebration moments drive shares + dopamine | Low-Medium | **P0** |
| 4 | Streak System Enhancement | Retention | HIGH — streak counter done on profiles, still need at-risk nudges + visual enhancements | Low | **P0** |
| 5 | Milestone Badge System | Viral / retention | HIGH — auto-detected achievements, collectible + shareable | Medium | **P1** |
| 6 | Race Recap Card | Viral | HIGH — highest-emotion share moment in endurance sports | Medium | **P1** |
| 7 | AI Race Predictions | Differentiation | HIGH — predict race times based on training data | Medium | **P1** |
| 8 | Training Plans / Programs | Core product | HIGH — structured multi-week plans, not just daily suggestions | High | **P1** |
| 9 | Smart Notifications | Retention | ✅ PARTIAL — Web Push infrastructure built, used for Strava sync + wrap. Still need: AI nudges (rest day advice, streak warnings, PR alerts) | Medium | **P2** |
| 10 | Social Feed / Follow Athletes | Growth | HIGH — activity feed, kudos/reactions, follow system | High | **P2** |
| 11 | Embeddable Stats Widget | Growth | MEDIUM — for blogs, Linktree, personal sites | Medium | **P2** |
| 12 | Training Block Summary | Viral | MEDIUM — pre-event preparation report | High | **P2** |
| 13 | Import from Other Platforms | Growth | ✅ PARTIAL — CSV/XLSX import with AI extraction + programmatic date detection in onboarding. Still need: direct Garmin Connect, Apple Health, Wahoo API imports | High | **P2** |
| 14 | Group Challenges | Growth / retention | HIGH — weekly/monthly challenges between friends | High | **P3** |
| 15 | Coach Marketplace | Monetization | HIGH — coaches advertise, athletes browse and connect | Very High | **P3** |
| 16 | Advanced Training Load Analytics | Differentiation | MEDIUM — TSS/CTL/ATL fitness-fatigue chart, HR zones | High | **P3** |

### New Feature Concepts (Detailed)

**AI Race Predictions (#7):**
Based on recent training data (volume, pace trends, long run distances), predict finish times for upcoming events. "Based on your last 8 weeks: predicted marathon time 3:42–3:48." Updates weekly as training progresses. Shareable prediction card with confidence range. Athletes LOVE seeing predicted race times — this is a differentiator no competitor does well.

**Training Plans / Programs (#8):**
Move beyond single-day AI suggestions to structured multi-week programs. Athlete selects a goal event (already captured in onboarding), AI generates a periodized plan: base → build → peak → taper. Calendar integration shows the full plan. Week-by-week progression with auto-adjustment based on completed workouts. This is the feature that converts casual users to daily users.

**Social Feed / Follow Athletes (#10):**
Light social layer: follow other athletes, see their completed workouts in a feed, give kudos/reactions. NOT a full social network — just enough to create accountability loops. "Sarah completed a 10K run" → tap to congratulate. Athletes who see friends training are more likely to train themselves. Critical for retention at scale.

**Group Challenges (#14):**
Time-boxed challenges between friends or public: "Most distance in January", "7-day streak challenge", "Run 100km this month." Leaderboard, progress bars, completion badges. Shareable challenge cards. This is the feature that makes people invite friends — "Join my January challenge!"

**Coach Marketplace (#15):**
Two-sided marketplace. Coaches create profiles with specialties, pricing, athlete reviews. Athletes browse and connect via the existing coach code system. Revenue model: platform takes 10-15% of coaching fees. This is the long-term monetization play beyond subscriptions.

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

## Part 4: Recommended Execution Order

### What's Done (Phases 1–4 Original Roadmap)

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
| Workout Import in Onboarding (CSV/XLSX with AI + programmatic date detection) | ✅ DONE |
| Strava-Import Merge (auto-merge imported workouts when Strava syncs) | ✅ DONE |
| Server-Side User Creation (Admin SDK, fixes Google Sign-In registration bug) | ✅ DONE |
| Groq Model Fallback (70B → 8B instant on rate limit) | ✅ DONE |
| Admin Dashboard (`/admin`) — Firebase Auth + UID allowlist, session cookies, rate limiting, CSRF protection | ✅ DONE |
| Backup System — daily/weekly/monthly cron snapshots to Firebase Storage, integrity check, manual trigger | ✅ DONE |
| Backup Restore — full restore (with pre-restore auto-snapshot), per-user restore from any snapshot | ✅ DONE |
| Admin Users Management — list all users, soft-delete (disable Auth), restore, CSV + JSON export | ✅ DONE |
| Admin Action Log — all admin actions written to `adminLogs` with acting UID and timestamp | ✅ DONE |

### What's Next

**Phase 5 — Launch Readiness (P0):**
1. Product Analytics (PostHog) — can't optimize what you can't measure
2. ~~PWA Support~~ ✅ DONE — manifest, service worker, offline fallback, installable, safe-area handling
3. PR Achievement Cards — highest-value quick win (shareable, low effort)
4. Streak System Enhancement — ✅ counter on profiles, still need at-risk email nudges + visual enhancements

**Phase 6 — Retention & Differentiation (P1):**
5. Milestone Badge System — collectible achievements, shareable cards
6. Race Recap Card — high-emotion post-race sharing
7. AI Race Predictions — predict finish times from training data (unique differentiator)
8. Training Plans / Programs — structured multi-week periodized programs

**Phase 7 — Scale & Social (P2):**
9. Smart Notifications — AI-powered nudges based on behavior patterns
10. Social Feed / Follow Athletes — light social layer for accountability
11. Embeddable Stats Widget — for blogs and Linktree
12. Training Block Summary — pre-event preparation report
13. Import from Other Platforms — Garmin Connect, Apple Health, Wahoo

**Phase 8 — Platform (P3):**
14. Group Challenges — time-boxed challenges with leaderboards
15. Coach Marketplace — two-sided marketplace for coaching services
16. Advanced Training Load Analytics — TSS/CTL/ATL, HR zones, fitness-fatigue

**Immediate next actions:** PWA, push notifications, workout import, and Strava merge are done. Remaining Phase 5: PostHog analytics + PR Achievement Cards + streak at-risk nudges (push infra ready, just need logic). All low-effort, high-impact.

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

**Coach tier ($20–30/month, implement after coach marketplace):**
- Everything in Pro
- Manage unlimited athletes
- Assign workouts and training plans
- View all athlete dashboards
- Marketplace listing (athletes can find and connect)
- Team/group management

**Revenue streams:**
1. Pro subscriptions (primary)
2. Coach marketplace commission (10-15% of coaching fees)
3. Team/club plans (flat rate for groups)

**Payment:** LemonSqueezy (simpler than Stripe for indie SaaS, handles global tax).

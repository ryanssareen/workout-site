# Pages (updated 2026-04-17)
# Format: route — file — description

## Public / Marketing
/                    src/app/page.tsx                                       Landing page (hero, sport cards, social proof, CTA)
/features            src/app/features/page.tsx                             Marketing features page
/portfolio           src/app/portfolio/page.tsx                            Feature tour with screenshots
/roadmap             src/app/roadmap/page.tsx                              Visual phase timeline
/comic               src/app/comic/page.tsx                                14-slide origin story carousel
/privacy             src/app/privacy/page.tsx                              Privacy Policy (required for Garmin API)
/terms               src/app/terms/page.tsx                                Terms of Service (required for Garmin API)
/contact             src/app/contact/page.tsx                              Contact page
/connect-strava      src/app/connect-strava/page.tsx                       Strava connection landing page
/firebase-test       src/app/firebase-test/page.tsx                        Firebase connection test (dev)

## Auth
/login               src/app/(auth)/login/page.tsx                         Email + Google sign-in
/register            src/app/(auth)/register/page.tsx                      Email + Google sign-up (terms consent checkbox)
/choose-username     src/app/(auth)/choose-username/page.tsx               Username selection after registration
/reset-password      src/app/(auth)/reset-password/page.tsx                Request password reset email
/reset-password/confirm  src/app/(auth)/reset-password/confirm/page.tsx   Confirm new password via link

## Dashboard (protected, shared layout with Navbar + MobileBottomNav)
/dashboard           src/app/(dashboard)/dashboard/page.tsx                Main dashboard: stats, charts, upcoming workouts, recent activity
/workouts            src/app/(dashboard)/workouts/page.tsx                 Workout list with type/time filters, AI suggestions
/workouts/new        src/app/(dashboard)/workouts/new/page.tsx             Create workout (type-specific forms, AI templates, URL params: date, tag)
/workouts/[id]       src/app/(dashboard)/workouts/[id]/page.tsx            Workout detail view
/workouts/[id]/edit  src/app/(dashboard)/workouts/[id]/edit/page.tsx       Edit existing workout
/calendar            src/app/(dashboard)/calendar/page.tsx                 Calendar (day/week/month/year views, ICS export, notes)
/reports             src/app/(dashboard)/reports/page.tsx                  Reports Hub (AI insight, weekly/monthly/yearly links, deep-dive cards)
/reports/[reportType]  src/app/(dashboard)/reports/[reportType]/page.tsx  Dynamic report page (sport-deep-dive, trend-report, pr-timeline, recovery-report, goal-tracker)
/reports/training-analysis  src/app/(dashboard)/reports/training-analysis/page.tsx  Full analytics dashboard (Overview, Training, Insights, Calendar, Distribution, Duplicates)
/wrap                src/app/(dashboard)/wrap/page.tsx                     Weekly Wrap — 4-slide carousel (Mon–Sun, week-over-week comparison)
/review              src/app/(dashboard)/review/page.tsx                   Monthly Review — 5-slide carousel (stats, vs last month, calendar, breakdown)
/wrapped             src/app/(dashboard)/wrapped/page.tsx                  Yearly Wrapped — 8-slide carousel with guess game
/profile             src/app/(dashboard)/profile/page.tsx                  Read-only profile view (stats, PRs, heatmap)
/settings            src/app/(dashboard)/settings/page.tsx                 Settings (profile, privacy, Strava, appearance, account)
/ai-coach            src/app/(dashboard)/ai-coach/page.tsx                 AI coach chat interface
/onboarding          src/app/(dashboard)/onboarding/page.tsx               5-step onboarding (intro → name → age → import → strava)
/onboarding/profile  src/app/(dashboard)/onboarding/profile/page.tsx       Profile completion step (sports, experience, training goals)

## Public Athlete Profiles
/athlete/[username]          src/app/athlete/[username]/page.tsx (SSR)      Public athlete profile
/athlete/[username]/wrapped  src/app/athlete/[username]/wrapped/page.tsx    Public Yearly Wrapped sharing (privacy-gated)

## Public Workout Views
/workout/[id]                src/app/workout/[id]/page.tsx                  Public single workout view (no auth)
/preview/[username]/[id]     src/app/preview/[username]/[id]/page.tsx       Public workout preview + OG image for social sharing

## Admin (hidden, security by obscurity + auth)
/youwillneverguessthisistheadmin        src/app/youwillneverguessthisistheadmin/page.tsx       Admin dashboard
/youwillneverguessthisistheadmin/api    src/app/youwillneverguessthisistheadmin/api/page.tsx   API Playground + Registry

## Hidden / Redirects
/coach-suggestions   src/app/(dashboard)/coach-suggestions/page.tsx        Redirects → /dashboard (hidden)
/suggestions         src/app/(dashboard)/suggestions/page.tsx              Redirects → /dashboard (hidden)

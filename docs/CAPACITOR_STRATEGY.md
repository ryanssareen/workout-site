# Capacitor Strategy — The Daily Athlete iOS App

## Overview

Wrap the existing Next.js web app in a native iOS shell using Ionic Capacitor. The web app continues running on Vercel as-is. The iOS app loads the same hosted site inside a WKWebView, giving App Store distribution with zero code duplication.

**One codebase → two outputs:**
- `thedailyathlete.in` (website, unchanged)
- The Daily Athlete (iOS app on App Store)

---

## Architecture

```
┌─────────────────────────────────────┐
│           App Store (iOS)           │
│  ┌───────────────────────────────┐  │
│  │     Capacitor Native Shell    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │       WKWebView         │  │  │
│  │  │                         │  │  │
│  │  │   thedailyathlete.in    │  │  │
│  │  │   (Next.js on Vercel)   │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Native Plugins:              │  │
│  │  - Push (APNs)                │  │
│  │  - StatusBar                  │  │
│  │  - SplashScreen               │  │
│  │  - Haptics                    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────┐
│         Vercel (same deploy)        │
│  Next.js App + API Routes           │
│  Firebase Auth + Firestore          │
│  Strava OAuth + Groq AI             │
└─────────────────────────────────────┘
```

## What Changes vs. What Stays the Same

### Stays the Same
- All Next.js code, components, pages, API routes
- Firebase Auth (Google Sign-In works in WKWebView)
- Firestore data layer
- Strava OAuth flow
- AI workout suggestions
- All UI/styling (Tailwind, shadcn/ui)
- Vercel deployment pipeline
- Web version at thedailyathlete.in

### Changes / Additions
- Native push notifications (APNs instead of Web Push)
- Native splash screen and app icon
- StatusBar styling (safe areas already handled)
- App Store metadata (screenshots, description, privacy policy)
- Capacitor config pointing to live URL

---

## Implementation Plan

### Phase 1: Project Setup (Day 1)

**Prerequisites:**
- Apple Developer Account ($99/year)
- Mac with Xcode 15+ installed
- CocoaPods (`sudo gem install cocoapods`)

**Steps:**

```bash
# From project root
npm install @capacitor/core @capacitor/cli

# Initialize Capacitor
npx cap init "The Daily Athlete" "in.thedailyathlete.app" \
  --web-dir=out

# Add iOS platform
npm install @capacitor/ios
npx cap add ios
```

**Configure `capacitor.config.ts`:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.thedailyathlete.app',
  appName: 'The Daily Athlete',

  // Point to live site instead of bundled assets
  server: {
    url: 'https://thedailyathlete.in',
    cleartext: false,
  },

  ios: {
    scheme: 'The Daily Athlete',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
```

### Phase 2: Native Plugins (Day 1-2)

**Install core plugins:**

```bash
npm install @capacitor/push-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/haptics
npm install @capacitor/app

# Sync native project
npx cap sync ios
```

**Push Notifications (APNs):**

The app already has Web Push (`src/components/PushNotificationManager.tsx`). For iOS native, create a platform-aware wrapper:

```typescript
// src/lib/push-native.ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export async function registerPush() {
  if (Capacitor.isNativePlatform()) {
    // Native APNs
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive === 'granted') {
      await PushNotifications.register();
    }

    PushNotifications.addListener('registration', (token) => {
      // Send APNs token to server
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'apns',
          token: token.value
        }),
      });
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Handle foreground notification
      console.log('Push received:', notification);
    });
  } else {
    // Web Push (existing implementation)
    // ... existing PushNotificationManager logic
  }
}
```

**Server-side APNs support:**

Add to `/api/push/subscribe` to handle both Web Push and APNs tokens. Use `apn` npm package to send APNs notifications alongside existing `web-push`.

### Phase 3: App Store Assets (Day 2)

**Required assets:**

| Asset | Size | Notes |
|-------|------|-------|
| App Icon | 1024x1024 | No transparency, no rounded corners |
| Splash Screen | 2732x2732 | Centered logo on white background |
| Screenshots (6.7") | 1290x2796 | iPhone 15 Pro Max, at least 3 |
| Screenshots (6.5") | 1284x2778 | iPhone 14 Plus, at least 3 |
| Screenshots (5.5") | 1242x2208 | iPhone 8 Plus (optional) |

**App Store metadata:**

```
Name: The Daily Athlete
Subtitle: Your training, all in one place
Category: Health & Fitness
Price: Free (with in-app subscription)

Description:
Track every workout across every sport. The Daily Athlete brings your
running, cycling, swimming, strength training, and walking into one
beautiful dashboard.

Keywords:
workout tracker, fitness, running, cycling, swimming, training log,
strava sync, multi-sport, exercise tracker

Privacy URL: https://thedailyathlete.in/privacy
Support URL: https://thedailyathlete.in/support
```

### Phase 4: Build & Submit (Day 2-3)

```bash
# Sync latest changes
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**In Xcode:**
1. Set signing team (Apple Developer Account)
2. Set bundle ID: `in.thedailyathlete.app`
3. Set deployment target: iOS 16.0+
4. Add push notification capability
5. Add associated domains (for universal links, optional)
6. Archive → Distribute → App Store Connect

**App Store Connect:**
1. Create app listing
2. Upload build via Xcode
3. Fill metadata, screenshots, privacy details
4. Submit for review (typically 24-48 hours)

---

## App Store Review Considerations

Apple reviews web-wrapped apps more carefully. Key requirements:

1. **Must provide native value beyond the website** — push notifications, app icon on home screen, and native feel count toward this
2. **Must work with the WKWebView** — no falling back to Safari
3. **Privacy policy required** — must be hosted at a public URL
4. **No external payment links** — if you add subscriptions, use StoreKit (Apple's in-app purchase) for iOS, not Stripe/Razorpay directly
5. **Guideline 4.2 (Minimum Functionality)** — Apple may reject if the app is "just a website." Mitigate by: adding native push, haptic feedback on workout completion, native splash screen, and ensuring the PWA feels like a native app

---

## In-App Purchases (Subscriptions)

If offering paid tiers (Starter ₹499/mo, Pro ₹1,499/mo) on iOS:

- **Must use Apple's StoreKit** for in-app purchases (Apple takes 15-30% cut)
- **Cannot link to external payment** (no "subscribe on our website" buttons)
- **Web version can use Razorpay/Stripe** — Apple's rules only apply to iOS app
- **Reader Rule exception** — if your app qualifies, you may link to web for account management

**Implementation approach:**
- Use `@capacitor/in-app-purchases` or RevenueCat SDK
- Detect platform: StoreKit on iOS, Razorpay on web
- Server validates receipts and sets subscription status in Firestore
- Both platforms read the same `subscription` field on the user doc

---

## Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Account | $99 (₹8,300) | Annual |
| Vercel (existing) | $0 (Hobby) | Monthly |
| Firebase (existing) | $0 (Spark) | Monthly |
| Capacitor | $0 (open source) | — |
| **Total additional** | **$99/year** | — |

Apple takes 15% (first year, Small Business Program) or 30% of in-app subscription revenue.

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Capacitor setup + config | 2-3 hours |
| 2 | Native plugins (push, status bar, haptics) | 3-4 hours |
| 3 | App Store assets (icons, screenshots, metadata) | 2-3 hours |
| 4 | Xcode build + test on device | 1-2 hours |
| 5 | App Store Connect submission | 1 hour |
| 6 | **Apple review** | **24-48 hours** |
| | **Total development time** | **~1-2 days** |

---

## File Structure (new files only)

```
workout-site/
├── capacitor.config.ts          # Capacitor configuration
├── ios/                         # Generated by `cap add ios`
│   └── App/
│       ├── App/
│       │   ├── Assets.xcassets/  # App icons, splash
│       │   └── Info.plist        # iOS config
│       └── Podfile               # CocoaPods deps
├── src/
│   └── lib/
│       └── push-native.ts       # Platform-aware push (new)
└── public/
    └── apple-app-site-association  # Universal links (optional)
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Apple rejects as "just a website" | Medium | Add native push, haptics, splash screen. Ensure smooth native feel. |
| Google Sign-In fails in WKWebView | Low | Firebase Auth handles this — WKWebView supports OAuth redirects. Test on device. |
| Safe area issues on notched iPhones | Low | Already handled with `env(safe-area-inset-*)` inline styles. |
| Strava OAuth redirect fails | Low | Ensure `thedailyathlete.in` is in Strava's redirect URIs. Works in WKWebView. |
| Apple subscription requirement | Medium | If charging, must use StoreKit on iOS. Web can use any payment provider. |
| App size concerns | None | App is tiny (~5MB) since all content loads from Vercel. |

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Live URL vs bundled assets | Live URL | Same deployment, instant updates, no app store update needed for web changes |
| Push: APNs vs Web Push | APNs for iOS, Web Push for web | APNs is required for reliable iOS notifications |
| Offline strategy | Network-required (same as web) | Full offline needs local DB + sync engine — out of scope for v1 |
| Payment on iOS | StoreKit (if paid tiers added) | Apple requirement, no alternative |
| Minimum iOS version | 16.0 | Covers 95%+ of active iPhones, good WKWebView support |

# Capacitor iOS App Strategy

## Overview

Deploy The Daily Athlete as a native iOS app on the App Store using **Ionic Capacitor** — a free, open-source bridge that wraps our existing Next.js web app in a native iOS shell. Same codebase serves both `thedailyathlete.in` (web) and the App Store (iOS).

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              App Store (iOS)                │
│  ┌───────────────────────────────────────┐  │
│  │        Capacitor Native Shell         │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │         WKWebView               │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │   Next.js App (same code) │  │  │  │
│  │  │  │   thedailyathlete.in      │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  Native Plugins:                      │  │
│  │  - Push Notifications (APNs)          │  │
│  │  - Status Bar                         │  │
│  │  - Splash Screen                      │  │
│  │  - Haptics                            │  │
│  │  - App Badge                          │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Web (unchanged)                │
│  Vercel → thedailyathlete.in               │
│  Same Next.js app, same Firestore          │
└─────────────────────────────────────────────┘
```

## Why Capacitor

| Factor | Capacitor | PWA Wrapper (PWABuilder) | React Native |
|--------|-----------|--------------------------|--------------|
| Cost | Free (MIT) | Free | Free |
| Code reuse | 100% same codebase | 100% same codebase | Full rewrite |
| Native APIs | Yes (plugins) | Very limited | Yes |
| Push notifications | APNs (native) | Not on iOS | APNs (native) |
| App Store approval | High success rate | Risk of rejection | High success rate |
| Development effort | 1-2 days setup | Hours | Weeks/months |
| Offline support | Service Worker + plugins | Service Worker only | Full native |

## Requirements

### Apple Developer Account
- **Cost:** $99/year (mandatory, no alternative)
- **Enrollment:** [developer.apple.com](https://developer.apple.com)
- Requires Apple ID, personal or organization enrollment
- Takes 24-48 hours for approval

### Development Tools
- **Mac with Xcode** (latest version, free from App Store)
- **Node.js** (already have)
- **CocoaPods** (`sudo gem install cocoapods`)
- **Capacitor CLI** (`npm install @capacitor/core @capacitor/cli`)

---

## Implementation Plan

### Phase 1: Setup (Day 1)

```bash
# Install Capacitor in existing project
npm install @capacitor/core @capacitor/cli
npx cap init "The Daily Athlete" "in.thedailyathlete.app" --web-dir=out

# Add iOS platform
npm install @capacitor/ios
npx cap add ios
```

**capacitor.config.ts:**
```typescript
import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'in.thedailyathlete.app',
  appName: 'The Daily Athlete',
  webDir: 'out',
  server: {
    // Point to live site (online mode)
    url: 'https://thedailyathlete.in',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
```

### Phase 2: Native Plugins (Day 1-2)

```bash
# Install native plugins
npm install @capacitor/push-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/haptics
npm install @capacitor/badge
npm install @capacitor/browser  # for OAuth redirects
```

**Push Notifications (APNs):**
- Replace web-push with native APNs for iOS
- Detect platform in `PushNotificationManager.tsx`:

```typescript
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

if (Capacitor.isNativePlatform()) {
  // Use native APNs
  const result = await PushNotifications.requestPermissions();
  if (result.receive === 'granted') {
    await PushNotifications.register();
  }
  PushNotifications.addListener('registration', (token) => {
    // Send APNs token to server
    fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ token: token.value, platform: 'ios' }),
    });
  });
} else {
  // Existing web-push logic
}
```

**Strava OAuth:**
- Use `@capacitor/browser` for OAuth redirect flow
- Deep link back to app: `in.thedailyathlete.app://callback`
- Register URL scheme in `Info.plist`

### Phase 3: App Assets (Day 2)

**Required assets:**
- App Icon: 1024x1024px (Xcode auto-generates all sizes)
- Splash Screen: 2732x2732px centered logo on dark background
- App Store Screenshots:
  - iPhone 6.9" (1320x2868) — iPhone 16 Pro Max
  - iPhone 6.7" (1290x2796) — iPhone 15 Pro Max
  - iPad 13" (2064x2752) — iPad Pro
- App Store metadata: description, keywords, category (Health & Fitness)

**Reuse existing assets:**
- `public/icons/icon-512.png` → scale up to 1024x1024
- `public/icons/icon-maskable-512.png` → adaptive icon source
- Screenshots from live site

### Phase 4: Build & Test (Day 2-3)

```bash
# Sync web assets to iOS project
npx cap sync ios

# Open in Xcode
npx cap open ios

# In Xcode:
# 1. Select signing team (Apple Developer account)
# 2. Set bundle identifier: in.thedailyathlete.app
# 3. Enable Push Notifications capability
# 4. Enable Associated Domains (for deep links)
# 5. Build & run on simulator
# 6. Test on physical device
```

### Phase 5: App Store Submission (Day 3-4)

1. **App Store Connect** → Create new app
2. Fill in metadata:
   - Name: The Daily Athlete
   - Subtitle: Your training, all in one place
   - Category: Health & Fitness
   - Price: Free (in-app subscriptions later)
3. Upload build from Xcode (Archive → Distribute)
4. Submit for review (typically 24-48 hours)

---

## Deployment Workflow (Ongoing)

### Web Updates (no App Store review needed)
```
Code change → git push → Vercel deploys → iOS app loads new version automatically
```

Since the iOS app points to `thedailyathlete.in`, any web deployment instantly updates both web and iOS. No App Store review needed for content/feature changes.

### Native Updates (requires App Store review)
Only needed when changing:
- Capacitor plugins
- Native configuration (Info.plist)
- App icon or splash screen
- iOS-specific code

---

## Platform Detection

Add platform detection utility:

```typescript
// src/lib/platform.ts
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isWeb = () => Capacitor.getPlatform() === 'web';
```

Use for conditional behavior:
- Hide "Install App" PWA prompt on native
- Use native share sheet instead of Web Share API
- Show "Rate on App Store" prompt after X workouts
- Native haptic feedback on workout completion

---

## Monetization (App Store)

### In-App Subscriptions
Apple takes 30% cut (15% for small businesses <$1M revenue).

| Tier | Web Price | App Store Price (after Apple cut) |
|------|-----------|-----------------------------------|
| Starter | ₹499/mo | ₹649/mo (to net ~₹499) |
| Pro | ₹1,499/mo | ₹1,949/mo (to net ~₹1,499) |

**Options:**
1. **Same price everywhere** — accept lower margin on iOS
2. **Higher iOS price** — pass Apple's cut to users
3. **Web-only subscriptions** — direct users to website for payment (Apple may reject)
4. **Free app, premium features** — freemium model, subscriptions via web

### Recommended: Option 1
Keep prices consistent. The App Store presence drives downloads and trust. Absorb the 15-30% cut as customer acquisition cost.

---

## iOS-Specific Enhancements (Future)

| Feature | Plugin | Effort |
|---------|--------|--------|
| Apple Health integration | `@capacitor/health` | Medium |
| Siri Shortcuts ("Log my run") | Custom plugin | Medium |
| Widgets (workout summary) | Swift WidgetKit | High |
| Watch app | WatchOS (separate) | High |
| Face ID for admin | `@capacitor/biometrics` | Low |
| Offline data sync | `@capacitor/preferences` + SQLite | High |
| Live Activities (workout timer) | ActivityKit | Medium |

---

## Timeline

| Day | Task | Status |
|-----|------|--------|
| 1 | Apple Developer enrollment ($99) | Pending |
| 1 | Install Capacitor, configure project | Pending |
| 1-2 | Add native plugins (push, status bar, splash) | Pending |
| 2 | Create app assets (icon, splash, screenshots) | Pending |
| 2-3 | Build, test on simulator + physical device | Pending |
| 3 | Set up App Store Connect, fill metadata | Pending |
| 3-4 | Submit for review | Pending |
| 4-5 | App live on App Store | Pending |

**Total estimated time: 3-5 days** (after Apple Developer account is approved)

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Account | $99 | Annual |
| Capacitor | Free | — |
| Xcode | Free | — |
| Vercel hosting | Free (Hobby) | — |
| Firebase | Free (Spark) | — |
| **Total** | **$99/year** | — |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| App Store rejection (too much like a website) | Add native features: push, haptics, splash screen, status bar customization |
| Apple subscription cut (30%) | Start with free tier, add subscriptions later when user base justifies it |
| Strava OAuth redirect issues | Use `@capacitor/browser` + URL schemes for clean redirect flow |
| Safe area insets different in native | Already handled with `env(safe-area-inset-*)` inline styles |
| Offline limitations | Acceptable — Strava, Nike Run Club all require connectivity too |

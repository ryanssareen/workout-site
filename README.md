# The Daily Athlete - Coach & Athlete Platform

A modern workout tracking platform connecting coaches with athletes. Built with Next.js 16, React 19, Firebase, and TypeScript.

## ✨ Features

### Core Functionality
- **User Authentication**: Email/password + Google Sign-In with role-based access (Coach/Athlete)
- **Workout Management**: Create, read, update, and delete workouts with flat list view and type filter tags
- **Multi-Sport Support**: Running, Cycling, Swimming, Strength Training, Triathlon, and Other
- **Calendar View**: 2-week desktop calendar with workout type differentiation and color coding
- **Date Scheduling**: Schedule workouts with specific dates and durations
- **Completion Tracking**: Athletes mark workouts as complete with actual stats (distance, duration, heart rate)
- **Strava Integration**: OAuth connection, auto-sync via webhooks, manual sync with duplicate detection
- **Dark Mode**: Full light/dark theme support with toggle

### Profile & Onboarding
- **3-Step Onboarding**: Sports selection → Training goals (with event name & date) → About you (age, experience, body metrics)
- **Profile Page**: Public-style view with stats grid, training breakdown pie chart, recent workouts, and personal records
- **Public Athlete Profiles**: Shareable `/athlete/[username]` pages with AI-generated taglines
- **Profile Photo Upload**: Firebase Storage-backed avatar uploads with compression
- **Edit Profile in Settings**: Full profile form (name, bio, timezone, sports, goals, body metrics) lives in `/settings`

### AI-Powered Features
- **AI Workout Suggestions**: Personalized workout recommendations based on training history and goals
- **AI Coach Chat**: Conversational AI coach with thread history
- **Dynamic Reports**: Structured JSON reports with charts, tables, stat cards, and PR badges
- **Profile Taglines**: AI-generated athlete taglines
- **Whiteboard Vision**: Upload photos of workout plans for automatic extraction

### User Roles
- **Coaches**: Create, edit, assign workouts; view all athletes' data; generate reports; unique 6-letter coach code
- **Athletes**: View/complete assigned workouts; track progress; connect Strava; share public profile

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix primitives
- **Authentication**: Firebase Auth (email/password + Google Sign-In)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (profile photos)
- **AI**: Groq SDK + OpenAI SDK (workout suggestions, reports, taglines, vision)
- **Email**: Nodemailer (Gmail SMTP) + Brevo
- **Integrations**: Strava API (OAuth + webhooks)
- **Charts**: Recharts + custom SVG pie charts
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod
- **Deployment**: Vercel

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0 or later
- **npm** or **yarn** package manager
- **Firebase account** (free tier works)
- **OpenAI API key** (optional, only for whiteboard vision feature)
- **Git** for version control

## 🚀 Getting Started

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
4. Click "Save"

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

Create a `.env.local` file in the project root and add your Firebase credentials:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# OpenAI Configuration (Optional - for whiteboard vision)
OPENAI_API_KEY=sk-your-openai-api-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Important**: Never commit `.env.local` to version control. It's already in `.gitignore`.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Firebase Security Rules

After testing, update your Firestore security rules for production:

1. Go to Firebase Console → Firestore Database → Rules
2. Replace with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isCoach() {
      return getUserData().role == 'coach';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && isOwner(userId);
    }
    
    // Workouts collection
    match /workouts/{workoutId} {
      allow read: if isAuthenticated() && (
        resource.data.createdBy == request.auth.uid ||
        resource.data.assignedTo == request.auth.uid
      );
      allow create: if isAuthenticated() && isCoach();
      allow update: if isAuthenticated() && resource.data.createdBy == request.auth.uid;
      allow delete: if isAuthenticated() && resource.data.createdBy == request.auth.uid;
    }
  }
}
```

3. Click "Publish"

## 🚢 Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure environment variables (copy from `.env.local`)
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

### Environment Variables in Vercel

Add all variables from `.env.local` in Vercel dashboard:
- Settings → Environment Variables
- Add each variable separately
- Update `NEXT_PUBLIC_APP_URL` to your Vercel URL

## 📱 Usage Guide

### For Coaches

1. **Register**: Create account with "Coach" role — get a unique 6-letter code
2. **Create Workouts**:
   - Go to Workouts → "Create Workout"
   - Choose manual entry or upload whiteboard photo
   - Fill in workout details (name, type, description, date)
   - Assign to an athlete
3. **Manage Workouts**: Flat list view with type filter tags (All/Run/Bike/Swim/Strength/Other)
4. **Track Progress**: View dashboard, reports, and athlete profiles
5. **AI Reports**: Generate detailed performance reports with charts and insights

### For Athletes

1. **Register**: Create account with "Athlete" role — enter coach's 6-letter code
2. **Onboarding**: Complete 3-step profile setup (sports, goals with event details, personal info)
3. **View Workouts**: See all assigned workouts filtered by type, click for details
4. **Complete Workouts**: Mark workouts as done with actual stats
5. **Connect Strava**: Auto-sync activities from Strava with duplicate detection
6. **Profile**: View your stats, training breakdown pie chart, recent workouts, and PRs
7. **Public Profile**: Share your `/athlete/[username]` page with AI-generated tagline
8. **Edit Profile**: Update all settings in the Settings page

## 📁 Project Structure

```
workout-site/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages (login, register, reset-password)
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── workouts/      # Workouts list (flat view with type filters)
│   │   │   ├── calendar/      # Calendar view (2-week desktop)
│   │   │   ├── profile/       # Read-only profile (stats, charts, PRs)
│   │   │   ├── settings/      # Profile editing, Strava, account settings
│   │   │   ├── onboarding/    # 3-step onboarding (sports, goals, about)
│   │   │   ├── reports/       # AI-generated reports
│   │   │   ├── ai-coach/      # AI coach chat
│   │   │   ├── progress/      # Progress tracking
│   │   │   └── records/       # Personal records
│   │   ├── athlete/[username]/ # Public athlete profiles (SSR)
│   │   ├── api/               # API routes (ai, auth, cron, reports, strava, webhooks, workouts)
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── auth/              # Login/register forms (Google + email)
│   │   ├── calendar/          # Calendar views, TYPE_CONFIG, getTypeData
│   │   ├── dashboard/         # Navbar, ProfileCompletionBar
│   │   ├── profile/           # ProfileComponents (shared), PhotoUpload
│   │   ├── reports/           # ReportContainer, ReportRenderer, sections
│   │   ├── strava/            # DuplicateDialog
│   │   ├── workouts/          # WorkoutCard, WorkoutForm, AI suggestions, ShareWorkoutCard
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── analytics.ts       # Workout analytics (summary, type distribution)
│   │   ├── firebase/          # Firebase config, auth, firestore, admin
│   │   ├── email/             # Email templates and sending
│   │   ├── schemas/           # Zod schemas (profile: SPORT_OPTIONS, TRAINING_FOR_OPTIONS)
│   │   ├── stores/            # Zustand state management
│   │   └── utils.ts           # Utility functions
│   └── types/                  # TypeScript types (index, workout, reports, ai)
├── public/                     # Static assets
├── package.json
└── README.md
```

## 🔧 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🎨 Customization

### Adding New Workout Types

1. Update `WorkoutType` in `src/types/index.ts`
2. Update the Zod enum in `src/lib/schemas/workout.ts`
3. Add type config (emoji, color) in `src/components/calendar/types.ts` → `TYPE_CONFIG`
4. Add to `TYPE_EMOJI`, `TYPE_COLORS`, `SPORT_LABELS` in `src/components/profile/ProfileComponents.tsx`
5. Update form select options in `WorkoutForm.tsx`

### Adding New Sports to Profile

1. Add to `SPORT_OPTIONS` in `src/lib/schemas/profile.ts`
2. Add emoji mapping in `src/app/(dashboard)/onboarding/profile/page.tsx` → `SPORT_EMOJI`

### Changing Theme Colors

Edit `src/app/globals.css` to customize colors:
```css
@layer base {
  :root {
    --primary: 220 70% 50%;  /* Your brand color */
  }
}
```

## 🐛 Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are set correctly
- Check Firebase project settings match `.env.local`
- Ensure Firestore is created and in test mode initially

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Authentication Not Working
- Check Firebase Authentication is enabled
- Verify email/password provider is active
- Check browser console for error messages

## 📚 Documentation Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions

---

Built with ❤️ using Next.js and Firebase


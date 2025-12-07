# Workout Tracker - Coach & Student Platform

A modern web application for coaches to create and assign workouts to their students. Built with Next.js, Firebase, and TypeScript.

## ✨ Features

### Core Functionality
- **User Authentication**: Email/password authentication with role-based access (Coach/Student)
- **Workout Management**: Create, read, update, and delete workouts
- **Multi-Sport Support**: Swim, Run, Bike, and Strength training types
- **Date Scheduling**: Schedule workouts with specific dates and durations
- **Completion Tracking**: Students can mark workouts as complete
- **Dark Mode**: Full light/dark theme support with toggle

### AI-Powered Features
- **Whiteboard Vision**: Upload photos of workout plans written on whiteboards
- **Auto-Extraction**: AI automatically extracts workout details from images
- **Smart Parsing**: Converts handwritten notes into structured workout data

### User Roles
- **Coaches**: Create, edit, delete workouts; assign to students
- **Students**: View assigned workouts; mark as complete

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **UI Components**: shadcn/ui + Radix UI
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **AI Vision**: OpenAI GPT-4 Vision API
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

1. **Register**: Create account with "Coach" role
2. **Create Workouts**: 
   - Go to Dashboard → "Create Workout"
   - Choose manual entry or upload whiteboard photo
   - Fill in workout details (name, type, description, date)
   - Assign to a student
3. **Manage Workouts**: View, edit, or delete from workouts list
4. **Track Progress**: See completion status on dashboard

### For Students

1. **Register**: Create account with "Student" role
2. **View Workouts**: See all assigned workouts on dashboard
3. **Complete Workouts**: Mark workouts as done when finished
4. **Track History**: Review past workouts

## 📁 Project Structure

```
workout-site/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── dashboard/
│   │   │   └── workouts/
│   │   ├── api/               # API routes
│   │   │   ├── vision/        # AI vision processing
│   │   │   └── workouts/      # Workout CRUD
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── auth/              # Login/register forms
│   │   ├── dashboard/         # Nav, theme toggle
│   │   ├── workouts/          # Workout components
│   │   ├── providers/         # Context providers
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── firebase/          # Firebase config & helpers
│   │   ├── schemas/           # Zod validation schemas
│   │   ├── stores/            # Zustand state management
│   │   └── utils.ts           # Utility functions
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── public/                     # Static assets
├── .env.local                  # Environment variables (not in git)
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

1. Update `src/types/index.ts`:
```typescript
export type WorkoutType = 'swim' | 'run' | 'bike' | 'strength' | 'yoga'; // Add 'yoga'
```

2. Update `src/lib/schemas/workout.ts`:
```typescript
type: z.enum(['swim', 'run', 'bike', 'strength', 'yoga'])
```

3. Update form select options in `WorkoutForm.tsx`

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
```


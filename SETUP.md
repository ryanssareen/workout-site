# 🚀 Quick Setup Guide

This guide will walk you through setting up the Workout Tracker application from scratch in approximately 15-20 minutes.

## Step 1: Firebase Project Setup (5 minutes)

### Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. **Project name**: Enter "workout-tracker" (or your preferred name)
4. **Google Analytics**: Toggle OFF (optional for this project)
5. Click "Create project" and wait for completion
6. Click "Continue" when ready

### Enable Email/Password Authentication

1. In left sidebar, click **Build → Authentication**
2. Click "Get started" button
3. Under "Sign-in method" tab, click "Email/Password"
4. Toggle "Enable" to ON
5. Click "Save"

✅ Authentication is now configured!

### Create Firestore Database

1. In left sidebar, click **Build → Firestore Database**
2. Click "Create database" button
3. **Location**: Choose region closest to your users (e.g., `us-central`)
4. **Security rules**: Select "Start in test mode"
   - ⚠️ Note: We'll update security rules later
5. Click "Enable"
6. Wait for database provisioning (30-60 seconds)

✅ Database is ready!

### Get Firebase Credentials

1. Click the **⚙️ gear icon** → "Project settings"
2. Scroll down to "Your apps" section
3. Click the **</>** (Web) icon to add a web app
4. **App nickname**: Enter "workout-tracker-web"
5. ❌ Uncheck "Set up Firebase Hosting" (we're using Vercel)
6. Click "Register app"
7. **Copy the configuration object** - you'll need these values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",              // Copy this
  authDomain: "workout-...",      // Copy this
  projectId: "workout-...",       // Copy this
  storageBucket: "workout-...",   // Copy this
  messagingSenderId: "123...",    // Copy this
  appId: "1:123..."               // Copy this
};
```

8. Click "Continue to console"

✅ Firebase configuration obtained!

## Step 2: Configure Environment Variables (2 minutes)

1. Open the project in your code editor (VS Code recommended)
2. Locate the `.env.local` file in the project root
3. Replace the placeholder values with your Firebase credentials:

```bash
# Before (placeholders)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here

# After (your actual values from Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB9x...actual_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=workout-tracker-abc123.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=workout-tracker-abc123
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=workout-tracker-abc123.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

4. **(Optional)** For AI whiteboard vision, add OpenAI API key:
   - Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Add: `OPENAI_API_KEY=sk-proj-...your_key`
   - ⚠️ Skip this if you don't need whiteboard image processing

5. Save the `.env.local` file

✅ Environment configured!

## Step 3: Install Dependencies & Run (3 minutes)

```bash
# Navigate to project directory
cd workout-site

# Install all dependencies
npm install

# Start development server
npm run dev
```

**Expected output:**
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

Open http://localhost:3000 in your browser!

✅ App is running locally!

## Step 4: Test the Application (3 minutes)

### Create Coach Account

1. Visit http://localhost:3000
2. Click "Sign Up"
3. Fill in the form:
   - **Full Name**: John Coach
   - **Email**: coach@test.com
   - **Password**: test123 (minimum 6 characters)
   - **Role**: Select "Coach"
4. Click "Sign Up"
5. You'll be redirected to the dashboard

### Create a Workout

1. Click "Create Workout" button
2. Fill in the form:
   - **Name**: Morning Run
   - **Type**: Run
   - **Description**: 5K easy pace
   - **Date**: Select tomorrow's date
   - **Duration**: 30 minutes
   - **Assign to**: Your own UID (it will be visible)
3. Click "Save Workout"

### View Dashboard

- Check dashboard statistics (should show 1 total workout)
- View upcoming workouts section

✅ Basic functionality tested!

## Step 5: Deploy to Vercel (5 minutes)

### Push to GitHub

First, ensure your GitHub repository is set up:

```bash
# Check remote URL
git remote -v


# If not set, add your repository
git remote add origin https://github.com/YOUR_USERNAME/workout-site.git

# Push all commits
git push -u origin main
```

If you encounter authentication issues, use a personal access token:
- Go to GitHub Settings → Developer settings → Personal access tokens
- Generate new token with `repo` scope
- Use token as password when pushing

### Deploy to Vercel

1. Visit [vercel.com](https://vercel.com) and sign in (use GitHub)
2. Click "Add New..." → "Project"
3. Import your `workout-site` repository
4. **Framework Preset**: Next.js (auto-detected)
5. **Root Directory**: Leave as "./"
6. Click "Environment Variables" to expand

### Add Environment Variables

Add each variable from your `.env.local` file:

**Variable Name** → **Value**
- `NEXT_PUBLIC_FIREBASE_API_KEY` → (your Firebase API key)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` → (your Firebase auth domain)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` → (your Firebase project ID)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` → (your Firebase storage bucket)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` → (your Firebase sender ID)
- `NEXT_PUBLIC_FIREBASE_APP_ID` → (your Firebase app ID)
- `OPENAI_API_KEY` → (your OpenAI key - optional)
- `NEXT_PUBLIC_APP_URL` → Leave blank for now (will update after deployment)

Click "Deploy"!

### Update App URL

After deployment:
1. Vercel will assign a URL like: `https://workout-site-xyz.vercel.app`
2. Go to Vercel project → Settings → Environment Variables
3. Update `NEXT_PUBLIC_APP_URL` with your Vercel URL
4. Redeploy (Deployments → ⋯ → Redeploy)

✅ App is live on the internet!

## Step 6: Update Firebase Security Rules (3 minutes)

⚠️ **Important**: The default "test mode" rules allow anyone to read/write your database. Update them for production:

1. Go to Firebase Console → Firestore Database → Rules
2. Replace the existing rules with:

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

✅ Your database is now secure!

## 🎉 You're Done!

Your workout tracker is now:
- ✅ Running locally at http://localhost:3000
- ✅ Deployed to Vercel at your custom URL
- ✅ Connected to Firebase for auth and database
- ✅ Secured with proper Firestore rules
- ✅ Ready for production use!

## 📱 Next Steps

### Test with Multiple Users

1. **Create a student account**:
   - Open incognito window
   - Sign up as a student
   - Note your student UID from dashboard

2. **Assign workout to student**:
   - Login as coach (main window)
   - Create workout
   - Assign to student UID
   
3. **Test student view**:
   - Switch to incognito window
   - Student should see assigned workout
   - Mark as complete

### Optional: Enable Whiteboard Vision

If you added the OpenAI API key:
1. Go to "Create Workout" page
2. Switch to "Vision Upload" tab
3. Upload a photo of workout notes
4. AI will extract workout details

### Share Your App

Your Vercel URL is publicly accessible:
- Share with your team
- Add coaches and students
- Start tracking workouts!

## 🐛 Troubleshooting

### Issue: "Firebase: Error (auth/invalid-api-key)"
**Solution**: Double-check your Firebase API key in `.env.local` and Vercel environment variables

### Issue: "Cannot read workouts"
**Solution**: 
1. Ensure Firestore security rules are published
2. Check user is authenticated (reload page)
3. Verify workouts exist in Firestore console

### Issue: Build fails on Vercel
**Solution**:
```bash
# Test build locally first
npm run build

# If it works locally, check Vercel logs
# Common issue: Missing environment variables
```

### Issue: Dark mode not working
**Solution**: Clear browser cache and reload

### Need Help?

- Check the [README.md](./README.md) for detailed documentation
- Review [Firebase docs](https://firebase.google.com/docs)
- Check [Next.js docs](https://nextjs.org/docs)
- Open an issue on GitHub

---

**Total Setup Time**: ~15-20 minutes
**Status**: Production Ready ✅

# 🔥 Complete Firebase Setup Instructions

## Overview
This guide will walk you through setting up Firebase for your Workout Tracker application.

**Estimated Time**: 10-15 minutes

---

## 📋 Prerequisites

- [ ] Firebase Console open: https://console.firebase.google.com/
- [ ] Google account signed in
- [ ] Text editor ready for .env.local

---

## Step 1: Create Firebase Project (3 minutes)

1. **Open Firebase Console**: https://console.firebase.google.com/
2. Click "**Add project**" or "**Create a project**"
3. **Project name**: `workout-tracker` (or your choice)
4. Click "**Continue**"
5. **Google Analytics**: Toggle OFF (not needed)
6. Click "**Create project**"
7. Wait ~30 seconds for creation
8. Click "**Continue**"

✅ **Checkpoint**: You should now see your project dashboard

---

## Step 2: Enable Authentication (2 minutes)

1. In left sidebar, click "**Build**" → "**Authentication**"
2. Click "**Get started**"
3. Under "**Sign-in method**" tab, click "**Email/Password**"
4. **Enable** the first toggle (Email/Password)
5. Leave "Email link" disabled
6. Click "**Save**"

✅ **Checkpoint**: You should see "Email/Password" with status "Enabled"

---

## Step 3: Create Firestore Database (3 minutes)

1. In left sidebar, click "**Build**" → "**Firestore Database**"
2. Click "**Create database**"
3. **Location**: Choose closest to you (e.g., us-central, europe-west)
   - ⚠️ Cannot be changed later!
4. **Security rules**: Select "**Start in test mode**"
   - We'll add proper rules later
5. Click "**Next**"
6. Click "**Enable**"
7. Wait ~30 seconds for database creation

✅ **Checkpoint**: You should see empty Firestore database with "Start collection" button

---

## Step 4: Register Web App & Get Config (3 minutes)

1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Click "**Project settings**"
3. Scroll to "**Your apps**" section
4. Click the **web icon** (`</>`)
5. **App nickname**: `workout-tracker-web`
6. ❌ **DO NOT** check "Firebase Hosting"
7. Click "**Register app**"
8. You'll see a **config object** like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

9. **COPY THIS ENTIRE OBJECT** - you'll need it next!
10. Click "**Continue to console**"

---

## Step 5: Update .env.local (2 minutes)

1. Open your project in VS Code or text editor
2. Open file: `/Users/ryan/Documents/workout-site/.env.local`
3. Replace the placeholder values with your Firebase config:

```bash
# Firebase Configuration (REPLACE WITH YOUR VALUES!)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123

# OpenAI Configuration (Optional - for whiteboard vision)
OPENAI_API_KEY=sk-your-openai-key-here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Save the file** (Cmd+S / Ctrl+S)

⚠️ **IMPORTANT**: Restart your dev server after changing .env.local!

---

## Step 6: Test Firebase Connection (2 minutes)

1. **Stop** current dev server (Ctrl+C in terminal)
2. **Start** dev server:
   ```bash
   cd /Users/ryan/Documents/workout-site
   npm run dev
   ```
3. Open browser: http://localhost:3000/firebase-test
4. Click "**Run All Tests**"
5. All tests should show "✓ Success"

✅ **All tests passing?** → Firebase is configured correctly!
❌ **Any test failing?** → See troubleshooting below

---

## Step 7: Set Firestore Security Rules (3 minutes)

⚠️ **IMPORTANT**: Test mode allows anyone to read/write. Add security rules!

1. Go to Firebase Console → **Firestore Database**
2. Click "**Rules**" tab
3. Replace the content with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
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
    
    // Test collection (for connection tests)
    match /test_connection/{docId} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

4. Click "**Publish**"

✅ **Checkpoint**: Rules published successfully

---

## Step 8: Test the Full Application (5 minutes)

1. Go to: http://localhost:3000
2. Click "**Sign Up**"
3. Fill in the form:
   - Name: Your name
   - Email: your_email@example.com
   - Password: SecurePass123!
   - Role: **Coach**
4. Click "**Sign Up**"
5. You should be redirected to the **Dashboard**
6. Click "**Create Workout**"
7. Fill in workout details and save
8. Verify workout appears in list

✅ **Success!** Your Firebase is fully configured and working!

---

## 🎉 You're Done!

Your workout tracker is now:
- ✅ Connected to Firebase
- ✅ Authentication working
- ✅ Database working
- ✅ Security rules in place
- ✅ Ready to use!

---

## 🚨 Troubleshooting

### "Firebase not initialized" error
→ Check .env.local has all values filled in
→ Restart dev server after changing .env.local

### "Permission denied" errors
→ Make sure Firestore security rules are published
→ Check you're logged in before accessing protected pages

### Tests failing on /firebase-test
→ Verify Authentication is enabled in Firebase Console
→ Verify Firestore Database is created
→ Check browser console for specific errors

### Can't create user
→ Make sure Email/Password provider is enabled
→ Check password is at least 6 characters
→ Check email format is valid

---

## 📞 Need More Help?

- Firebase Documentation: https://firebase.google.com/docs
- Check browser console (F12) for error messages
- Verify all steps were completed in order
- Make sure .env.local is saved and server restarted

---

**Next**: Once everything is working, you can deploy to Vercel!
See `DEPLOYMENT_CHECKLIST.md` for deployment instructions.

# ✅ Firebase Setup Checklist

Print this or keep it open while setting up Firebase!

---

## Quick Setup Checklist (15 minutes)

### 1. Create Project
- [ ] Go to https://console.firebase.google.com/
- [ ] Click "Add project"  
- [ ] Name: `workout-tracker`
- [ ] Disable Google Analytics
- [ ] Click "Create project"
- [ ] Wait for completion
- [ ] Click "Continue"

---

### 2. Enable Authentication  
- [ ] Click "Build" → "Authentication"
- [ ] Click "Get started"
- [ ] Click "Email/Password"
- [ ] Enable the toggle
- [ ] Click "Save"
- [ ] ✅ Status shows "Enabled"

---

### 3. Create Firestore
- [ ] Click "Build" → "Firestore Database"
- [ ] Click "Create database"
- [ ] Choose your region (closest to you)
- [ ] Select "Start in test mode"
- [ ] Click "Next" → "Enable"
- [ ] Wait for database creation
- [ ] ✅ Empty database appears

---

### 4. Get Configuration
- [ ] Click gear icon ⚙️ → "Project settings"
- [ ] Scroll to "Your apps"
- [ ] Click web icon `</>`
- [ ] App nickname: `workout-tracker-web`
- [ ] Don't check "Firebase Hosting"
- [ ] Click "Register app"
- [ ] 📋 **COPY the config object**
- [ ] Click "Continue to console"

---

### 5. Update .env.local
- [ ] Open `/Users/ryan/Documents/workout-site/.env.local`
- [ ] Paste your Firebase values:
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123...
  NEXT_PUBLIC_FIREBASE_APP_ID=1:123...
  ```
- [ ] Save file (Cmd+S)

---

### 6. Restart Server
```bash
# Stop server: Ctrl+C
# Start server:
cd /Users/ryan/Documents/workout-site
npm run dev
```
- [ ] Server restarted
- [ ] No errors in terminal

---

### 7. Test Connection
- [ ] Go to: http://localhost:3000/firebase-test
- [ ] Click "Run All Tests"
- [ ] ✅ Config Test: Success
- [ ] ✅ Auth Test: Success
- [ ] ✅ Firestore Test: Success
- [ ] ✅ Cleanup Test: Success

---

### 8. Add Security Rules
- [ ] Firebase Console → Firestore → "Rules" tab
- [ ] Copy rules from `FIREBASE_COMPLETE_SETUP.md`
- [ ] Paste in editor
- [ ] Click "Publish"
- [ ] ✅ Rules published successfully

---

### 9. Test Full App
- [ ] Go to: http://localhost:3000
- [ ] Click "Sign Up"
- [ ] Create coach account
- [ ] ✅ Redirected to dashboard
- [ ] Click "Create Workout"
- [ ] Fill form and save
- [ ] ✅ Workout appears in list

---

## 🎉 Success!

All checkboxes checked? **Your app is fully configured!**

---

## 🚨 If Something Failed

### Auth Test Failed
→ Enable Email/Password in Firebase Authentication

### Firestore Test Failed  
→ Create Firestore Database in test mode

### Permission Denied
→ Publish security rules in Firestore

### Can't See Config
→ Make sure you registered a Web app

---

## 📁 Important Files

- Setup Guide: `FIREBASE_COMPLETE_SETUP.md`
- Environment: `.env.local`
- Test Page: http://localhost:3000/firebase-test

---

## ⏭️ What's Next?

Once all tests pass:

1. ✅ Use the app locally
2. ✅ Deploy to Vercel (see `DEPLOYMENT_CHECKLIST.md`)
3. ✅ Add OpenAI key for whiteboard feature (optional)

**You're all set!** 🚀

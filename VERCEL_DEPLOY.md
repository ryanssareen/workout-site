# 🚀 VERCEL DEPLOYMENT - READY TO GO!

## ✅ Step 1: Code Pushed to GitHub
**Repository**: https://github.com/ryanssareen/workout-site
**Status**: ✅ Complete!

---

## 📦 Step 2: Deploy to Vercel NOW

### Go to Vercel Import Page
Vercel is already open in your browser at: https://vercel.com/new

### Follow These Steps:

1. **Click "Import Git Repository"** or **"Add New Project"**

2. **Find and select**: `ryanssareen/workout-site`
   - If you don't see it, click "Adjust GitHub App Permissions"
   - Grant access to the repository

3. **Configure Project**:
   - Framework Preset: **Next.js** ✓ (auto-detected)
   - Root Directory: `./` ✓
   - Build Command: `npm run build` ✓
   - Output Directory: `.next` ✓

4. **ADD ENVIRONMENT VARIABLES** (Click "Environment Variables" button):

   Copy and paste these EXACTLY (one at a time):

   ```
   Name: NEXT_PUBLIC_FIREBASE_API_KEY
   Value: AIzaSyB92ywaKH03zflEHZWSkMIJcPZtdYHhmdY
   ```

   ```
   Name: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   Value: workout-tracker-8048f.firebaseapp.com
   ```

   ```
   Name: NEXT_PUBLIC_FIREBASE_PROJECT_ID
   Value: workout-tracker-8048f
   ```

   ```
   Name: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   Value: workout-tracker-8048f.firebasestorage.app
   ```

   ```
   Name: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   Value: 1003604918622
   ```

   ```
   Name: NEXT_PUBLIC_FIREBASE_APP_ID
   Value: 1:1003604918622:web:0775a945e85b1cebf50fcf
   ```

   ```
   Name: NEXT_PUBLIC_APP_URL
   Value: https://workout-site.vercel.app
   ```
   *(Note: You'll update this with your actual Vercel URL after deployment)*

5. **Click "Deploy"**
   - Wait 2-3 minutes for build to complete
   - ✅ You'll see "Congratulations!" when done

6. **Copy Your Production URL**
   - It will look like: `https://workout-site-xxx.vercel.app`
   - Or: `https://workout-site.vercel.app`

---

## 🔥 Step 3: Update Firebase Authorized Domains

### After Vercel deployment completes:

1. **Open Firebase Console**: https://console.firebase.google.com/

2. **Select**: `workout-tracker-8048f` project

3. **Go to**: Authentication → Settings → Authorized Domains

4. **Add your Vercel URL**:
   - Click "Add domain"
   - Enter: `workout-site.vercel.app` (or your actual URL)
   - Click "Add"

5. **Also add preview domains** (optional but recommended):
   - `workout-site-git-main-ryanssareen.vercel.app`
   - `*.vercel.app` (allows all Vercel preview deployments)

---

## 🔄 Step 4: Update NEXT_PUBLIC_APP_URL in Vercel

After you have your production URL:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Find `NEXT_PUBLIC_APP_URL`
4. Click **Edit**
5. Change to your actual URL: `https://workout-site-xxx.vercel.app`
6. **Save**
7. Go to **Deployments** → Click ⋯ on latest deployment → **Redeploy**

---

## ✅ Step 5: Test Your Deployment

Visit your production URL and test:

### Authentication
- [ ] Go to login page
- [ ] Register new coach account
- [ ] Verify coach code appears in toast notification
- [ ] Logout
- [ ] Register new student with coach code
- [ ] Login as student

### Coach Features
- [ ] Dashboard shows coach code card
- [ ] Copy code button works
- [ ] Create workout page shows assigned students
- [ ] Calendar displays workouts

### Student Features  
- [ ] Dashboard shows assigned workouts
- [ ] Can view workout details
- [ ] Can mark workouts complete

### Admin Test (rsareen@gmail.com)
- [ ] Login with rsareen@gmail.com
- [ ] No coach code on dashboard
- [ ] Create workout shows ALL students

---

## 🎯 Quick Summary

**Current Status:**
✅ Code pushed to GitHub: https://github.com/ryanssareen/workout-site
⏳ Next: Deploy to Vercel (5 minutes)
⏳ Then: Update Firebase domains (2 minutes)

**Total Time**: ~10 minutes

---

## 🆘 Troubleshooting

**Build fails in Vercel:**
- Check all environment variables are entered correctly
- Look at build logs for specific errors
- Verify .env.local is in .gitignore (already done)

**Firebase auth errors:**
- Verify authorized domains includes your Vercel URL
- Check environment variables match Firebase config
- Wait 1-2 minutes for domain authorization to propagate

**Coach code not showing:**

- Clear browser cache
- Check Firestore user document has `coachCode` field
- Verify user is coach (not rsareen@gmail.com)

---

## 📱 After Deployment

Share your app URL with users:
- Coaches: Register at `/register` → Get coach code → Share with students
- Students: Register at `/register` → Enter coach code → Auto-assigned

Your workout tracker is ready to use! 🎉

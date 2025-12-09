# GitHub & Vercel Deployment Guide

## Quick Deployment Steps

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `workout-tracker` (or your preferred name)
3. Description: "Workout tracking application for coaches and students"
4. Keep it **Private** (recommended) or Public
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

### Step 2: Push Code to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd /Users/ryan/Documents/workout-site

# Add the remote (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/workout-tracker.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Example with actual username:**
```bash
git remote add origin https://github.com/rsareen/workout-tracker.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

#### Option A: Vercel Dashboard (Easiest)

1. Go to https://vercel.com/new
2. Sign in with GitHub
3. Click "Import Project"
4. Select your `workout-tracker` repository
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

6. **Add Environment Variables** (click "Environment Variables"):
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

7. Click "Deploy"

#### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
cd /Users/ryan/Documents/workout-site
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: workout-tracker
# - Directory: ./
# - Override settings? No

# Add environment variables
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# ... (repeat for all env vars)

# Deploy to production
vercel --prod
```

### Step 4: Update Firebase Settings

After deployment, update Firebase configuration:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized Domains**
4. Add your Vercel domain:
   - `your-app.vercel.app`
   - `your-app-git-main-username.vercel.app` (preview deployments)

### Step 5: Test Production Deployment

Visit your deployed app and test:
- [ ] Login functionality
- [ ] Registration (test coach code system)
- [ ] Dashboard displays correctly
- [ ] Calendar page works
- [ ] Workout creation
- [ ] Coach code display for coaches
- [ ] Student registration with coach code

---

## Environment Variables Reference

Your current `.env.local` file should already have these values. Copy them to Vercel:

```bash
# To view your current environment variables:
cat /Users/ryan/Documents/workout-site/.env.local
```

Make sure **NEXT_PUBLIC_APP_URL** is updated to your Vercel domain after deployment.

---

## Continuous Deployment

Once connected, Vercel will automatically deploy:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches or pull requests

---

## Post-Deployment Checklist

- [ ] Verify all environment variables are set in Vercel
- [ ] Firebase authorized domains updated
- [ ] Test login/registration
- [ ] Test coach code generation for new coaches
- [ ] Test student registration with coach code
- [ ] Verify rsareen@gmail.com sees all students
- [ ] Test calendar functionality
- [ ] Check mobile responsiveness

---

## Troubleshooting

**Build Fails:**
- Check environment variables are correctly set
- Verify all dependencies are in package.json
- Check Vercel build logs

**Firebase Connection Errors:**
- Verify Firebase credentials in environment variables
- Check authorized domains in Firebase Console
- Ensure Firestore security rules are published

**Coach Code Not Showing:**
- Verify coach is logged in
- Check user document has coachCode field
- Confirm email is not rsareen@gmail.com

---

## Next Steps After Deployment

1. Share app URL with beta testers
2. Monitor Firebase usage
3. Set up error tracking (e.g., Sentry)
4. Configure custom domain (optional)

---

## Quick Reference

- **Local**: http://localhost:3000
- **GitHub**: https://github.com/YOUR-USERNAME/workout-tracker
- **Vercel**: https://your-app.vercel.app
- **Firebase**: https://console.firebase.google.com/

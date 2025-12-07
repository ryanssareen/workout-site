# ✅ Deployment Checklist

Use this checklist to ensure everything is configured correctly before going live.

## Pre-Deployment

### Local Development
- [ ] Application runs successfully with `npm run dev`
- [ ] Can create coach account
- [ ] Can create student account
- [ ] Coach can create workouts
- [ ] Student can view assigned workouts
- [ ] Dark mode toggle works
- [ ] All pages load without errors

### Firebase Configuration
- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firestore database created
- [ ] Firebase credentials copied to `.env.local`
- [ ] Security rules updated (not in test mode)
- [ ] Test user created and can authenticate

### Environment Variables
- [ ] `.env.local` file exists and is in `.gitignore`
- [ ] All Firebase variables set
- [ ] `NEXT_PUBLIC_APP_URL` set to localhost for dev
- [ ] OpenAI API key added (if using whiteboard vision)

### Code Repository
- [ ] All code committed to Git
- [ ] `.gitignore` includes `.env.local`
- [ ] Repository pushed to GitHub
- [ ] Repository is accessible online

## Deployment

### Vercel Setup
- [ ] Vercel account created
- [ ] GitHub repository imported
- [ ] All environment variables added to Vercel
- [ ] Initial deployment successful
- [ ] Deployment URL noted

### Post-Deployment
- [ ] Visit Vercel URL and test application
- [ ] Update `NEXT_PUBLIC_APP_URL` in Vercel to deployment URL
- [ ] Trigger redeploy after URL update
- [ ] Test authentication on live site
- [ ] Create test workout on live site
- [ ] Verify database writes in Firebase Console

## Production Security

### Firebase Security
- [ ] Firestore rules updated from test mode
- [ ] Only authenticated users can access data
- [ ] Role-based permissions working (coach/student)
- [ ] Test unauthorized access is blocked

### General Security
- [ ] No API keys committed to Git
- [ ] `.env.local` not in repository
- [ ] Vercel environment variables secured
- [ ] Firebase Console access restricted

## Optional Features

### Whiteboard Vision (Optional)
- [ ] OpenAI API key added
- [ ] Vision API route tested locally
- [ ] Image upload works on live site
- [ ] Workout extraction verified

## Final Checks

### Functionality
- [ ] Coach can create, edit, delete workouts
- [ ] Student can view and mark complete
- [ ] Dashboard statistics accurate
- [ ] Date picker works correctly
- [ ] All workout types available (swim, run, bike, strength)

### User Experience
- [ ] Landing page loads
- [ ] Login/register flows work
- [ ] Navigation is intuitive
- [ ] Mobile responsive (test on phone)
- [ ] Loading states display correctly
- [ ] Error messages are helpful

### Performance
- [ ] Pages load within 2-3 seconds
- [ ] No console errors in browser
- [ ] Images load properly
- [ ] Animations smooth

## Go Live! 🚀

When all items are checked:
1. Share your Vercel URL
2. Create coach accounts for trainers
3. Add student accounts
4. Start tracking workouts!

## Post-Launch Monitoring

### Week 1
- [ ] Monitor Vercel analytics
- [ ] Check Firebase usage (stay within free tier)
- [ ] Collect user feedback
- [ ] Fix any reported bugs

### Ongoing
- [ ] Review Firebase security rules monthly
- [ ] Update dependencies regularly
- [ ] Monitor for security advisories
- [ ] Back up Firestore data

---

**Need help with any item?** Refer to [SETUP.md](./SETUP.md) for detailed instructions.

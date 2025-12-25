# 🚀 GROJ FREEMIUM UPGRADE - Quick Start

---

## 📄 Full Implementation Guide
See: `CLAUDE_CODE_IMPLEMENTATION.md`

---

## 🎯 What You're Building

**Two main objectives:**

1. **Add Stripe Payments** ($30/month or $340/year premium tier)
   - Keep all costs at $0 (free infrastructure)
   - Stripe only charges 2.9% per transaction
   
2. **Make Coach & Student Pages Look Different**
   - Coach: Professional blue/indigo theme
   - Student: Energetic orange/red theme
   - Different dashboards, stats, and messaging
   - NO major frontend overhaul needed

---

## 🔑 Key Features

### Free Tier:
- ✅ 5 students max per coach
- ✅ 1 AI suggestion per week
- ✅ Basic workout tracking
- ✅ Calendar view
- ✅ Manual Strava sync

### Premium Tier ($30/month or $340/year):
- ✅ Unlimited students
- ✅ Unlimited AI suggestions
- ✅ Advanced analytics dashboard
- ✅ PDF export
- ✅ Workout templates library
- ✅ Auto Strava sync
- ✅ Remove branding
- ✅ Priority support

---

## 📋 Implementation Order

### Phase 1: Stripe Payment System
1. Install Stripe SDK
2. Create checkout flow
3. Handle webhooks
4. Add subscription status to users
5. Create upgrade modal
6. Enforce free tier limits

**Time: 1-2 days**

### Phase 2: UI Differentiation  
1. Add role-based CSS themes
2. Create separate CoachDashboard component
3. Create separate StudentDashboard component
4. Update header with role badges
5. Add role-specific colors and messaging

**Time: 1 day**

---

## 💰 Cost Structure

**Infrastructure: $0/month**
- Render: Free tier
- Firebase: Free tier
- Groq API: Free tier
- Stripe: Free (2.9% + 30¢ per transaction only)

**Revenue per customer:**
- Monthly: Keep $28.83 (pay Stripe $1.17)
- Annual: Keep $337.13 (pay Stripe $2.87)

**Break-even: 1 customer!** 🎉

---

## 🧪 Testing

**Test Card:** 4242 4242 4242 4242
- Any future expiry date
- Any 3-digit CVC
- Any billing ZIP

---

## 📚 Documentation Links

- Full guide: `CLAUDE_CODE_IMPLEMENTATION.md`
- Stripe docs: https://stripe.com/docs/checkout
- Next.js + Stripe: https://vercel.com/guides/getting-started-with-nextjs-typescript-stripe

---

## ✅ Definition of Done

You know it's working when:
- [ ] Can click "Upgrade to Premium" in settings
- [ ] Redirects to Stripe checkout page
- [ ] After payment, user status updates to "premium"
- [ ] Free tier limits are enforced (5 students max)
- [ ] Coach dashboard looks different from student dashboard
- [ ] Role badges show in header (Coach vs Athlete)
- [ ] Different color schemes for coach vs student

---

## 🎨 Visual Changes Summary

### Coach View:
- Blue/indigo gradient hero
- "Welcome back, Coach [Name]" heading
- Stats: Total Students, Workouts Assigned, Completion Rate
- Quick actions: Create Workout, AI Insights, View Students
- Professional tone

### Student View:
- Orange/red gradient hero  
- "Hey [Name]! 💪" heading
- Stats: Current Streak, This Week Progress, Personal Records
- Today's workout highlighted
- Motivational tone

**Same layout structure, just different:**
- Colors
- Messaging/copy
- Stats shown
- Call-to-action buttons

---

**Ready to build? Open `CLAUDE_CODE_IMPLEMENTATION.md` and follow Phase 1!**

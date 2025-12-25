# CLAUDE CODE IMPLEMENTATION GUIDE
## Groj Freemium + Role-Based UI Differentiation

---

## 🎯 OBJECTIVES

1. **Add freemium payment system** ($30/month or $340/year)
2. **Differentiate coach vs student UI** (without major frontend overhaul)
3. **Keep infrastructure costs at $0** (free tiers only)

---

## 💰 PART 1: STRIPE PAYMENT INTEGRATION

### Step 1.1: Install Stripe
```bash
npm install stripe @stripe/stripe-js
```

### Step 1.2: Environment Variables
Add to `.env.local` and Render:
```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ANNUAL=price_xxx
```

### Step 1.3: Create Stripe Config
**File:** `/src/lib/stripe/config.ts`
```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export const PLANS = {
  monthly: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!,
    amount: 30,
    interval: 'month',
  },
  annual: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!,
    amount: 340,
    interval: 'year',
  },
};
```

### Step 1.4: Create Checkout API
**File:** `/src/app/api/create-checkout/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  const { userId, email, priceId } = await request.json();

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?cancelled=true`,
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
}
```

### Step 1.5: Stripe Webhook Handler
**File:** `/src/app/api/webhooks/stripe/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;

    if (userId) {
      await adminDb.collection('users').doc(userId).update({
        subscriptionStatus: 'premium',
        subscriptionId: session.subscription,
        customerId: session.customer,
        plan: session.metadata?.plan || 'monthly',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    // Find user by customer ID and update
    const userSnapshot = await adminDb
      .collection('users')
      .where('customerId', '==', subscription.customer)
      .limit(1)
      .get();

    if (!userSnapshot.empty) {
      await userSnapshot.docs[0].ref.update({
        subscriptionStatus: 'cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

### Step 1.6: Update User Schema
**File:** `/src/types/index.ts`
```typescript
export interface User {
  // ... existing fields
  subscriptionStatus?: 'free' | 'premium' | 'cancelled' | 'past_due';
  subscriptionId?: string;
  customerId?: string;
  plan?: 'monthly' | 'annual';
}
```

### Step 1.7: Create Subscription Hook
**File:** `/src/hooks/useSubscription.ts`
```typescript
import { useAuthStore } from '@/store/authStore';

export function useSubscription() {
  const user = useAuthStore(state => state.user);
  
  const isPremium = user?.subscriptionStatus === 'premium';
  
  const limits = {
    maxStudents: isPremium ? 999 : 5,
    aiSuggestionsPerWeek: isPremium ? 999 : 1,
    exportEnabled: isPremium,
    maxTemplates: isPremium ? 999 : 3,
    stravaAutoSync: isPremium,
    customBranding: isPremium,
    advancedAnalytics: isPremium,
    messaging: isPremium,
  };
  
  return { isPremium, limits };
}
```

### Step 1.8: Create Upgrade Modal
**File:** `/src/components/subscription/UpgradeModal.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { PLANS } from '@/lib/stripe/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}

export function UpgradeModal({ isOpen, onClose, feature }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore(state => state.user);

  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          email: user?.email,
          priceId: PLANS[plan].priceId,
        }),
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Upgrade error:', error);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>
            {feature && `Unlock ${feature} and all premium features`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 my-6">
          {/* Monthly Plan */}
          <div className="border rounded-lg p-6">
            <h3 className="font-bold text-lg">Monthly</h3>
            <p className="text-3xl font-bold my-4">$30<span className="text-sm text-muted-foreground">/month</span></p>
            <Button 
              onClick={() => handleUpgrade('monthly')} 
              disabled={loading}
              className="w-full"
            >
              Choose Monthly
            </Button>
          </div>

          {/* Annual Plan */}
          <div className="border-2 border-primary rounded-lg p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">
              SAVE $20
            </div>
            <h3 className="font-bold text-lg">Annual</h3>
            <p className="text-3xl font-bold my-4">$340<span className="text-sm text-muted-foreground">/year</span></p>
            <p className="text-sm text-muted-foreground mb-4">$28.33/month</p>
            <Button 
              onClick={() => handleUpgrade('annual')} 
              disabled={loading}
              className="w-full"
            >
              Choose Annual
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Premium Features:</h4>
          <ul className="space-y-2">
            {[
              'Unlimited students',
              'Unlimited AI coaching insights',
              'Advanced analytics dashboard',
              'PDF export & reports',
              'Workout templates library',
              'Priority support',
              'Remove branding',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 1.9: Add Upgrade Button to Settings
**File:** `/src/app/(dashboard)/settings/page.tsx`
Add this section:
```typescript
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { useState } from 'react';

// Inside component:
const { isPremium } = useSubscription();
const [showUpgrade, setShowUpgrade] = useState(false);

// Add to UI:
<div className="border rounded-lg p-6">
  <h3 className="font-semibold text-lg mb-2">Subscription</h3>
  {isPremium ? (
    <div className="flex items-center gap-2">
      <Badge>Premium</Badge>
      <p className="text-sm text-muted-foreground">Active subscription</p>
    </div>
  ) : (
    <>
      <p className="text-sm text-muted-foreground mb-4">Free plan - Upgrade for unlimited features</p>
      <Button onClick={() => setShowUpgrade(true)}>
        Upgrade to Premium
      </Button>
    </>
  )}
</div>

<UpgradeModal 
  isOpen={showUpgrade} 
  onClose={() => setShowUpgrade(false)} 
/>
```

---

## 🎨 PART 2: DIFFERENTIATE COACH VS STUDENT UI

### Step 2.1: Add Role-Based Theme Colors
**File:** `/src/app/(dashboard)/layout.tsx`
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const isCoach = user?.role === 'coach';

  useEffect(() => {
    // Add role-based class to body
    document.body.classList.remove('coach-mode', 'student-mode');
    if (user) {
      document.body.classList.add(isCoach ? 'coach-mode' : 'student-mode');
    }
  }, [user, isCoach]);

  return (
    <div className={isCoach ? 'coach-theme' : 'student-theme'}>
      {children}
    </div>
  );
}
```

### Step 2.2: Add Role-Specific CSS
**File:** `/src/app/globals.css`
```css
/* Coach Theme - Professional Blue/Indigo */
.coach-theme {
  --role-primary: 220 90% 56%;
  --role-accent: 220 90% 96%;
  --role-border: 220 60% 85%;
}

.coach-mode .hero-gradient {
  background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
}

.coach-mode .card-accent {
  border-left: 4px solid hsl(var(--role-primary));
}

/* Student Theme - Energetic Orange/Red */
.student-theme {
  --role-primary: 20 90% 56%;
  --role-accent: 20 90% 96%;
  --role-border: 20 60% 85%;
}

.student-mode .hero-gradient {
  background: linear-gradient(135deg, #F97316 0%, #EF4444 100%);
}

.student-mode .card-accent {
  border-left: 4px solid hsl(var(--role-primary));
}

/* Role-specific badges */
.role-badge-coach {
  background-color: hsl(220 90% 96%);
  color: hsl(220 90% 56%);
  border: 1px solid hsl(220 60% 85%);
}

.role-badge-student {
  background-color: hsl(20 90% 96%);
  color: hsl(20 90% 56%);
  border: 1px solid hsl(20 60% 85%);
}
```

### Step 2.3: Update Dashboard Page with Role-Specific Content
**File:** `/src/app/(dashboard)/dashboard/page.tsx`
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import StudentDashboard from '@/components/dashboard/StudentDashboard';

export default function DashboardPage() {
  const user = useAuthStore(state => state.user);
  const isCoach = user?.role === 'coach';

  if (!user) return null;

  return isCoach ? <CoachDashboard /> : <StudentDashboard />;
}
```

### Step 2.4: Create Coach-Specific Dashboard
**File:** `/src/components/dashboard/CoachDashboard.tsx`
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Users, TrendingUp, Calendar, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CoachDashboard() {
  const user = useAuthStore(state => state.user);
  const { isPremium, limits } = useSubscription();

  return (
    <div className="space-y-6">
      {/* Hero Section - Coach Specific */}
      <div className="hero-gradient rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, Coach {user?.displayName?.split(' ')[0]}
            </h1>
            <p className="text-white/80">Manage your athletes and track their progress</p>
          </div>
          <Badge className="role-badge-coach">
            Coach
          </Badge>
        </div>
      </div>

      {/* Stats Grid - Coach Focused */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              {isPremium ? 'Unlimited' : `${limits.maxStudents} max on free plan`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">Workouts assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">+5% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">Students online</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Coach Specific */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Button className="w-full" onClick={() => router.push('/workouts/new')}>
            Create Workout
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push('/coach-suggestions')}>
            AI Insights
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push('/students')}>
            View Students
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 2.5: Create Student-Specific Dashboard
**File:** `/src/components/dashboard/StudentDashboard.tsx`
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { Target, Flame, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function StudentDashboard() {
  const user = useAuthStore(state => state.user);

  return (
    <div className="space-y-6">
      {/* Hero Section - Student Specific */}
      <div className="hero-gradient rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Hey {user?.displayName?.split(' ')[0]}! 💪
            </h1>
            <p className="text-white/80">Keep crushing your workouts!</p>
          </div>
          <Badge className="role-badge-student">
            Athlete
          </Badge>
        </div>
      </div>

      {/* Stats Grid - Student Focused */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7 days</div>
            <p className="text-xs text-muted-foreground">Keep it going! 🔥</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4/5</div>
            <p className="text-xs text-muted-foreground">Workouts completed</p>
            <Progress value={80} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal Records</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Total PRs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Tomorrow</div>
            <p className="text-xs text-muted-foreground">Long run - 10mi</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Workout - Student Specific */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Workout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">5K Easy Run</h3>
              <p className="text-sm text-muted-foreground">30 min • Zone 2</p>
            </div>
            <Button>Start Workout</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 2.6: Update Header with Role Badge
**File:** `/src/components/layout/Header.tsx`
```typescript
// Add to header:
import { useAuthStore } from '@/store/authStore';
import { Badge } from '@/components/ui/badge';

const user = useAuthStore(state => state.user);
const isCoach = user?.role === 'coach';

// In header UI:
<div className="flex items-center gap-2">
  <Badge className={isCoach ? 'role-badge-coach' : 'role-badge-student'}>
    {isCoach ? 'Coach' : 'Athlete'}
  </Badge>
  {/* Rest of user menu */}
</div>
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Payment System (Priority 1)
- [ ] Install Stripe packages
- [ ] Add environment variables
- [ ] Create Stripe config
- [ ] Create checkout API route
- [ ] Create webhook handler
- [ ] Update user schema
- [ ] Create useSubscription hook
- [ ] Create UpgradeModal component
- [ ] Add upgrade button to settings
- [ ] Test payment flow

### Phase 2: UI Differentiation (Priority 2)
- [ ] Add role-based theme to layout
- [ ] Add CSS for coach/student themes
- [ ] Split dashboard into coach/student components
- [ ] Create CoachDashboard component
- [ ] Create StudentDashboard component
- [ ] Update header with role badge
- [ ] Test both views

### Phase 3: Enforce Free Tier Limits (Priority 3)
- [ ] Block creating 6th student on free tier
- [ ] Limit AI suggestions to 1/week on free
- [ ] Block PDF export on free tier
- [ ] Block advanced analytics on free
- [ ] Show upgrade modal when hitting limits

---

## 🚀 DEPLOYMENT STEPS

1. **Push to GitHub:**
```bash
git add -A
git commit -m "Add Stripe payments + role-based UI differentiation"
git push origin main
```

2. **Add Stripe env vars to Render:**
- Go to Render dashboard
- Click on your service
- Environment → Add env vars
- Add all STRIPE_* variables

3. **Set up Stripe webhook:**
- Stripe Dashboard → Webhooks
- Add endpoint: `https://workout-site-hac0.onrender.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Copy webhook secret → Add to env vars

4. **Test payment flow:**
- Use Stripe test card: `4242 4242 4242 4242`
- Verify subscription updates in Firestore
- Test limits enforcement

---

## 💡 COST BREAKDOWN

**Monthly Costs:**
- Stripe: $0 (only 2.9% + 30¢ per transaction)
- Render: $0 (free tier)
- Firebase: $0 (free tier)
- Groq: $0 (free tier)
- Total: **$0/month** ✅

**Per Transaction:**
- On $30 charge: Keep $28.83 (95.7%)
- On $340 charge: Keep $337.13 (99.1%)

**Break-even: 1 paying customer covers all infrastructure! 🎉**

---

## 🎯 SUCCESS METRICS

After implementation, you should have:
- ✅ Payment system fully functional
- ✅ Coach UI distinctly different from student UI
- ✅ Free tier limits enforced
- ✅ Upgrade prompts shown at right moments
- ✅ Zero infrastructure costs
- ✅ Ready to start getting paying customers!

---

**Ready to implement? Start with Phase 1 (Payment System) and work your way down the checklist!**

# Phase 1 Implementation Plan - COMPLETED

## Overview

Phase 1 focuses on immediate-value features:
1. **Feature 1B**: Manual Workout Completion - DONE
2. **Feature 2A**: 10-Day Workout Summary Emails - DONE
3. **Feature 2B**: Workout Reminder Emails - DONE (bonus)
4. **Feature 5A**: Workout Comments System - DONE

---

## Current State Analysis

### Already Implemented
- Strava OAuth flow (`/api/auth/strava/*`)
- Strava webhook for automatic completion (`/api/webhooks/strava`)
- Basic completion toggle (`toggleWorkoutCompletion` in firestore.ts)
- Password reset emails via Brevo
- WorkoutCard with basic completion button

### Database Schema (Existing)
```typescript
// users collection
{
  uid, email, displayName, role,
  coachId?, coachCode?,
  stravaId?, stravaAccessToken?, stravaRefreshToken?, stravaTokenExpiresAt?
}

// workouts collection
{
  id, name, type, description, date, duration?,
  createdBy, assignedTo, completed,
  stravaActivityId?, actualStats?, completedAt?
}
```

---

## Feature 1B: Manual Workout Completion

### Database Changes
Add to `users` collection:
```typescript
{
  // ... existing fields
  lastSummaryDate?: Timestamp;  // For Feature 2A
}
```

Add to `workouts` collection:
```typescript
{
  // ... existing fields
  completionNotes?: string;     // "How did it feel?" feedback
  completedAt?: Timestamp;      // Already exists, ensure consistent use
  completedBy?: 'manual' | 'strava';  // Track completion source
}
```

### File Changes

#### 1. Update Types (`src/types/index.ts`)
```typescript
// Add to Workout interface
completionNotes?: string;
completedBy?: 'manual' | 'strava';

// Add to User interface
lastSummaryDate?: Timestamp;
```

#### 2. Update Firestore Functions (`src/lib/firebase/firestore.ts`)
```typescript
// Enhanced toggle function
export async function completeWorkout(
  id: string,
  completed: boolean,
  notes?: string
): Promise<void>
```

#### 3. Enhance WorkoutCard (`src/components/workouts/WorkoutCard.tsx`)
- Add confirmation dialog for un-completion
- Add optional notes textarea
- Better visual indicators (green checkmark, strikethrough)
- Show completion source badge (Manual vs Strava)

#### 4. Create Completion Dialog (`src/components/workouts/CompletionDialog.tsx`)
- Modal with "How did it feel?" textarea
- Confirm/Cancel buttons
- Shows when marking complete

### UI Changes
- Green border/background for completed cards
- Checkmark icon overlay
- "Completed via Strava" or "Completed manually" badge
- Confirmation dialog when un-completing

---

## Feature 2A: 10-Day Email Summaries

### Database Changes
Add to `users` collection:
```typescript
{
  lastSummaryDate?: Timestamp;  // When last summary was sent
}
```

### New Files

#### 1. API Endpoint (`src/app/api/cron/send-summaries/route.ts`)
```typescript
// GET endpoint callable by cron-job.org
// Logic:
// 1. Query users where lastSummaryDate is null OR <= (now - 10 days)
// 2. For each eligible user (max 50 per run):
//    - Query workouts from last 10 days
//    - Calculate stats
//    - Send email via Brevo
//    - Update lastSummaryDate
// 3. Return summary of processed users
```

#### 2. Email Template Function (`src/lib/email/summaryTemplate.ts`)
```typescript
interface SummaryData {
  userName: string;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  byType: { run: number; bike: number; swim: number; strength: number };
  stravaStats?: { distance: number; calories: number; time: number };
  motivationalMessage: string;
}

export function generateSummaryEmail(data: SummaryData): string
```

### Email Template Design
```html
<!-- Gradient header -->
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
  Your 10-Day Workout Summary
</div>

<!-- Stats cards -->
<div>
  <div>Completed: X/Y (Z%)</div>
  <div>Runs: X | Bikes: Y | Swims: Z</div>
</div>

<!-- Motivational message based on completion rate -->
<div>
  >= 80%: "Excellent work! Keep it up!"
  50-79%: "Good progress! You're on track."
  < 50%: "Let's get back on track together!"
</div>

<!-- CTA -->
<a href="{APP_URL}/calendar">View Your Calendar</a>
```

### Cron Setup Instructions (cron-job.org)

**Summary Emails Job:**
1. Go to https://cron-job.org and create free account
2. Add new cron job:
   - URL: `https://your-app.onrender.com/api/cron/send-summaries`
   - Schedule: Daily at 03:30 UTC (9:00 AM IST)
   - HTTP Method: GET
   - Timeout: 30 seconds

**Reminder Emails Job:**
1. Add another cron job:
   - URL: `https://your-app.onrender.com/api/cron/send-reminders`
   - Schedule: Daily at 04:00 UTC (9:30 AM IST)
   - HTTP Method: GET
   - Timeout: 30 seconds

**Optional Security:**
Add `CRON_SECRET` to Render environment variables and configure cron-job.org to send:
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

### Rate Limiting
- Process max 50 users per run
- Brevo free tier: 300 emails/day
- Each run sends max 50 emails (user + optional CC to coach)

---

## Feature 5A: Workout Comments System

### Database Changes
New subcollection: `workouts/{workoutId}/comments/{commentId}`
```typescript
{
  id: string;           // Auto-generated
  workoutId: string;    // Parent workout ID
  userId: string;       // Comment author
  userRole: 'coach' | 'student';
  userName: string;     // Denormalized for display
  text: string;
  rating?: 'too_easy' | 'just_right' | 'too_hard';
  createdAt: Timestamp;
  // For nested replies
  parentCommentId?: string;
  isCoachReply?: boolean;
}
```

### New Files

#### 1. Types (`src/types/index.ts`)
```typescript
export type WorkoutRating = 'too_easy' | 'just_right' | 'too_hard';

export interface WorkoutComment {
  id: string;
  workoutId: string;
  userId: string;
  userRole: 'coach' | 'student';
  userName: string;
  text: string;
  rating?: WorkoutRating;
  createdAt: Timestamp;
  parentCommentId?: string;
  isCoachReply?: boolean;
}
```

#### 2. Firestore Functions (`src/lib/firebase/firestore.ts`)
```typescript
export async function addWorkoutComment(
  workoutId: string,
  comment: Omit<WorkoutComment, 'id' | 'createdAt'>
): Promise<string>

export async function getWorkoutComments(
  workoutId: string
): Promise<WorkoutComment[]>

export async function deleteWorkoutComment(
  workoutId: string,
  commentId: string
): Promise<void>
```

#### 3. Comment Components (`src/components/workouts/comments/`)
```
src/components/workouts/comments/
├── CommentSection.tsx      # Main container
├── CommentForm.tsx         # Input form with rating
├── CommentList.tsx         # List of comments
├── CommentItem.tsx         # Single comment display
└── RatingSelector.tsx      # Emoji rating buttons
```

#### 4. Notification API (`src/app/api/notifications/workout-comment/route.ts`)
```typescript
// POST: Send email to coach when student comments
// Body: { workoutId, commentText, studentName }
```

### UI Components

#### RatingSelector
```jsx
<div className="flex gap-2">
  <button>Too Easy</button>
  <button>Just Right</button>
  <button>Too Hard</button>
</div>
```

#### CommentForm
```jsx
<form>
  <RatingSelector value={rating} onChange={setRating} />
  <textarea placeholder="How did it feel?" />
  <Button type="submit">Add Feedback</Button>
</form>
```

#### Integration Points
- Add CommentSection to `/workouts/[id]/page.tsx`
- Show comment count badge on WorkoutCard

---

## File Structure Summary

### New Files
```
src/
├── app/api/
│   ├── cron/
│   │   └── send-summaries/route.ts     # Feature 2A
│   └── notifications/
│       └── workout-comment/route.ts     # Feature 5A
├── components/workouts/
│   ├── CompletionDialog.tsx             # Feature 1B
│   └── comments/
│       ├── CommentSection.tsx           # Feature 5A
│       ├── CommentForm.tsx
│       ├── CommentList.tsx
│       ├── CommentItem.tsx
│       └── RatingSelector.tsx
└── lib/
    └── email/
        └── summaryTemplate.ts           # Feature 2A
```

### Modified Files
```
src/
├── types/index.ts                       # Add new types
├── lib/firebase/firestore.ts            # Add comment functions
├── components/workouts/WorkoutCard.tsx  # Enhance completion UI
└── app/(dashboard)/workouts/[id]/page.tsx  # Add comments section
```

---

## Environment Variables

### Existing (Already Set)
```
BREVO_API_KEY=xxx                    # Email service
STRAVA_WEBHOOK_VERIFY_TOKEN=xxx      # Webhook validation
```

### New (Optional)
```
CRON_SECRET=xxx                      # Optional: Secure cron endpoints
```

---

## Implementation Order

1. **Feature 1B: Manual Completion** (Foundation)
   - Update types
   - Enhance firestore functions
   - Create CompletionDialog component
   - Update WorkoutCard

2. **Feature 5A: Comments** (Depends on 1B patterns)
   - Add comment types
   - Create firestore functions
   - Build comment components
   - Integrate into workout detail page
   - Add email notification

3. **Feature 2A: Email Summaries** (Independent)
   - Create email template
   - Build cron endpoint
   - Test with single user
   - Document cron-job.org setup

---

## Testing Checklist

### Feature 1B
- [ ] Complete workout manually (student)
- [ ] Add completion notes
- [ ] Un-complete with confirmation
- [ ] Visual indicators display correctly
- [ ] Coach can see completion status

### Feature 2A
- [ ] Endpoint processes eligible users
- [ ] Calculates correct stats
- [ ] Sends properly formatted email
- [ ] Updates lastSummaryDate
- [ ] Respects 50 user limit
- [ ] Handles missing data gracefully

### Feature 5A
- [ ] Add comment as student
- [ ] Add rating with comment
- [ ] Coach receives notification
- [ ] Coach can reply
- [ ] Comments display in order
- [ ] Delete own comments

---

## Deployment Notes

### Render Configuration
- No changes needed to build/start commands
- Add `CRON_SECRET` env var (optional)

### Cron-job.org Setup
1. Create free account
2. Add job:
   - URL: `https://your-app.onrender.com/api/cron/send-summaries`
   - Schedule: Every day at 03:30 UTC (9:00 AM IST)
   - HTTP Method: GET
   - Timeout: 30 seconds

### Firestore Indexes
May need composite index for:
```
workouts: [assignedTo, date, completed]
```

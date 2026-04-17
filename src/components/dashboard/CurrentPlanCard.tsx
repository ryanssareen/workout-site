'use client';

/**
 * Dashboard Current Plan card (Unit 7 / R7).
 *
 * Three display states (mirrors /plan page, but compact):
 *   - Active plan: week of N, phase, link to /plan
 *   - No plan + beta enabled: "Create a plan" CTA link
 *   - No plan + not beta-enabled: nothing (don't advertise to non-beta users)
 *   - Non-athlete role: nothing (role gate)
 */

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';

export function CurrentPlanCard() {
  const user = useAuthStore(s => s.user);
  if (!user) return null;
  if (user.role && user.role !== 'athlete') return null;

  // Active plan — link to /plan for details.
  if (user.activePlanId) {
    return (
      <Link
        href="/plan"
        className="block p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent hover:border-emerald-500/40 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-emerald-500" size={16} />
            <span className="font-medium text-sm">Your training plan</span>
          </div>
          <ArrowRight size={14} className="text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Open your plan to see this week&apos;s workouts and progress.
        </p>
      </Link>
    );
  }

  // Beta-enabled athlete with no active plan — CTA to create.
  if (user.planBetaEnabled) {
    return (
      <Link
        href="/plan"
        className="block p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent hover:border-emerald-500/40 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-emerald-500" size={16} />
            <span className="font-medium text-sm">Build a training plan</span>
          </div>
          <ArrowRight size={14} className="text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pick a goal and we&apos;ll design a plan with AI-tuned sessions each week.
        </p>
      </Link>
    );
  }

  // Not beta-enabled — hide the card entirely so we don't advertise a
  // feature the user can't access.
  return null;
}

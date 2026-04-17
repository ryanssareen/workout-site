'use client';

/**
 * /plan route — user's plan home base (Unit 7 / R7).
 *
 * Three render states:
 *   1. No plan + beta enabled → "Create a plan" CTA opens the wizard.
 *   2. No plan + not beta-enabled → "Training plans are in private beta" card.
 *   3. Active plan → plan header + current-week list + action menu.
 *
 * Role gate: non-athlete roles are redirected to /dashboard (R7 scope).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Calendar, Target, TrendingUp, X, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getAuthInstance } from '@/lib/firebase/config';
import { PlanWizard } from '@/components/plan/wizard/PlanWizard';
import type { TrainingPlan } from '@/types';

interface PlanDoc extends Omit<TrainingPlan, 'createdAt' | 'updatedAt' | 'completedAt' | 'abandonedAt'> {
  createdAt: number | null;
  updatedAt: number | null;
  completedAt: number | null;
  abandonedAt: number | null;
}

export default function PlanPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  // Role gate — non-athletes bounce to dashboard.
  useEffect(() => {
    if (!user) return;
    if (user.role && user.role !== 'athlete') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const load = useCallback(async () => {
    if (!user?.activePlanId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const auth = getAuthInstance();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/plans/${user.activePlanId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const body = await res.json();
        setPlan(body.plan);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.activePlanId]);

  useEffect(() => { load(); }, [load]);

  const currentPhase = useMemo(() => {
    if (!plan) return null;
    const today = new Date().toISOString().slice(0, 10);
    return plan.phaseMap.find(p => p.startDate <= today && today <= p.endDate)
      ?? plan.phaseMap[0];
  }, [plan]);

  async function handleAbandon() {
    if (!plan) return;
    setAbandoning(true);
    try {
      const auth = getAuthInstance();
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/plans/${plan.id}/abandon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        // activePlanId is cleared server-side; reload user state or reflect locally.
        setPlan(null);
        setConfirmAbandon(false);
        router.refresh();
      }
    } finally {
      setAbandoning(false);
    }
  }

  // Wizard overlay
  if (showWizard) {
    return (
      <div className="min-h-[80vh]">
        <div className="flex justify-end p-4">
          <button
            onClick={() => setShowWizard(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={14} /> Close
          </button>
        </div>
        <PlanWizard />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  // ── No plan + not beta-enabled ────────────────────────────────────────
  if (!plan && !user?.planBetaEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="p-6 rounded-xl border border-border bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Sparkles className="text-emerald-500" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Training plans are in private beta</h2>
              <p className="text-sm text-muted-foreground mt-2">
                We&apos;re testing AI-guided plans with a small group of athletes. Ask your admin for access, or check back soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── No plan + beta-enabled → Create CTA ───────────────────────────────
  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="p-8 rounded-xl border border-border bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10">
              <Sparkles className="text-emerald-500" size={24} />
            </div>
            <h2 className="text-xl font-semibold">Train for your race with an adaptive plan</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Pick a goal, tell us how you train, and we&apos;ll build a personalized plan with AI-tuned sessions each week.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
            >
              Create your plan <Sparkles size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active plan view ──────────────────────────────────────────────────
  const totalWeeks = plan.phaseMap.reduce((s, p) => s + p.weekNumbers.length, 0);
  const currentWeekNum = currentPhase?.weekNumbers.find(n => {
    // not strict — just a rough display
    return true;
  }) ?? 1;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{plan.goal.goalLabel}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {plan.goal.eventDate ? `Event: ${plan.goal.eventDate}` : 'Distance goal'}
              {' · '}
              Week {currentWeekNum} of {totalWeeks} · {currentPhase?.phase} phase
            </p>
          </div>
          <button
            onClick={() => setConfirmAbandon(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border transition-colors"
          >
            <Trash2 size={14} /> Abandon
          </button>
        </div>
      </div>

      {/* Phase progress */}
      <div className="grid grid-cols-4 gap-2">
        {plan.phaseMap.map(p => {
          const today = new Date().toISOString().slice(0, 10);
          const isPast = p.endDate < today;
          const isCurrent = p.startDate <= today && today <= p.endDate;
          return (
            <div
              key={p.phase}
              className={`p-3 rounded-lg border text-center ${
                isCurrent
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : isPast
                    ? 'border-border bg-muted/30 opacity-60'
                    : 'border-border bg-muted/10'
              }`}
            >
              <div className="text-xs text-muted-foreground capitalize">{p.phase}</div>
              <div className="text-sm font-medium mt-0.5">
                {p.weekNumbers.length}w
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick links — wrap, calendar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="/calendar"
          className="p-4 rounded-lg border border-border hover:border-emerald-500/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-emerald-500" />
            <span className="font-medium text-sm">Calendar</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">See your planned workouts</p>
        </a>
        <a
          href="/wrap"
          className="p-4 rounded-lg border border-border hover:border-emerald-500/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="font-medium text-sm">Weekly Wrap</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">See this week&apos;s progress</p>
        </a>
      </div>

      {/* Goal details */}
      <div className="p-4 rounded-lg bg-muted/20 border border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target size={14} className="text-emerald-500" /> Your goal
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Sports</dt>
            <dd>{plan.sports.join(', ')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Days / week</dt>
            <dd>{plan.goal.daysPerWeek}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Session length</dt>
            <dd>{plan.goal.typicalSessionMinutes} min</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Methodology</dt>
            <dd>{plan.templateId}</dd>
          </div>
        </dl>
      </div>

      {/* Abandon confirmation */}
      {confirmAbandon && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 rounded-xl border border-border bg-background shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">Abandon this plan?</h3>
            <p className="text-sm text-muted-foreground">
              Future plan workouts will be hidden from your calendar. Past workouts stay as historical data. You can always create a new plan afterwards.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAbandon(false)}
                disabled={abandoning}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAbandon}
                disabled={abandoning}
                className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                {abandoning ? <Loader2 className="animate-spin inline" size={14} /> : 'Abandon plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

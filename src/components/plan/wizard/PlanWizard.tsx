'use client';

/**
 * Plan creation wizard (Unit 7 / R1).
 *
 * 5 steps: Goal type → Event details → Availability → Preview → Confirm.
 * Local `useState` state — onboarding-wizard pattern. Persists only on the
 * final Confirm step, which POSTs to `/api/plans/create`.
 *
 * Design note: kept as a single component file for v1. If this grows beyond
 * ~500 lines, split into per-step components as originally planned — but
 * the state machine is simple enough that one file is clearer today.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowRight, ArrowLeft, Sparkles, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { getAuthInstance } from '@/lib/firebase/config';
import { useAuthStore } from '@/lib/stores/authStore';
import type { GoalInputs, PlanSport, PlanTemplate } from '@/types';
import {
  getMatchingTemplates,
  getDefaultTemplate,
  PLAN_TEMPLATES,
} from '@/lib/training/planTemplates';

type Step = 'goal' | 'event' | 'availability' | 'preview' | 'confirm';
const STEPS: Step[] = ['goal', 'event', 'availability', 'preview', 'confirm'];

const GOAL_LABELS = [
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half marathon', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'sprint triathlon', label: 'Sprint Triathlon' },
  { value: 'olympic triathlon', label: 'Olympic Triathlon' },
  { value: 'half ironman', label: 'Half Ironman (70.3)' },
  { value: 'ironman', label: 'Ironman' },
];

const SPORT_OPTIONS: Array<{ value: PlanSport; label: string }> = [
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Bike' },
  { value: 'swim', label: 'Swim' },
];

interface WizardState {
  type: 'dated-event' | 'distance-pr';
  sport: PlanSport;
  sports: PlanSport[];
  goalLabel: string;
  eventDate: string;
  targetTime: string;
  daysPerWeek: number;
  typicalSessionMinutes: number;
}

const INITIAL: WizardState = {
  type: 'dated-event',
  sport: 'run',
  sports: ['run'],
  goalLabel: 'marathon',
  eventDate: '',
  targetTime: '',
  daysPerWeek: 4,
  typicalSessionMinutes: 60,
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function PlanWizard() {
  const router = useRouter();
  const setUser = useAuthStore(s => s.setUser);
  const currentUser = useAuthStore(s => s.user);
  const [step, setStep] = useState<Step>('goal');
  const [state, setState] = useState<WizardState>(INITIAL);
  const [templateId, setTemplateId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Chat refinement state (Unit 8) — lives on the Preview step.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const stepIdx = STEPS.indexOf(step);

  const matchingTemplates = useMemo<PlanTemplate[]>(() => {
    const sports = isTriathlon(state.goalLabel) ? state.sports : [state.sport];
    const set = new Set<PlanTemplate>();
    for (const s of sports) {
      for (const t of getMatchingTemplates(s, state.goalLabel)) {
        set.add(t);
      }
    }
    return Array.from(set);
  }, [state.goalLabel, state.sport, state.sports]);

  // Default-select the best matching template when the user reaches templates.
  const effectiveTemplate = useMemo(() => {
    if (templateId) {
      return matchingTemplates.find(t => t.id === templateId)
        ?? PLAN_TEMPLATES.find(t => t.id === templateId)
        ?? getDefaultTemplate(state.sport, state.goalLabel);
    }
    return matchingTemplates.find(t => t.default) ?? matchingTemplates[0] ?? getDefaultTemplate(state.sport, state.goalLabel);
  }, [templateId, matchingTemplates, state.sport, state.goalLabel]);

  const goNext = () => {
    setError('');
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    setError('');
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  // Validate the current step before advancing.
  const canAdvance = useMemo(() => {
    switch (step) {
      case 'goal':
        return state.goalLabel !== '' && (state.sport !== undefined || state.sports.length > 0);
      case 'event':
        if (state.type === 'dated-event') {
          return !!state.eventDate && dateIsFuture(state.eventDate);
        }
        return true;
      case 'availability':
        return state.daysPerWeek >= 2 && state.daysPerWeek <= 7;
      case 'preview':
        return true;
      case 'confirm':
        return true;
    }
  }, [step, state]);

  async function handleChatSend() {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatSending(true);
    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: msg }];
    setChatMessages(newHistory);
    try {
      const auth = getAuthInstance();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again.');
      const sports: PlanSport[] = isTriathlon(state.goalLabel) ? state.sports : [state.sport];
      const res = await fetch('/api/plans/refine-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          goal: {
            type: state.type,
            goalLabel: state.goalLabel,
            eventDate: state.eventDate || undefined,
            daysPerWeek: state.daysPerWeek,
            typicalSessionMinutes: state.typicalSessionMinutes,
            sports,
          },
          chatHistory: chatMessages,
          userMessage: msg,
        }),
      });
      const body = await res.json();
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: body.assistantMessage ?? 'Sorry, something went wrong — please try again.',
        },
      ]);
    } catch (err) {
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : "I couldn't send that — please try again.",
        },
      ]);
    } finally {
      setChatSending(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const auth = getAuthInstance();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again.');

      const sports: PlanSport[] = isTriathlon(state.goalLabel) ? state.sports : [state.sport];
      const goal: GoalInputs = {
        type: state.type,
        sport: sports.length === 1 ? sports[0] : undefined,
        sports,
        goalLabel: state.goalLabel,
        eventDate: state.type === 'dated-event' ? state.eventDate : undefined,
        targetTime: state.targetTime ? parseTargetTime(state.targetTime) : undefined,
        daysPerWeek: state.daysPerWeek,
        typicalSessionMinutes: state.typicalSessionMinutes,
      };

      const res = await fetch('/api/plans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          goal,
          templateId: effectiveTemplate.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Plan creation failed' }));
        throw new Error(body.error || `Plan creation failed (${res.status})`);
      }
      const body = await res.json();

      // Update the client auth store with the new activePlanId. Without this,
      // the Zustand cache still holds the pre-creation user object, and /plan
      // silently falls back to "Create your plan" CTA because it reads
      // activePlanId from the store. Fetching fresh from Firestore is the
      // most robust path — picks up any other server-side changes too.
      if (currentUser && body.planId) {
        try {
          const { getUserProfileByUsername } = await import('@/lib/firebase/auth');
          const fresh = await getUserProfileByUsername(currentUser.username);
          if (fresh) {
            setUser(fresh);
          } else {
            // Fallback: mutate the known field locally so /plan renders the
            // active plan even if the re-fetch failed.
            setUser({ ...currentUser, activePlanId: body.planId });
          }
        } catch {
          setUser({ ...currentUser, activePlanId: body.planId });
        }
      }

      router.push(`/plan`);
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan creation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header + progress */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="text-emerald-500" size={22} />
          Create your plan
        </h1>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 w-6 rounded-full ${i <= stepIdx ? 'bg-emerald-500' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Goal */}
      {step === 'goal' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-3">What are you training for?</p>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_LABELS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setState(s => ({ ...s, goalLabel: g.value }))}
                  className={`p-3 rounded-lg border text-sm text-left transition-all ${
                    state.goalLabel === g.value
                      ? 'border-emerald-500 bg-emerald-500/5 text-foreground'
                      : 'border-border hover:border-emerald-500/30 text-foreground/70'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {!isTriathlon(state.goalLabel) ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Primary sport</p>
              <div className="grid grid-cols-3 gap-2">
                {SPORT_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setState(st => ({ ...st, sport: s.value, sports: [s.value] }))}
                    className={`p-3 rounded-lg border text-sm transition-all ${
                      state.sport === s.value
                        ? 'border-emerald-500 bg-emerald-500/5 text-foreground'
                        : 'border-border hover:border-emerald-500/30 text-foreground/70'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">Triathlon plans include run, bike, and swim automatically.</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-3">Goal type</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setState(s => ({ ...s, type: 'dated-event' }))}
                className={`p-3 rounded-lg border text-sm text-left transition-all ${
                  state.type === 'dated-event'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-emerald-500/30'
                }`}
              >
                <div className="font-medium">Dated event</div>
                <div className="text-xs text-muted-foreground mt-1">Race on a specific date</div>
              </button>
              <button
                onClick={() => setState(s => ({ ...s, type: 'distance-pr' }))}
                className={`p-3 rounded-lg border text-sm text-left transition-all ${
                  state.type === 'distance-pr'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-emerald-500/30'
                }`}
              >
                <div className="font-medium">Distance PR</div>
                <div className="text-xs text-muted-foreground mt-1">No specific date</div>
              </button>
            </div>
          </div>

          {/* Template picker — visible when matches exist */}
          {matchingTemplates.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Methodology {matchingTemplates.length === 1 && <span className="text-xs">(auto-selected)</span>}
              </p>
              <div className="space-y-2">
                {matchingTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      effectiveTemplate.id === t.id
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-border hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {t.promptAddendum.split('\n')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Event details */}
      {step === 'event' && (
        <div className="space-y-5">
          {state.type === 'dated-event' ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Event date</p>
              <input
                type="date"
                value={state.eventDate}
                onChange={e => setState(s => ({ ...s, eventDate: e.target.value }))}
                min={tomorrowIso()}
                className="w-full p-3 rounded-lg border border-border bg-background text-sm"
              />
              {state.eventDate && !dateIsFuture(state.eventDate) && (
                <p className="text-xs text-destructive mt-1">Event date must be in the future.</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
              No date — we&apos;ll build a plan at the default length for this distance.
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Target time <span className="text-xs">(optional)</span>
            </p>
            <input
              type="text"
              value={state.targetTime}
              onChange={e => setState(s => ({ ...s, targetTime: e.target.value }))}
              placeholder="e.g. 3:45:00 or sub-4"
              className="w-full p-3 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
      )}

      {/* Step 3: Availability */}
      {step === 'availability' && (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground mb-3">Days per week</p>
            <div className="grid grid-cols-6 gap-2">
              {[2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  onClick={() => setState(s => ({ ...s, daysPerWeek: n }))}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    state.daysPerWeek === n
                      ? 'border-emerald-500 bg-emerald-500/5 text-foreground'
                      : 'border-border hover:border-emerald-500/30 text-foreground/70'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Typical session length (minutes)
            </p>
            <input
              type="number"
              min={15}
              max={300}
              value={state.typicalSessionMinutes}
              onChange={e => setState(s => ({ ...s, typicalSessionMinutes: Number(e.target.value) }))}
              className="w-full p-3 rounded-lg border border-border bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Key sessions may run longer — this is your default.
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2 text-sm">
            <Row label="Goal" value={state.goalLabel} />
            {state.type === 'dated-event' && <Row label="Event date" value={state.eventDate} />}
            <Row
              label="Sports"
              value={(isTriathlon(state.goalLabel) ? state.sports : [state.sport]).join(', ')}
            />
            <Row label="Days / week" value={String(state.daysPerWeek)} />
            <Row label="Session length" value={`${state.typicalSessionMinutes} min`} />
            <Row label="Methodology" value={effectiveTemplate.name} />
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll generate your full plan on the next step. This may take 30-90
            seconds — we&apos;re tailoring every week to your goal.
          </p>

          {/* Chat refinement — optional, behind a toggle so it doesn't crowd the preview. */}
          <div>
            <button
              onClick={() => setChatOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare size={12} />
              {chatOpen ? 'Hide chat' : 'Have a question? Chat with the coach'}
            </button>

            {chatOpen && (
              <div className="mt-3 p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                {chatMessages.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chatMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded ${
                          m.role === 'user'
                            ? 'bg-emerald-500/10 text-foreground/90'
                            : 'bg-background border border-border'
                        }`}
                      >
                        <div className="text-xs text-muted-foreground mb-0.5">
                          {m.role === 'user' ? 'You' : 'Coach'}
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    disabled={chatSending}
                    placeholder="e.g. is 4 days enough for a marathon plan?"
                    className="flex-1 p-2 rounded border border-border bg-background text-sm"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={chatSending || !chatInput.trim()}
                    className="px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm"
                  >
                    {chatSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask about days per week, session length, or sport balance. To change your goal, go back to the Goal step.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <p className="text-sm">
              Ready to build your plan? You can always edit or abandon it from the <code>/plan</code> page.
            </p>
          </div>
          {submitting && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-emerald-500" size={18} />
                <div>
                  <p className="text-sm font-medium">Building your plan…</p>
                  <p className="text-xs text-muted-foreground">
                    Drafting each training phase. Don&apos;t close this tab.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between pt-2">
        {stepIdx > 0 ? (
          <button
            onClick={goBack}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <Link
            href="/plan"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
        )}
        {step !== 'confirm' ? (
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {submitting ? <><Loader2 className="animate-spin" size={14} /> Building…</> : <>Create plan <Sparkles size={14} /></>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function isTriathlon(goalLabel: string): boolean {
  const g = goalLabel.toLowerCase();
  return g.includes('triathlon') || g.includes('ironman');
}

function dateIsFuture(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return new Date(iso) > new Date();
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Parses a target time like "3:45:00", "3:45", "sub-4", or "4h" → seconds. */
function parseTargetTime(str: string): number | undefined {
  const s = str.trim().toLowerCase();
  // HH:MM:SS or MM:SS
  const parts = s.split(':').map(Number);
  if (parts.every(n => !isNaN(n))) {
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  // "sub-4"
  const subMatch = /sub[-\s]?(\d+)(?:h|hrs?|:00)?/.exec(s);
  if (subMatch) return Number(subMatch[1]) * 3600;
  return undefined;
}

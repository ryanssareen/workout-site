'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, Sparkles, ArrowRight, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = ['intro', 'name', 'gender', 'age', 'sport', 'event', 'goals', 'experience', 'availability', 'preview'] as const;
type Step = typeof STEPS[number];

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55+'];
const SPORTS = ['Running', 'Swimming', 'Biking', 'Ironman'] as const;
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const AVAILABILITY = ['1–2 days', '3–4 days', '5–6 days', '7 days'];

const GOAL_MAP: Record<string, string[]> = {
  Running: ['5K', '10K', 'Half Marathon', 'Full Marathon'],
  Swimming: ['1K Open Water', 'Sprint Tri Swim', '5K Open Water', 'Endurance Training'],
  Biking: ['Century Ride', 'Gran Fondo', 'Time Trial', 'Mountain Bike Race'],
  Ironman: ['Sprint Triathlon', 'Olympic Triathlon', 'Half Ironman 70.3', 'Full Ironman'],
};

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn('h-1 rounded-full transition-all duration-300', i < current ? 'w-8 bg-red-500' : i === current ? 'w-8 bg-red-500/60' : 'w-4 bg-muted')} />
      ))}
    </div>
  );
}

function OptionGrid({ options, selected, onSelect, multi = false }: { options: string[]; selected: string | string[]; onSelect: (v: string) => void; multi?: boolean }) {
  const isSelected = (opt: string) => multi ? (selected as string[]).includes(opt) : selected === opt;
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onSelect(opt)} className={cn(
          'relative px-4 py-4 rounded-xl border-2 text-left font-medium transition-all duration-200',
          isSelected(opt)
            ? 'border-red-500 bg-red-500/10 text-foreground shadow-lg shadow-red-500/10'
            : 'border-border hover:border-red-500/40 text-muted-foreground hover:text-foreground'
        )}>
          {isSelected(opt) && <Check className="absolute top-2.5 right-2.5 w-4 h-4 text-green-500" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState(user?.displayName || '');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sport, setSport] = useState('');
  const [trainingForEvent, setTrainingForEvent] = useState<boolean | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!user) return; if (user.onboardingCompleted !== false) router.replace('/dashboard'); }, [user, router]);
  useEffect(() => { setName(user?.displayName || ''); }, [user?.displayName]);
  useEffect(() => { if (step === 'name') setTimeout(() => inputRef.current?.focus(), 400); }, [step]);

  const stepIndex = STEPS.indexOf(step);
  const isLoading = checking || saving;

  const goNext = () => {
    const i = STEPS.indexOf(step);
    // Skip goals step if not training for an event
    if (step === 'event' && trainingForEvent === false) {
      setGoals([]);
      setStep('experience');
      return;
    }
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    // Skip goals step going back if not training for an event
    if (step === 'experience' && trainingForEvent === false) {
      setStep('event');
      return;
    }
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const toggleGoal = (g: string) => {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleNameSubmit = async () => {
    setError('');
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }

    setChecking(true);
    try {
      const res = await fetch('/api/ai/profanity-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: trimmed }) });
      const data = await res.json();
      if (!data.isClean) { setError(data.reason || 'That name contains inappropriate language. Please choose a different name.'); setChecking(false); return; }
    } catch { /* allow through */ }
    setChecking(false);
    goNext();
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await updateDoc(doc(getDbInstance(), 'users', user.uid), {
        displayName: name.trim(),
        gender: gender || null,
        ageRange,
        sportPreferences: [sport],
        trainingFor: goals.length > 0 ? goals : null,
        experienceLevel: experience || null,
        weeklyAvailability: availability || null,
        timezone: tz,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });
      setUser({ ...user, displayName: name.trim(), gender: gender || undefined, ageRange, sportPreferences: [sport], trainingFor: goals.length > 0 ? goals : undefined, experienceLevel: experience || undefined, weeklyAvailability: availability || undefined, timezone: tz, onboardingCompleted: true });
      toast.success(`Welcome, ${name.trim()}!`);
      router.replace('/dashboard');
    } catch { toast.error('Failed to save — try again'); }
    finally { setSaving(false); }
  };

  if (!user || user.onboardingCompleted !== false) return null;

  // Calculate visible step count (skip goals if no event)
  const visibleStepCount = trainingForEvent === false ? 8 : 9;
  const getVisibleIndex = () => {
    const i = STEPS.indexOf(step);
    if (i <= 0) return 0; // intro
    if (trainingForEvent === false && i >= 7) return i - 1; // shift down after skipping goals
    return i;
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-red-600/20 via-green-500/10 to-red-500/15 blur-3xl animate-pulse" />
        </div>

        {/* INTRO */}
        {step === 'intro' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-green-500 flex items-center justify-center shadow-2xl shadow-red-600/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-600 to-green-500 opacity-20 blur-lg" />
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-red-500 via-red-600 to-green-500 bg-clip-text text-transparent">The Daily Athlete</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">Your personal training companion. Let&apos;s build your athlete profile in under a minute.</p>
            </div>
            <button onClick={goNext} className={cn('group inline-flex items-center gap-3 px-8 py-4 rounded-2xl', 'bg-gradient-to-r from-red-600 to-green-600', 'text-white font-semibold text-lg', 'shadow-xl shadow-red-600/25', 'hover:shadow-2xl hover:scale-[1.02]', 'transition-all duration-300')}>
              Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* NAME */}
        {step === 'name' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={1} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What&apos;s your name?</h2>
              <p className="text-muted-foreground">This is how you&apos;ll appear in the app.</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input ref={inputRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={50} placeholder="Type your name..." onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) handleNameSubmit(); }} className={cn('w-full px-6 py-5 text-xl sm:text-2xl font-medium rounded-2xl bg-card border-2 transition-all duration-200 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0', error ? 'border-destructive' : 'border-border focus:border-red-500')} />
                {name.length > 0 && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{name.length}/50</span>}
              </div>
              {error && <div className="flex items-start gap-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300"><AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" /><p className="text-sm text-destructive">{error}</p></div>}
              <div className="flex gap-3">
                <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                <button onClick={handleNameSubmit} disabled={isLoading || name.trim().length < 2} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', name.trim().length >= 2 && !isLoading ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl hover:scale-[1.01]' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
                  {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" />{checking ? 'Checking...' : 'Saving...'}</> : <>Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GENDER */}
        {step === 'gender' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={2} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">What&apos;s your gender?</h2>
              <p className="text-muted-foreground">Optional — helps personalize your experience.</p>
            </div>
            <OptionGrid options={GENDERS} selected={gender} onSelect={(v) => setGender(gender === v ? '' : v)} />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl transition-all duration-300">
                {gender ? 'Continue' : 'Skip'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* AGE RANGE */}
        {step === 'age' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={3} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">What&apos;s your age range?</h2>
              <p className="text-muted-foreground">Helps us tailor training recommendations.</p>
            </div>
            <OptionGrid options={AGE_RANGES} selected={ageRange} onSelect={setAgeRange} />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={!ageRange} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', ageRange ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* SPORT */}
        {step === 'sport' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={4} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Pick your sport</h2>
              <p className="text-muted-foreground">Pick all that apply.</p>
            </div>
            <OptionGrid options={[...SPORTS]} selected={sport} onSelect={(s) => { setSport(s); setGoals([]); setTrainingForEvent(null); }} />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={!sport} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', sport ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* EVENT GATE */}
        {step === 'event' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={5} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Training for an event?</h2>
              <p className="text-muted-foreground">Are you working towards a specific race or goal?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[true, false].map((val) => (
                <button key={String(val)} type="button" onClick={() => setTrainingForEvent(val)} className={cn(
                  'relative px-6 py-6 rounded-xl border-2 text-center font-bold text-lg transition-all duration-200',
                  trainingForEvent === val
                    ? 'border-red-500 bg-red-500/10 text-foreground shadow-lg shadow-red-500/10'
                    : 'border-border hover:border-red-500/40 text-muted-foreground hover:text-foreground'
                )}>
                  {trainingForEvent === val && <Check className="absolute top-3 right-3 w-5 h-5 text-green-500" />}
                  {val ? 'Yes' : 'No, just training'}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={trainingForEvent === null} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', trainingForEvent !== null ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* GOALS (multi-select, only if training for event) */}
        {step === 'goals' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={6} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">What are you training for?</h2>
              <p className="text-muted-foreground">Pick all that apply.</p>
            </div>
            <OptionGrid options={GOAL_MAP[sport] || []} selected={goals} onSelect={toggleGoal} multi />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={goals.length === 0} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', goals.length > 0 ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* EXPERIENCE (optional) */}
        {step === 'experience' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={trainingForEvent === false ? 6 : 7} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Experience level</h2>
              <p className="text-muted-foreground">Optional — helps personalize your plan.</p>
            </div>
            <OptionGrid options={EXPERIENCE_LEVELS} selected={experience} onSelect={(v) => setExperience(experience === v ? '' : v)} />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl transition-all duration-300">
                {experience ? 'Continue' : 'Skip'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* AVAILABILITY (optional) */}
        {step === 'availability' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={trainingForEvent === false ? 7 : 8} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Weekly availability</h2>
              <p className="text-muted-foreground">Optional — how many days can you train?</p>
            </div>
            <OptionGrid options={AVAILABILITY} selected={availability} onSelect={(v) => setAvailability(availability === v ? '' : v)} />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl transition-all duration-300">
                {availability ? 'Continue' : 'Skip'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* PREVIEW / SUMMARY */}
        {step === 'preview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={visibleStepCount} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Your Starter Plan</h2>
              <p className="text-muted-foreground">Here&apos;s what we&apos;ll set up for you.</p>
            </div>

            <div className="rounded-2xl border-2 border-red-500/20 bg-card p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-green-500 flex items-center justify-center text-white font-black text-xl shadow-lg">{name.trim()[0]?.toUpperCase()}</div>
                <div>
                  <p className="font-bold text-lg">{name.trim()}</p>
                  <p className="text-sm text-muted-foreground">{sport}{goals.length > 0 ? ` · ${goals.join(', ')}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Age</p><p className="font-bold">{ageRange}</p></div>
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Sport</p><p className="font-bold">{sport}</p></div>
                {goals.length > 0 && <div className="rounded-xl bg-muted/50 p-3 col-span-2"><p className="text-xs text-muted-foreground uppercase tracking-wider">Events</p><p className="font-bold">{goals.join(', ')}</p></div>}
                {gender && <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Gender</p><p className="font-bold">{gender}</p></div>}
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Level</p><p className="font-bold">{experience || 'Not set'}</p></div>
              </div>

              {availability && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-center">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Training {availability}/week</p>
                </div>
              )}

              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">Suggested Week 1</p>
                {(GOAL_MAP[sport] || []).length > 0 && (
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />Easy {sport.toLowerCase()} — build base</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />Interval session — build speed</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />Long {sport.toLowerCase()} — build endurance</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Recovery / cross-training</li>
                  </ul>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={handleFinish} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-gradient-to-r from-red-600 to-green-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Setting up...</> : <>Let&apos;s Go <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

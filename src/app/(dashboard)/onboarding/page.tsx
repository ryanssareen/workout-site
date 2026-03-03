'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, Sparkles, ArrowRight, ArrowLeft, AlertCircle, Calendar, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SPORT_OPTIONS, TRAINING_FOR_OPTIONS } from '@/lib/schemas/profile';
import { FileUploadStep } from '@/components/onboarding/FileUploadStep';
import { ImportPreview } from '@/components/onboarding/ImportPreview';
import { AnalysisResult } from '@/lib/import/types';

type Step = 'intro' | 'name' | 'sports' | 'goals' | 'experience' | 'body' | 'import' | 'import-preview';
const STEPS: Step[] = ['intro', 'name', 'sports', 'goals', 'experience', 'body', 'import'];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to structured training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years of consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years, competed in events' },
  { value: 'elite', label: 'Elite', desc: 'Competitive athlete' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState(user?.displayName || '');
  const [sports, setSports] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [events, setEvents] = useState<Record<string, { eventName: string; eventDate: string }>>({});
  const [experience, setExperience] = useState('');
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const completingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (completingRef.current) return;
    if (user.onboardingCompleted !== false) router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => { setName(user?.displayName || ''); }, [user?.displayName]);
  useEffect(() => {
    if (step === 'name') setTimeout(() => inputRef.current?.focus(), 400);
  }, [step]);

  const stepIdx = step === 'import-preview' ? STEPS.indexOf('import') : STEPS.indexOf(step);
  const totalDots = STEPS.length - 1; // exclude intro

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 1) setStep(STEPS[i - 1]); // don't go back to intro
  };

  const toggleSport = (s: string) =>
    setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleGoal = (g: string) => {
    setGoals(prev => {
      if (prev.includes(g)) {
        const next = prev.filter(x => x !== g);
        const copy = { ...events };
        delete copy[g];
        setEvents(copy);
        return next;
      }
      return [...prev, g];
    });
  };

  const updateEvent = (goal: string, field: 'eventName' | 'eventDate', value: string) => {
    setEvents(prev => ({
      ...prev,
      [goal]: { ...prev[goal], [field]: value },
    }));
  };

  const handleNameSubmit = async () => {
    if (!user) return;
    setError('');
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }

    setChecking(true);
    try {
      const res = await fetch('/api/ai/profanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!data.isClean) { setError(data.reason || 'Inappropriate name. Please choose another.'); setChecking(false); return; }
    } catch { /* allow through */ }
    setChecking(false);
    goNext();
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    let heightCm: number | undefined;
    if (heightUnit === 'cm' && height) heightCm = parseFloat(height);
    else if (heightUnit === 'ft' && (heightFt || heightIn)) {
      heightCm = Math.round((parseFloat(heightFt) || 0) * 30.48 + (parseFloat(heightIn) || 0) * 2.54);
    }

    let weightKg: number | undefined;
    if (weight) {
      const w = parseFloat(weight);
      weightKg = weightUnit === 'lbs' ? Math.round(w * 0.453592 * 10) / 10 : w;
    }

    const eventsArr = goals
      .filter(g => g !== 'General Fitness')
      .map(g => ({
        goal: g,
        eventName: events[g]?.eventName || '',
        eventDate: events[g]?.eventDate || '',
      }));

    try {
      const updateData: any = {
        displayName: name.trim(),
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      };
      if (sports.length > 0) updateData.sportPreferences = sports;
      if (goals.length > 0) updateData.trainingFor = goals;
      if (eventsArr.length > 0) updateData.events = eventsArr;
      if (experience) updateData.experienceLevel = experience;
      if (heightCm && heightCm > 0) { updateData.height = heightCm; updateData.heightUnit = heightUnit; }
      if (weightKg && weightKg > 0) { updateData.weight = weightKg; updateData.weightUnit = weightUnit; }

      await updateDoc(doc(getDbInstance(), 'users', user.uid), updateData);

      completingRef.current = true;
      setUser({
        ...user,
        displayName: name.trim(),
        onboardingCompleted: true,
        sportPreferences: sports.length > 0 ? sports : user.sportPreferences,
        trainingFor: goals.length > 0 ? goals : user.trainingFor,
        events: eventsArr.length > 0 ? eventsArr : user.events,
        experienceLevel: experience || user.experienceLevel,
        ...(heightCm ? { height: heightCm, heightUnit } : {}),
        ...(weightKg ? { weight: weightKg, weightUnit } : {}),
      });

      const importMsg = importedCount > 0 ? ` ${importedCount} workout${importedCount !== 1 ? 's' : ''} imported!` : '';
      toast.success(`Welcome, ${name.trim()}!${importMsg}`);
      router.replace('/profile?edit=1');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (!user || (user.onboardingCompleted !== false && !completingRef.current)) return null;

  const isLoading = checking || saving;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/20 via-orange-400/10 to-rose-500/15 blur-3xl animate-pulse" />
        </div>

        {/* ── INTRO ── */}
        {step === 'intro' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-2xl shadow-primary/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary to-orange-500 opacity-20 blur-lg" />
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-primary via-orange-500 to-rose-500 bg-clip-text text-transparent">CoachTrack</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">Your personal training companion. Let&apos;s get you set up in seconds.</p>
            </div>
            <button onClick={() => setStep('name')} className={cn(
              'group inline-flex items-center gap-3 px-8 py-4 rounded-2xl',
              'bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-lg',
              'shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02]',
              'transition-all duration-300 ease-out'
            )}>
              Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ── Step dots + back (for non-intro steps) ── */}
        {step !== 'intro' && (
          <div className="mb-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalDots }).map((_, i) => (
                <div key={i} className={cn('w-8 h-1 rounded-full transition-colors', i < stepIdx ? 'bg-primary' : 'bg-muted')} />
              ))}
            </div>
          </div>
        )}

        {/* ── NAME ── */}
        {step === 'name' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What&apos;s your name?</h2>
              <p className="text-muted-foreground">This is how your coach and teammates will see you.</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input ref={inputRef} type="text" value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  maxLength={50} placeholder="Type your name..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) handleNameSubmit(); }}
                  className={cn(
                    'w-full px-6 py-5 text-xl sm:text-2xl font-medium rounded-2xl bg-card border-2 transition-all duration-200 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0',
                    error ? 'border-destructive' : 'border-border focus:border-primary'
                  )}
                />
                {name.length > 0 && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{name.length}/50</span>}
              </div>
              {error && (
                <div className="flex items-start gap-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" /><p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <PrimaryButton onClick={handleNameSubmit} disabled={isLoading || name.trim().length < 2}>
                {checking ? <><Loader2 className="w-5 h-5 animate-spin" />Checking...</> : <>Continue<ArrowRight className="w-5 h-5" /></>}
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── SPORTS ── */}
        {step === 'sports' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Your sports</h2>
              <p className="text-muted-foreground">Select the sports you train in.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SPORT_OPTIONS.map(sport => (
                <button key={sport} onClick={() => toggleSport(sport)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all duration-200',
                    sports.includes(sport)
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <span className="text-2xl">{sport === 'Running' ? '🏃' : sport === 'Cycling' ? '🚴' : sport === 'Swimming' ? '🏊' : '💪'}</span>
                  <p className="font-semibold mt-1">{sport}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} className="flex-[2]">
                {sports.length === 0 ? 'Skip' : 'Continue'}<ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── GOALS ── */}
        {step === 'goals' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Training goals</h2>
              <p className="text-muted-foreground">What are you training for? Select any that apply.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {TRAINING_FOR_OPTIONS.map(goal => (
                <button key={goal} onClick={() => toggleGoal(goal)}
                  className={cn(
                    'px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all duration-200',
                    goals.includes(goal)
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {goal}
                </button>
              ))}
            </div>

            {/* Event details for selected goals */}
            {goals.filter(g => g !== 'General Fitness' && g !== 'Other').length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-semibold text-muted-foreground">Event details <span className="font-normal">(optional)</span></p>
                {goals.filter(g => g !== 'General Fitness' && g !== 'Other').map(goal => (
                  <div key={goal} className="rounded-xl border bg-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold">{goal}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Event name"
                        value={events[goal]?.eventName || ''}
                        onChange={(e) => updateEvent(goal, 'eventName', e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border bg-background focus:border-primary focus:outline-none"
                      />
                      <div className="relative">
                        <input
                          type="date"
                          value={events[goal]?.eventDate || ''}
                          onChange={(e) => updateEvent(goal, 'eventDate', e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} className="flex-[2]">
                {goals.length === 0 ? 'Skip' : 'Continue'}<ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── EXPERIENCE LEVEL ── */}
        {step === 'experience' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Experience level</h2>
              <p className="text-muted-foreground">Helps us tailor workouts to your level.</p>
            </div>
            <div className="space-y-3">
              {EXPERIENCE_LEVELS.map(lvl => (
                <button key={lvl.value} onClick={() => setExperience(lvl.value)}
                  className={cn(
                    'w-full p-4 rounded-2xl border-2 text-left transition-all duration-200',
                    experience === lvl.value
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <p className="font-bold">{lvl.label}</p>
                  <p className="text-sm text-muted-foreground">{lvl.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} className="flex-[2]">
                {!experience ? 'Skip' : 'Continue'}<ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── HEIGHT & WEIGHT ── */}
        {step === 'body' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">About you</h2>
              <p className="text-muted-foreground">Helps with training zones and calorie estimates.</p>
            </div>
            <div className="space-y-6">
              {/* Height */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Height</label>
                  <UnitToggle value={heightUnit} options={[{ v: 'cm', l: 'cm' }, { v: 'ft', l: 'ft/in' }]} onChange={(v) => setHeightUnit(v as 'cm' | 'ft')} />
                </div>
                {heightUnit === 'cm' ? (
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 175"
                    className="w-full px-4 py-3 text-lg font-medium rounded-xl bg-card border-2 border-border focus:border-primary focus:outline-none transition-colors" />
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input type="number" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} placeholder="5"
                        className="w-full px-4 py-3 text-lg font-medium rounded-xl bg-card border-2 border-border focus:border-primary focus:outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">ft</span>
                    </div>
                    <div className="flex-1 relative">
                      <input type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} placeholder="10"
                        className="w-full px-4 py-3 text-lg font-medium rounded-xl bg-card border-2 border-border focus:border-primary focus:outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">in</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Weight</label>
                  <UnitToggle value={weightUnit} options={[{ v: 'kg', l: 'kg' }, { v: 'lbs', l: 'lbs' }]} onChange={(v) => setWeightUnit(v as 'kg' | 'lbs')} />
                </div>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                  placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
                  className="w-full px-4 py-3 text-lg font-medium rounded-xl bg-card border-2 border-border focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>
            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} className="flex-[2]">
                Continue<ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
            <p className="text-center text-xs text-muted-foreground">You can always update these in your profile settings.</p>
          </div>
        )}

        {/* ── IMPORT WORKOUTS ── */}
        {step === 'import' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FileUploadStep
              userId={user.uid}
              onAnalysisComplete={(result: AnalysisResult) => {
                setAnalysisResult(result);
                setStep('import-preview');
              }}
            />
            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={handleFinish} disabled={saving} className="flex-[2]">
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Setting up...</> : <>Skip & Finish<ArrowRight className="w-5 h-5" /></>}
              </PrimaryButton>
            </div>
            <p className="text-center text-xs text-muted-foreground">You can import workout history later from your profile.</p>
          </div>
        )}

        {/* ── IMPORT PREVIEW ── */}
        {step === 'import-preview' && analysisResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ImportPreview
              result={analysisResult}
              userId={user.uid}
              userName={name.trim()}
              onComplete={(count: number) => {
                setImportedCount(count);
                handleFinish();
              }}
              onBack={() => {
                setAnalysisResult(null);
                setStep('import');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared sub-components ── */
function PrimaryButton({ children, onClick, disabled, className }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
        disabled ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01]',
        className
      )}
    >{children}</button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-muted-foreground font-semibold text-base border-2 border-border hover:bg-muted transition-all duration-200"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}

function UnitToggle({ value, options, onChange }: {
  value: string; options: { v: string; l: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border overflow-hidden">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cn('px-3 py-1 text-xs font-semibold transition-colors', value === o.v ? 'bg-primary text-white' : 'hover:bg-muted')}
        >{o.l}</button>
      ))}
    </div>
  );
}

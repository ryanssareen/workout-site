'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check, CalendarIcon, X, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { FileUploadStep } from '@/components/onboarding/FileUploadStep';
import { ImportPreview } from '@/components/onboarding/ImportPreview';
import { AnalysisResult } from '@/lib/import/types';

const STEPS = ['intro', 'gender', 'age', 'sport', 'event', 'goals', 'experience', 'availability', 'import', 'preview'] as const;
type Step = typeof STEPS[number];

const GENDERS = ['Male', 'Female', 'Prefer not to say'];
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

interface GoalEvent {
  goal: string;
  eventName: string;
  eventDate?: string;
}

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
          {isSelected(opt) && <Check className="absolute top-2.5 right-2.5 w-4 h-4 text-red-500" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ── Goal Detail Popup ──────────────────────────────────────────────── */

function GoalDetailPopup({
  goal,
  event,
  onSave,
  onClose,
}: {
  goal: string;
  event?: GoalEvent;
  onSave: (e: GoalEvent) => void;
  onClose: () => void;
}) {
  const [eventName, setEventName] = useState(event?.eventName || '');
  const [eventDate, setEventDate] = useState<Date | undefined>(
    event?.eventDate ? new Date(event.eventDate) : undefined
  );

  const handleSave = () => {
    onSave({
      goal,
      eventName: eventName.trim(),
      eventDate: eventDate ? eventDate.toISOString().slice(0, 10) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl border-2 border-red-500/20 bg-card p-6 space-y-5 shadow-2xl shadow-red-600/10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{goal}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left: Event Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={`e.g. City ${goal}`}
              className="w-full px-3 py-3 rounded-xl border-2 border-border bg-background text-sm font-medium placeholder:text-muted-foreground/50 focus:border-red-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Right: Event Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Event Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-colors',
                    eventDate
                      ? 'border-red-500 bg-red-500/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-red-500/40'
                  )}
                >
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{eventDate ? format(eventDate, 'MMM d, yyyy') : 'Pick date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {eventDate && (
          <button type="button" onClick={() => setEventDate(undefined)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            Clear date
          </button>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="px-5 py-3 rounded-xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 px-5 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm shadow-lg shadow-red-600/25 hover:shadow-xl transition-all">
            {eventName || eventDate ? 'Save Details' : 'Add Without Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Onboarding ────────────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('intro');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [trainingForEvent, setTrainingForEvent] = useState<boolean | null>(null);
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([]);
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<AnalysisResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const goals = goalEvents.map((e) => e.goal);
  const firstEventDate = goalEvents.find((e) => e.eventDate)?.eventDate;

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (step === 'event' && trainingForEvent === false) {
      setGoalEvents([]);
      setStep('experience');
      return;
    }
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (step === 'experience' && trainingForEvent === false) {
      setStep('event');
      return;
    }
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const toggleSport = (s: string) => {
    setSports((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      const validGoals = next.flatMap((sp) => GOAL_MAP[sp] || []);
      setGoalEvents((ge) => ge.filter((e) => validGoals.includes(e.goal)));
      return next;
    });
  };

  const handleGoalClick = (goal: string) => {
    // If already selected, open edit popup
    if (goals.includes(goal)) {
      setEditingGoal(goal);
    } else {
      // New selection: open popup
      setEditingGoal(goal);
    }
  };

  const handleGoalSave = (event: GoalEvent) => {
    setGoalEvents((prev) => {
      const without = prev.filter((e) => e.goal !== event.goal);
      return [...without, event];
    });
  };

  const handleGoalRemove = (goal: string) => {
    setGoalEvents((prev) => prev.filter((e) => e.goal !== goal));
  };

  const availableGoals = sports.flatMap((s) => GOAL_MAP[s] || []);

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await updateDoc(doc(getDbInstance(), 'users', user.uid), {
        timezone: tz,
        onboardingCompleted: true,
        onboardingSkipped: true,
        updatedAt: serverTimestamp(),
      });
      setUser({ ...user, timezone: tz, onboardingCompleted: true, onboardingSkipped: true });
      router.replace('/dashboard');
    } catch { toast.error('Failed to skip — try again'); }
    finally { setSaving(false); }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data: Record<string, any> = {
        gender: gender || null,
        ageRange,
        sportPreferences: sports,
        trainingFor: goals.length > 0 ? goals : null,
        events: goalEvents.length > 0 ? goalEvents : null,
        eventDate: firstEventDate || null,
        experienceLevel: experience || null,
        weeklyAvailability: availability || null,
        timezone: tz,
        onboardingCompleted: true,
        onboardingSkipped: false,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(getDbInstance(), 'users', user.uid), data);
      setUser({
        ...user,
        gender: gender || undefined,
        ageRange,
        sportPreferences: sports,
        trainingFor: goals.length > 0 ? goals : undefined,
        events: goalEvents.length > 0 ? goalEvents : undefined,
        eventDate: firstEventDate || undefined,
        experienceLevel: experience || undefined,
        weeklyAvailability: availability || undefined,
        timezone: tz,
        onboardingCompleted: true,
        onboardingSkipped: false,
      });
      toast.success(`Welcome, ${user.displayName || 'Athlete'}!`);
      router.replace('/dashboard');
    } catch { toast.error('Failed to save — try again'); }
    finally { setSaving(false); }
  };

  if (!user) return null;

  const visibleStepCount = trainingForEvent === false ? 8 : 9;
  const displayName = user.displayName || 'Athlete';

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-red-600/20 via-red-900/10 to-red-500/15 blur-3xl animate-pulse" />
        </div>

        {/* Goal detail popup */}
        {editingGoal && (
          <GoalDetailPopup
            goal={editingGoal}
            event={goalEvents.find((e) => e.goal === editingGoal)}
            onSave={handleGoalSave}
            onClose={() => setEditingGoal(null)}
          />
        )}

        {/* Skip button */}
        {step !== 'intro' && (
          <div className="text-center mb-6 animate-in fade-in duration-300">
            <button onClick={handleSkip} disabled={saving} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50">
              Skip onboarding, I&apos;ll do this later
            </button>
          </div>
        )}

        {/* INTRO */}
        {step === 'intro' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-2xl shadow-red-600/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 opacity-20 blur-lg" />
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Welcome, <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">{displayName}</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">Let&apos;s build your athlete profile in under a minute.</p>
            </div>
            <div className="space-y-3">
              <button onClick={goNext} className={cn('group inline-flex items-center gap-3 px-8 py-4 rounded-2xl', 'bg-gradient-to-r from-red-600 to-red-800', 'text-white font-semibold text-lg', 'shadow-xl shadow-red-600/25', 'hover:shadow-2xl hover:scale-[1.02]', 'transition-all duration-300')}>
                Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div>
                <button onClick={handleSkip} disabled={saving} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50">
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GENDER */}
        {step === 'gender' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={1} total={visibleStepCount} />
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
            <StepDots current={2} total={visibleStepCount} />
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

        {/* SPORT (multi-select) */}
        {step === 'sport' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={3} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Pick your sports</h2>
              <p className="text-muted-foreground">Pick all that apply.</p>
            </div>
            <OptionGrid options={[...SPORTS]} selected={sports} onSelect={toggleSport} multi />
            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={sports.length === 0} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', sports.length > 0 ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* EVENT GATE */}
        {step === 'event' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={4} total={visibleStepCount} />
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
                  {trainingForEvent === val && <Check className="absolute top-3 right-3 w-5 h-5 text-red-500" />}
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

        {/* GOALS — tap to open detail popup */}
        {step === 'goals' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={5} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">What are you training for?</h2>
              <p className="text-muted-foreground">Tap a goal to add event details.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {availableGoals.map((goal) => {
                const selected = goals.includes(goal);
                const event = goalEvents.find((e) => e.goal === goal);
                return (
                  <div key={goal} className="relative">
                    <button
                      type="button"
                      onClick={() => handleGoalClick(goal)}
                      className={cn(
                        'w-full px-4 py-4 rounded-xl border-2 text-left font-medium transition-all duration-200',
                        selected
                          ? 'border-red-500 bg-red-500/10 text-foreground shadow-lg shadow-red-500/10'
                          : 'border-border hover:border-red-500/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{goal}</span>
                        {selected && <Check className="w-4 h-4 text-red-500 shrink-0" />}
                      </div>
                      {/* Show event details below goal name */}
                      {event && (event.eventName || event.eventDate) && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {event.eventName && <span className="truncate">{event.eventName}</span>}
                          {event.eventName && event.eventDate && <span>·</span>}
                          {event.eventDate && <span className="shrink-0">{format(new Date(event.eventDate), 'MMM d')}</span>}
                        </div>
                      )}
                    </button>
                    {/* Remove button */}
                    {selected && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleGoalRemove(goal); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={goals.length === 0} className={cn('flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300', goals.length > 0 ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl' : 'bg-muted text-muted-foreground cursor-not-allowed')}>Continue <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* EXPERIENCE */}
        {step === 'experience' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={trainingForEvent === false ? 5 : 6} total={visibleStepCount} />
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

        {/* AVAILABILITY */}
        {step === 'availability' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={trainingForEvent === false ? 6 : 7} total={visibleStepCount} />
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

        {/* IMPORT WORKOUT HISTORY */}
        {step === 'import' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={trainingForEvent === false ? 7 : 8} total={visibleStepCount} />

            {!importResult ? (
              <>
                <FileUploadStep
                  userId={user.uid}
                  onAnalysisComplete={(data: AnalysisResult) => setImportResult(data)}
                />
                <div className="flex gap-3">
                  <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                  <button onClick={goNext} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl transition-all duration-300">
                    Skip <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <ImportPreview
                result={importResult}
                userId={user.uid}
                userName={user.displayName || ''}
                onComplete={(count: number) => {
                  setImportedCount(count);
                  goNext();
                }}
                onBack={() => setImportResult(null)}
              />
            )}
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StepDots current={visibleStepCount} total={visibleStepCount} />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Your Starter Plan</h2>
              <p className="text-muted-foreground">Here&apos;s what we&apos;ll set up for you.</p>
            </div>

            <div className="rounded-2xl border-2 border-red-500/20 bg-card p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white font-black text-xl shadow-lg">{displayName[0]?.toUpperCase()}</div>
                <div>
                  <p className="font-bold text-lg">{displayName}</p>
                  <p className="text-sm text-muted-foreground">{sports.join(', ')}{goals.length > 0 ? ` · ${goals.join(', ')}` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Age</p><p className="font-bold">{ageRange}</p></div>
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Sports</p><p className="font-bold">{sports.join(', ')}</p></div>
                {goalEvents.length > 0 && (
                  <div className="rounded-xl bg-muted/50 p-3 col-span-2 space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Events</p>
                    {goalEvents.map((e) => (
                      <div key={e.goal} className="flex items-center justify-between">
                        <p className="font-bold text-sm">{e.eventName || e.goal}</p>
                        {e.eventDate && <p className="text-xs text-muted-foreground">{format(new Date(e.eventDate), 'MMM d, yyyy')}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {gender && <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Gender</p><p className="font-bold">{gender}</p></div>}
                <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Level</p><p className="font-bold">{experience || 'Not set'}</p></div>
              </div>

              {availability && (
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-center">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Training {availability}/week</p>
                </div>
              )}

              {importedCount > 0 && (
                <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3 text-center">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ {importedCount} past workouts imported</p>
                </div>
              )}

              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">Suggested Week 1</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />Easy session — build base</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />Interval session — build speed</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />Long session — build endurance</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Recovery / cross-training</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={goBack} className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={handleFinish} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg bg-gradient-to-r from-red-600 to-red-800 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Setting up...</> : <>Let&apos;s Go <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  SPORT_OPTIONS,
  TRAINING_FOR_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from '@/lib/schemas/profile';
import { getProfileCompletionInfo } from '@/components/dashboard/ProfileCompletionBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type Step = 'sports' | 'goals' | 'experience' | 'body';
const STEPS: Step[] = ['sports', 'goals', 'experience', 'body'];

const SPORT_EMOJI: Record<string, string> = {
  'Running': '🏃',
  'Cycling': '🚴',
  'Swimming': '🏊',
  'Strength Training': '💪',
};

export default function OnboardingProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('sports');
  const [sports, setSports] = useState<string[]>(user?.sportPreferences || []);
  const [goals, setGoals] = useState<string[]>(user?.trainingFor || []);
  const [experience, setExperience] = useState<string>(user?.experienceLevel || '');
  const [height, setHeight] = useState<number | null>(user?.height ?? null);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(user?.heightUnit || 'cm');
  const [weight, setWeight] = useState<number | null>(user?.weight ?? null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(user?.weightUnit || 'kg');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Pre-fill from existing user data
    if (user.sportPreferences?.length) setSports(user.sportPreferences);
    if (user.trainingFor?.length) setGoals(user.trainingFor);
    if (user.experienceLevel) setExperience(user.experienceLevel);
    if (user.height) setHeight(user.height);
    if (user.heightUnit) setHeightUnit(user.heightUnit);
    if (user.weight) setWeight(user.weight);
    if (user.weightUnit) setWeightUnit(user.weightUnit);
  }, [user]);

  const stepIdx = STEPS.indexOf(step);
  const isLastStep = stepIdx === STEPS.length - 1;

  const goNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStep(STEPS[stepIdx + 1]);
    }
  };

  const goBack = () => {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  };

  const toggleSport = (sport: string) => {
    setSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport],
    );
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Calculate new completion percentage
      const updatedUser = {
        ...user,
        sportPreferences: sports,
        trainingFor: goals,
        experienceLevel: experience || undefined,
        height: height ?? undefined,
        heightUnit,
        weight: weight ?? undefined,
        weightUnit,
      };
      const completionInfo = getProfileCompletionInfo(updatedUser as any);

      await updateDoc(doc(getDbInstance(), 'users', user.username), {
        sportPreferences: sports,
        trainingFor: goals,
        experienceLevel: experience || null,
        height: height || null,
        heightUnit,
        weight: weight || null,
        weightUnit,
        profileCompleted: completionInfo.percentage,
        updatedAt: serverTimestamp(),
      });

      setUser({
        ...user,
        sportPreferences: sports,
        trainingFor: goals,
        experienceLevel: experience || undefined,
        height: height ?? undefined,
        heightUnit,
        weight: weight ?? undefined,
        weightUnit,
        profileCompleted: completionInfo.percentage,
      });

      toast.success('Profile updated! 🎉');
      router.replace('/dashboard');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/20 via-orange-400/10 to-rose-500/15 blur-3xl animate-pulse" />
        </div>

        {/* Progress dots */}
        <div className="mb-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-8 h-1 rounded-full transition-colors',
                  i <= stepIdx ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>
        </div>

        {/* ── STEP 1: SPORTS ── */}
        {step === 'sports' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Pick your sports
              </h2>
              <p className="text-muted-foreground">Select the sports you train for.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SPORT_OPTIONS.map((sport) => (
                <button
                  key={sport}
                  onClick={() => toggleSport(sport)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-center font-semibold text-base transition-all duration-200',
                    sports.includes(sport)
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="text-2xl block mb-1">
                    {SPORT_EMOJI[sport] || '⚡'}
                  </span>
                  {sport}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <PrimaryButton onClick={goNext} disabled={false}>
                {sports.length > 0 ? 'Continue' : 'Skip'}
                <ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── STEP 2: TRAINING GOALS ── */}
        {step === 'goals' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                What are you training for?
              </h2>
              <p className="text-muted-foreground">
                Select events or goals you&apos;re working towards.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TRAINING_FOR_OPTIONS.map((goal) => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200',
                    goals.includes(goal)
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  {goals.includes(goal) && (
                    <CheckCircle2 className="inline w-3.5 h-3.5 mr-1.5 text-primary" />
                  )}
                  {goal}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} disabled={false} className="flex-[2]">
                {goals.length > 0 ? 'Continue' : 'Skip'}
                <ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── STEP 3: EXPERIENCE LEVEL ── */}
        {step === 'experience' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Experience level?
              </h2>
              <p className="text-muted-foreground">
                Helps us tailor recommendations to your level.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
                <button
                  key={level}
                  onClick={() => setExperience(level)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-center font-semibold text-lg transition-all duration-200',
                    experience === level
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} disabled={false} className="flex-[2]">
                {experience ? 'Continue' : 'Skip'}
                <ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── STEP 4: BODY METRICS ── */}
        {step === 'body' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Body metrics
              </h2>
              <p className="text-muted-foreground">
                Optional — used for pace zones and calorie estimates.
              </p>
            </div>

            <div className="space-y-6">
              {/* Height */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Height
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={heightUnit === 'ft' ? 'e.g. 170' : 'e.g. 175'}
                    value={height ?? ''}
                    onChange={(e) =>
                      setHeight(e.target.value ? Number(e.target.value) : null)
                    }
                    className="flex-1 h-14 text-lg rounded-xl"
                  />
                  <Select
                    value={heightUnit}
                    onValueChange={(val) => setHeightUnit(val as 'cm' | 'ft')}
                  >
                    <SelectTrigger className="w-20 h-14 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="ft">ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Weight */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Weight
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={weightUnit === 'lbs' ? 'e.g. 165' : 'e.g. 75'}
                    value={weight ?? ''}
                    onChange={(e) =>
                      setWeight(e.target.value ? Number(e.target.value) : null)
                    }
                    className="flex-1 h-14 text-lg rounded-xl"
                  />
                  <Select
                    value={weightUnit}
                    onValueChange={(val) => setWeightUnit(val as 'kg' | 'lbs')}
                  >
                    <SelectTrigger className="w-20 h-14 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <BackButton onClick={goBack} />
                <PrimaryButton
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-[2]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Finish
                    </>
                  )}
                </PrimaryButton>
              </div>
              <button
                onClick={() => {
                  // Skip body metrics and finish
                  handleFinish();
                }}
                disabled={saving}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared sub-components (matching Onboarding Part 1 style) ── */
function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
        disabled
          ? 'bg-muted text-muted-foreground cursor-not-allowed'
          : 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-muted-foreground font-semibold text-base border-2 border-border hover:bg-muted transition-all duration-200"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}

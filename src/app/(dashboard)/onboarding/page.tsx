'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, Sparkles, ArrowRight, ArrowLeft, AlertCircle, Link2, Upload, FileSpreadsheet, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { track } from '@/lib/posthog';

type Step = 'intro' | 'name' | 'age' | 'import' | 'strava';
const STEPS: Step[] = ['intro', 'name', 'age', 'import', 'strava'];

const AGE_RANGES = [
  { value: 'under-18', label: 'Under 18' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55-64', label: '55–64' },
  { value: '65+', label: '65+' },
];

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState(user?.displayName || '');
  const [ageRange, setAgeRange] = useState(user?.ageRange || '');

  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const completingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; summary: string } | null>(null);
  const [importError, setImportError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (completingRef.current) return;
    if (user.onboardingCompleted !== false) router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => { setName(user?.displayName || ''); }, [user?.displayName]);
  useEffect(() => {
    if (step === 'name') setTimeout(() => inputRef.current?.focus(), 400);
  }, [step]);

  // Progress dots (exclude intro)
  const stepIdx = STEPS.indexOf(step);
  const totalDots = STEPS.length - 1; // 4 dots for name, age, import, strava

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 1) setStep(STEPS[i - 1]); // don't go back to intro
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

  const handleFinish = async (connectStrava: boolean) => {
    if (!user) return;
    setSaving(true);

    try {
      const updateData: Record<string, unknown> = {
        displayName: name.trim(),
        ageRange,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(getDbInstance(), 'users', user.username), updateData);

      completingRef.current = true;
      setUser({
        ...user,
        displayName: name.trim(),
        ageRange,
        onboardingCompleted: true,
      });

      track('onboarding_completed', { strava_connect_chosen: connectStrava });

      if (connectStrava) {
        // Redirect to Strava OAuth — it will come back to /settings?strava=connected
        // then user lands on dashboard
        window.location.href = `/api/auth/strava/authorize?userId=${user.uid}&username=${user.username}&from=onboarding`;
        return;
      }

      toast.success(`Welcome, ${name.trim()}!`);
      router.replace('/dashboard');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Import handlers ──
  const validateFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setImportError('Please upload a CSV or XLSX file.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportError('File is too large. Maximum 10 MB.');
      return false;
    }
    return true;
  };

  const handleFileSelect = (file: File) => {
    setImportError('');
    setImportResult(null);
    if (validateFile(file)) {
      setImportFile(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleImport = async () => {
    if (!importFile || !user) return;
    setImporting(true);
    setImportError('');

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('username', user.username);

      const res = await fetch('/api/workouts/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || 'Failed to import workouts');
        return;
      }

      setImportResult({ created: data.created, summary: data.summary });
      toast.success(`Imported ${data.created} workouts!`);
    } catch (err: any) {
      setImportError(err.message || 'Failed to import workouts');
    } finally {
      setImporting(false);
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
                <span className="bg-gradient-to-r from-primary via-orange-500 to-rose-500 bg-clip-text text-transparent">The Daily Athlete</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">Let&apos;s get you set up in 30 seconds.</p>
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

        {/* ── Step dots (for non-intro steps) ── */}
        {step !== 'intro' && (
          <div className="mb-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalDots }).map((_, i) => (
                <div key={i} className={cn('w-8 h-1 rounded-full transition-colors', i < stepIdx ? 'bg-primary' : 'bg-muted')} />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 1: NAME ── */}
        {step === 'name' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What&apos;s your name?</h2>
              <p className="text-muted-foreground">This is how you&apos;ll appear on the platform.</p>
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

        {/* ── STEP 2: AGE RANGE ── */}
        {step === 'age' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How old are you?</h2>
              <p className="text-muted-foreground">Helps us personalize your training intensity.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AGE_RANGES.map(range => (
                <button key={range.value} onClick={() => setAgeRange(range.value)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-center font-semibold text-lg transition-all duration-200',
                    ageRange === range.value
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} disabled={!ageRange} className="flex-[2]">
                Continue<ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── STEP 3: IMPORT WORKOUTS ── */}
        {step === 'import' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Import History</h2>
              <p className="text-muted-foreground">Got a workout export? Upload it and we&apos;ll do the rest.</p>
            </div>

            {/* Success state */}
            {importResult && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-500">{importResult.created} workouts imported!</p>
                    <p className="text-xs text-muted-foreground">{typeof importResult.summary === 'string' ? importResult.summary : JSON.stringify(importResult.summary)}</p>
                  </div>
                </div>
                <button onClick={clearImport} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Upload another file
                </button>
              </div>
            )}

            {/* Upload area */}
            {!importResult && (
              <div className="space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200',
                    dragActive
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : importFile
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />

                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">{importFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(importFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearImport(); }}
                        className="p-1.5 rounded-full hover:bg-muted transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                      <div>
                        <p className="text-sm font-medium">Drop your file here or tap to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          CSV or XLSX from Strava, Garmin, Apple Health, etc.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {importError && (
                  <div className="flex items-start gap-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{importError}</p>
                  </div>
                )}

                {importFile && !importing && (
                  <PrimaryButton onClick={handleImport} disabled={importing}>
                    <Upload className="w-5 h-5" />Import Workouts
                  </PrimaryButton>
                )}

                {importing && (
                  <div className="rounded-2xl border bg-card p-5 space-y-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <div>
                        <p className="text-sm font-medium">Analyzing your workouts...</p>
                        <p className="text-xs text-muted-foreground">AI is reading your file and creating workouts</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <BackButton onClick={goBack} />
              <PrimaryButton onClick={goNext} disabled={importing} className="flex-[2]">
                {importResult || !importFile ? (
                  <>Continue<ArrowRight className="w-5 h-5" /></>
                ) : (
                  <>Skip<ArrowRight className="w-5 h-5" /></>
                )}
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── STEP 4: CONNECT STRAVA ── */}
        {step === 'strava' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Connect Strava</h2>
              <p className="text-muted-foreground">Auto-sync your workouts and unlock AI insights.</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                {[
                  { emoji: '🔄', text: 'Auto-import all your workouts' },
                  { emoji: '🗺️', text: 'See your routes on a map' },
                  { emoji: '🤖', text: 'Get AI-powered training insights' },
                  { emoji: '📊', text: 'Beautiful shareable reports' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <span className="text-lg">{item.emoji}</span>
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <PrimaryButton onClick={() => handleFinish(true)} disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Connecting...</>
                ) : (
                  <><Link2 className="w-5 h-5" />Connect Strava</>
                )}
              </PrimaryButton>
              <button
                onClick={() => handleFinish(false)}
                disabled={saving}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Skip for now
              </button>
            </div>

            <div className="flex justify-start">
              <BackButton onClick={goBack} />
            </div>
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
        'flex-1 w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300',
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, FileText, Loader2, AlertCircle, Sparkles, LayoutDashboard, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { StructuredReport } from '@/types/reports';
import { ReportContainer } from '@/components/reports/ReportContainer';
import { ReportsDashboard } from '@/components/reports/dashboard/ReportsDashboard';
import { DuplicateRemover } from '@/components/reports/dashboard/DuplicateRemover';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { cn } from '@/lib/utils';

const EXAMPLE_REQUESTS = [
  "Performance report for last 30 days",
  "Compare my athletes' completion rates this month",
  "Show my workout breakdown by type for the last 90 days",
  "Summary of missed workouts this week",
  "Overall progress report for this quarter",
  "Detailed analysis of my training consistency",
];

type Tab = 'dashboard' | 'ai-reports' | 'duplicates';

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);

  // AI Reports state
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [insufficientMessage, setInsufficientMessage] = useState<string>('');
  const [showReport, setShowReport] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [repTimer, setRepTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    setLoadingWorkouts(true);
    try {
      const role = user.role === 'student' ? 'athlete' : user.role;
      const data = await getUserWorkouts(user.uid, role as 'coach' | 'athlete');
      setWorkouts(data);
    } catch (err) {
      console.error('Failed to fetch workouts:', err);
    } finally {
      setLoadingWorkouts(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    return () => {
      if (repTimer) clearInterval(repTimer);
    };
  }, [repTimer]);

  const isCoach = user?.role === 'coach';

  const handleGenerateReport = async (request?: string) => {
    const queryText = request || input.trim();
    if (!queryText || !user) {
      toast.error('Please describe what report you want');
      return;
    }

    setGenerating(true);
    if (repTimer) {
      clearInterval(repTimer);
      setRepTimer(null);
    }
    const timer = setInterval(() => setRepCount((c) => c + 1), 1000);
    setRepTimer(timer);

    try {
      const response = await fetch('/api/ai/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      if (data.isInsufficient) {
        setReport(null);
        setInsufficientMessage(data.insufficientMessage || 'Not enough data available.');
        setShowReport(true);
        toast.info('Insufficient data for detailed report');
      } else {
        setReport(data.report);
        setInsufficientMessage('');
        setShowReport(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
      if (repTimer) clearInterval(repTimer);
      setRepTimer(null);
      setTimeout(() => setRepCount(0), 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateReport();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'ai-reports', label: 'AI Reports', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'duplicates', label: 'Duplicates', icon: <Copy className="h-4 w-4" /> },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your training, generate AI reports, and clean up duplicates
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        loadingWorkouts ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading your data...</span>
          </div>
        ) : (
          <ReportsDashboard workouts={workouts} />
        )
      )}

      {/* AI Reports Tab */}
      {tab === 'ai-reports' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Report</CardTitle>
              <CardDescription>
                {isCoach
                  ? "Ask for any report about your athletes (e.g., 'Performance report for last 30 days')"
                  : "Ask for any report about your workouts (e.g., 'Show my bench press progress this month')"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isCoach
                  ? "e.g., Compare my athletes' completion rates this month"
                  : "e.g., Show my workout progress this week with charts"}
                className="min-h-[100px] resize-none"
                disabled={generating}
              />
              {generating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Generating your report... keep moving!
                </div>
              )}

              <Button
                onClick={() => handleGenerateReport()}
                disabled={generating || !input.trim()}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Press Enter to generate, Shift+Enter for new line
              </p>

              {generating && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">Do quick reps while you wait</p>
                    <p className="text-xs text-primary/80">Click the button below or let the auto-timer rack up reps.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary leading-none">{repCount}</p>
                      <p className="text-[11px] uppercase tracking-wide text-primary/80">reps</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRepCount((c) => c + 5)}
                      className="bg-primary text-white hover:bg-primary/90 border-0"
                      disabled={!generating}
                    >
                      Add 5
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Example Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMPLE_REQUESTS.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(example);
                      handleGenerateReport(example);
                    }}
                    disabled={generating}
                    className="text-left px-3 py-2 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors text-sm disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duplicates Tab */}
      {tab === 'duplicates' && (
        loadingWorkouts ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-amber-500" />
                Duplicate Workout Detection
              </CardTitle>
              <CardDescription>
                Automatically finds workouts that look like duplicates (same Strava ID, same name + date, or very similar timing)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DuplicateRemover workouts={workouts} onWorkoutsChanged={fetchWorkouts} />
            </CardContent>
          </Card>
        )
      )}

      {/* Report Modal (AI) */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none overflow-y-auto p-6">
          <DialogTitle className="sr-only">Report</DialogTitle>
          <DialogDescription className="sr-only">
            Generated performance report details
          </DialogDescription>
          {insufficientMessage ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20 mb-4">
                <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Insufficient Information</h2>
              <p className="max-w-md text-muted-foreground mb-4">
                {insufficientMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                Try requesting a different report or add more workout data.
              </p>
            </div>
          ) : report ? (
            <ReportContainer report={report} userName={user.displayName} userEmail={user.email || undefined} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          [data-report-container],
          [data-report-container] * {
            visibility: visible !important;
          }

          [data-report-container] {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1rem !important;
          }

          [data-radix-dialog-overlay],
          [data-radix-dialog-close-button] {
            display: none !important;
          }

          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          @page {
            margin: 0.5in;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}

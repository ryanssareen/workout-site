'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3, Loader2, LayoutDashboard, Copy, TrendingUp, Zap,
  Calendar, PieChart, Activity, Share2, Mail, CheckCircle2, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DuplicateRemover } from '@/components/reports/dashboard/DuplicateRemover';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { cn } from '@/lib/utils';
import {
  DashboardOverview,
  TrainingAnalysis,
  ExerciseInsights,
  CalendarViews,
  TypeDistribution,
} from '@/components/reports/dashboard/ReportsSections';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';

type Section = 'dashboard' | 'training' | 'insights' | 'calendar' | 'distribution' | 'duplicates' | 'email';

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'training', label: 'Training Analysis', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'insights', label: 'Exercise Insights', icon: <Zap className="h-4 w-4" /> },
  { id: 'calendar', label: 'Calendar Views', icon: <Calendar className="h-4 w-4" /> },
  { id: 'distribution', label: 'Type Distribution', icon: <PieChart className="h-4 w-4" /> },
  { id: 'duplicates', label: 'Duplicates', icon: <Copy className="h-4 w-4" /> },
  { id: 'email', label: 'Email Report', icon: <Mail className="h-4 w-4" /> },
];

const PERIOD_OPTIONS = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
];

const getTimeGreeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
};

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [section, setSection] = useState<Section>('dashboard');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [ready, setReady] = useState(false);
  const [emailPeriod, setEmailPeriod] = useState(30);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Time-aware greeting stamped once per page render to keep it consistent
  const generatedAt = useMemo(() => new Date(), []);
  const firstName = useMemo(
    () => (user?.displayName ? user.displayName.split(' ')[0] || user.displayName : 'Athlete'),
    [user?.displayName],
  );
  const greeting = useMemo(() => getTimeGreeting(generatedAt), [generatedAt]);

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
      setTimeout(() => setReady(true), 120);
    }
  }, [user]);

  useEffect(() => { fetchWorkouts(); }, [fetchWorkouts]);

  const handleSendEmail = async () => {
    if (!user) return;
    setSendingEmail(true);
    setEmailSent(false);
    try {
      const res = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, periodDays: emailPeriod }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send report');
      }
      setEmailSent(true);
      toast.success('Report sent to your email!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email report');
    } finally {
      setSendingEmail(false);
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

  const renderContent = () => {
    if (loadingWorkouts || !ready) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading your data...</span>
        </div>
      );
    }
    switch (section) {
      case 'dashboard': return <DashboardOverview workouts={workouts} />;
      case 'training': return <TrainingAnalysis workouts={workouts} />;
      case 'insights': return <ExerciseInsights workouts={workouts} />;
      case 'calendar': return <CalendarViews workouts={workouts} />;
      case 'distribution': return <TypeDistribution workouts={workouts} />;
      case 'duplicates': return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-amber-500" />
              Duplicate Workout Detection
            </CardTitle>
            <CardDescription>
              Automatically finds workouts that look like duplicates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DuplicateRemover workouts={workouts} onWorkoutsChanged={fetchWorkouts} />
          </CardContent>
        </Card>
      );
      case 'email': return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Email Report to Yourself
            </CardTitle>
            <CardDescription>
              Send a workout summary to <span className="font-medium text-foreground">{user.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Select time period</p>
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setEmailPeriod(opt.value); setEmailSent(false); }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                      emailPeriod === opt.value
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/40 shadow-sm'
                        : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
              <p className="text-sm font-medium">Your report will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />Completion rate for the last {emailPeriod} days</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />Workout breakdown by type (run, bike, swim, strength)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />Strava stats (if connected)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />Motivational feedback based on your progress</li>
              </ul>
            </div>

            {emailSent ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-500">Report sent!</p>
                  <p className="text-xs text-muted-foreground">Check your inbox at {user.email}</p>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="gap-2"
              >
                {sendingEmail ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4" />Send {emailPeriod}-Day Report</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }
  };

  const sectionLabel = NAV_ITEMS.find(n => n.id === section)?.label || 'Reports';
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/reports` : '';
  const shareText = `📊 Check out my ${sectionLabel} on The Daily Athlete!\n${workouts.length} workouts tracked`;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your training performance and insights
          </p>
          <div className="mt-1.5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Hi {firstName}, {greeting}.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowShare(!showShare)} className="gap-2 shrink-0 self-start">
          <Share2 className="h-4 w-4" />
          Share Reports
        </Button>
      </div>

      {/* Share modal overlay */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <ShareButtons
              title="Share Your Reports"
              shareText={shareText}
              shareUrl={shareUrl}
              fileName={`daily-athlete-${sectionLabel.toLowerCase().replace(/\s+/g, '-')}`}
              cardRef={contentRef}
              onClose={() => setShowShare(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile: Horizontal scroll nav */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 mb-3 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0',
              section === item.id
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground active:bg-muted'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Layout: Sidebar + Content */}
      <div className="flex gap-4 md:gap-6">
        {/* Left Sidebar — desktop only */}
        <nav className="hidden md:flex flex-col w-48 lg:w-56 shrink-0 sticky top-24 self-start">
          <div className="space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left',
                  section === item.id
                    ? 'bg-red-500/15 text-red-500 shadow-sm border border-red-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0 w-full" ref={contentRef}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

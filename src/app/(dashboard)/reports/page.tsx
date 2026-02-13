'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3, Loader2, LayoutDashboard, Copy, TrendingUp, Zap,
  Calendar, PieChart, Activity, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DuplicateRemover } from '@/components/reports/dashboard/DuplicateRemover';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  DashboardOverview,
  TrainingAnalysis,
  ExerciseInsights,
  CalendarViews,
  TypeDistribution,
} from '@/components/reports/dashboard/ReportsSections';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';

type Section = 'dashboard' | 'training' | 'insights' | 'calendar' | 'distribution' | 'duplicates';

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'training', label: 'Training Analysis', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'insights', label: 'Exercise Insights', icon: <Zap className="h-4 w-4" /> },
  { id: 'calendar', label: 'Calendar Views', icon: <Calendar className="h-4 w-4" /> },
  { id: 'distribution', label: 'Type Distribution', icon: <PieChart className="h-4 w-4" /> },
  { id: 'duplicates', label: 'Duplicates', icon: <Copy className="h-4 w-4" /> },
];

const getTimeGreeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
};

const getTimeZoneAbbreviation = (date: Date) =>
  new Intl.DateTimeFormat([], { timeZoneName: 'short' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value || '';

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [section, setSection] = useState<Section>('dashboard');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [ready, setReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Time-aware greeting stamped once per page render to keep it consistent
  const generatedAt = useMemo(() => new Date(), []);
  const firstName = useMemo(
    () => (user?.displayName ? user.displayName.split(' ')[0] || user.displayName : 'Athlete'),
    [user?.displayName],
  );
  const greeting = useMemo(() => getTimeGreeting(generatedAt), [generatedAt]);
  const timeZoneAbbr = useMemo(() => getTimeZoneAbbreviation(generatedAt), [generatedAt]);
  const timeLabel = useMemo(
    () => `${format(generatedAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}${timeZoneAbbr ? ` ${timeZoneAbbr}` : ''}`,
    [generatedAt, timeZoneAbbr],
  );

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
    }
  };

  const sectionLabel = NAV_ITEMS.find(n => n.id === section)?.label || 'Reports';
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/reports` : '';
  const shareText = `📊 Check out my ${sectionLabel} on CoachTrack!\n${workouts.length} workouts tracked`;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your training performance and insights
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Hi {firstName}, {greeting}.</p>
            <p>{timeLabel}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowShare(!showShare)} className="gap-2 shrink-0">
          <Share2 className="h-4 w-4" />
          Share Reports
        </Button>
      </div>

      {/* Share panel */}
      {showShare && (
        <div className="mb-6">
          <ShareButtons
            title="Share Your Reports"
            shareText={shareText}
            shareUrl={shareUrl}
            fileName={`coachtrack-${sectionLabel.toLowerCase().replace(/\s+/g, '-')}`}
            cardRef={contentRef}
            onClose={() => setShowShare(false)}
          />
        </div>
      )}

      {/* Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <nav className="hidden md:flex flex-col w-56 shrink-0 sticky top-24 self-start">
          <div className="space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left',
                  section === item.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile: Horizontal scroll nav */}
        <div className="md:hidden flex gap-1 overflow-x-auto pb-3 -mx-2 px-2 mb-2 w-full">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0',
                section === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0" ref={contentRef}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

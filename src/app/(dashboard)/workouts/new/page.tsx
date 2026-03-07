'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { WorkoutPreviewDialog } from '@/components/workouts/WorkoutPreviewDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { ArrowLeft, BookmarkCheck, Loader2, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewWorkoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateData, setTemplateData] = useState<any>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [createdWorkoutData, setCreatedWorkoutData] = useState<WorkoutSchema | null>(null);
  const [createdWorkoutId, setCreatedWorkoutId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<WorkoutSchema | null>(null);

  const templateId = searchParams.get('templateId');
  const aiGenerated = searchParams.get('aiGenerated') === 'true';
  const dateParam = searchParams.get('date'); // e.g. "2026-03-07" from calendar
  const tagParam = searchParams.get('tag');   // e.g. "race" from calendar event
  const isNote = searchParams.get('note') === 'true'; // calendar "Add Note"

  const isCoach = user?.role === 'coach';
  const isUnconnectedAthlete = (user?.role === 'athlete' || user?.role === 'student') && !user?.coachUsername;

  useEffect(() => {
    async function loadStudents() {
      if (!user || user.role !== 'coach') return;

      const data = await getCoachStudents(user.username);
      setStudents(data);
    }

    loadStudents();
  }, [user]);

  // Load template if templateId is provided
  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) return;

      setLoadingTemplate(true);
      try {
        const response = await fetch(`/api/templates/${templateId}`);
        if (response.ok) {
          const template = await response.json();
          setTemplateData(template);
          toast.success(`Loaded template: ${template.name}`);
        }
      } catch (error) {
        toast.error('Failed to load template');
      } finally {
        setLoadingTemplate(false);
      }
    }

    loadTemplate();
  }, [templateId]);

  // Load AI-generated workout data from sessionStorage
  useEffect(() => {
    if (aiGenerated) {
      try {
        const storedData = sessionStorage.getItem('aiWorkoutData');
        if (storedData) {
          const aiWorkout = JSON.parse(storedData);
          setTemplateData(aiWorkout);
          sessionStorage.removeItem('aiWorkoutData');
          toast.success('AI-generated workout loaded! Modify and assign as needed.');
        }
      } catch (error) {
        console.error('Failed to load AI workout data:', error);
        toast.error('Failed to load AI workout data');
      }
    }
  }, [aiGenerated]);

  // Redirect if not authorized (must be coach OR unconnected athlete)
  useEffect(() => {
    if (authLoading) return;
    const canCreate = user?.role === 'coach' || ((user?.role === 'athlete' || user?.role === 'student') && !user?.coachUsername);
    if (user && !canCreate) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (data: WorkoutSchema) => {
    // Show preview instead of creating immediately
    setPreviewData(data);
    setShowPreview(true);
  };

  const handleConfirmCreate = async () => {
    if (!user || !previewData) return;
    const data = previewData;

    setLoading(true);
    try {
      const workoutData = {
        ...data,
        assignedTo: isUnconnectedAthlete ? user.username : (data.assignedTo || user.username),
      };

      // Store athlete name on workout for coach view
      if (isCoach && workoutData.assignedTo && workoutData.assignedTo !== user.username) {
        const athlete = students.find((s) => s.uid === workoutData.assignedTo);
        if (athlete?.displayName) {
          (workoutData as any).assignedToName = athlete.displayName;
        }
      }

      const newWorkoutId = await createWorkout(workoutData as any, user.username);
      setShowPreview(false);

      toast.success('Workout created successfully!');

      if (isCoach && data.assignedTo) {
        const athlete = students.find((s) => s.uid === data.assignedTo);
        if (athlete?.email) {
          setCreatedWorkoutData(data);
          setCreatedWorkoutId(newWorkoutId);
          setShowEmailDialog(true);
          return;
        }
      }

      setTimeout(() => router.push('/workouts'), 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workout');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!createdWorkoutData) return;
    const athlete = students.find((s) => s.uid === createdWorkoutData.assignedTo);
    if (!athlete?.email) return;

    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-workout-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: athlete.email,
          studentName: athlete.displayName,
          workout: createdWorkoutData,
          workoutId: createdWorkoutId,
          ownerUsername: athlete.uid,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to send email');
      }
      toast.success(`Email sent to ${athlete.displayName}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email notification');
    } finally {
      setSendingEmail(false);
      setShowEmailDialog(false);
      router.push('/workouts');
    }
  };

  const handleSkipEmail = () => {
    setShowEmailDialog(false);
    router.push('/workouts');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (!isCoach && !isUnconnectedAthlete)) {
    return null;
  }

  const getHeaderTitle = () => {
    if (aiGenerated) {
      return (
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-red-600" />
          AI-Generated Workout Template
        </div>
      );
    }
    if (templateData) {
      return (
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-5 w-5 text-orange-500" />
          Creating from Template: {templateData.name}
        </div>
      );
    }
    return 'Workout Details';
  };

  const getHeaderDescription = () => {
    if (aiGenerated) {
      return isCoach
        ? 'AI-generated workout ready to customize. Modify as needed and assign to an athlete.'
        : 'AI-generated workout ready to customize.';
    }
    if (templateData) {
      return isCoach
        ? 'Pre-filled from template. Modify as needed and assign to an athlete.'
        : 'Pre-filled from template. Modify as needed.';
    }
    return isCoach ? 'Fill in the details for the new workout' : 'Create a workout to track your training';
  };

  const formDefaultValues = useMemo(() => {
    if (templateData) {
      // Safely parse date — AI sends "YYYY-MM-DD", templates may send ISO strings
      let parsedDate = new Date();
      try {
        if (templateData.date) {
          const d = new Date(templateData.date);
          if (!isNaN(d.getTime())) parsedDate = d;
        }
      } catch { /* use default */ }

      return {
        name: templateData.name || '',
        type: templateData.type,
        date: parsedDate,
        description: templateData.description
          || [templateData.warmup, templateData.mainSet, templateData.cooldown].filter(Boolean).join('\n\n')
          || '',
        tags: Array.isArray(templateData.tags) ? templateData.tags : undefined,
        assignedTo: isUnconnectedAthlete ? user?.username : students[0]?.uid || '',
        ...(templateData.run && { run: templateData.run }),
        ...(templateData.swim && { swim: templateData.swim }),
        ...(templateData.bike && { bike: templateData.bike }),
        ...(templateData.strength && { strength: templateData.strength }),
        ...(templateData.other && { other: templateData.other }),
      };
    }
    // No template — check for URL params (from calendar dropdown)
    const defaults: Record<string, any> = {};
    if (isUnconnectedAthlete) defaults.assignedTo = user?.username;

    // Pre-fill date from ?date=YYYY-MM-DD
    if (dateParam) {
      try {
        const d = new Date(dateParam + 'T12:00:00'); // noon to avoid timezone shift
        if (!isNaN(d.getTime())) defaults.date = d;
      } catch { /* ignore bad dates */ }
    }

    // Pre-fill tag from ?tag=race (etc.)
    if (tagParam) {
      defaults.tags = [tagParam];
    }

    // "Add Note" from calendar — pre-fill as other type with note name
    if (isNote) {
      defaults.type = 'other';
      defaults.name = 'Note';
    }

    return Object.keys(defaults).length > 0 ? defaults : undefined;
  }, [templateData, isUnconnectedAthlete, user?.username, students, dateParam, tagParam, isNote]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/workouts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Create New Workout</h1>
          <p className="text-muted-foreground">
            {isCoach ? 'Design and assign workouts to your athletes' : 'Track your own training'}
          </p>
        </div>
      </div>

      <Card className={aiGenerated ? 'border-red-200 dark:border-red-900' : ''}>
        <CardHeader>
          <CardTitle>{getHeaderTitle()}</CardTitle>
          <CardDescription>{getHeaderDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutForm
            key={templateData ? `template-${templateData.type}-${templateData.name}` : 'blank'}
            onSubmit={handleSubmit}
            athletes={students}
            loading={loading || loadingTemplate}
            hideAthleteSelector={isUnconnectedAthlete}
            defaultValues={formDefaultValues}
          />
        </CardContent>
      </Card>

      <WorkoutPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmCreate}
        data={previewData}
        athleteName={
          isCoach && previewData?.assignedTo
            ? students.find(s => s.uid === previewData.assignedTo)?.displayName
            : undefined
        }
        loading={loading}
      />

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email notification?</DialogTitle>
            <DialogDescription>
              Would you like to notify{' '}
              {students.find((s) => s.uid === createdWorkoutData?.assignedTo)?.displayName ?? 'the athlete'}{' '}
              about this new workout via email?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSkipEmail} disabled={sendingEmail}>
              Skip
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Mail className="h-4 w-4 mr-2" />Send Email</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

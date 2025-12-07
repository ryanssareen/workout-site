'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { WhiteboardUpload } from '@/components/workouts/WhiteboardUpload';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * New workout creation page
 * 
 * Dual input modes:
 * 1. Manual entry: Traditional form-based workout creation
 * 2. Vision upload: AI-powered extraction from whiteboard photos
 * 
 * Workflow:
 * - Tab interface switches between input modes
 * - Manual tab: Direct form submission
 * - Vision tab: Upload → extract → populate form → submit
 * 
 * Coach verification:
 * - Only coaches can access this page
 * - Redirects students to dashboard
 * 
 * Student data:
 * - Fetches coach's students for assignment dropdown
 * - Empty state if no students registered
 */
export default function NewWorkoutPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [students, setStudents] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [extractedWorkouts, setExtractedWorkouts] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user?.role !== 'coach') {
      toast.error('Only coaches can create workouts');
      router.push('/dashboard');
      return;
    }

    async function loadStudents() {
      if (!user) return;
      const studentsList = await getCoachStudents(user.uid);
      setStudents(studentsList);
    }

    if (user?.role === 'coach') {
      loadStudents();
    }
  }, [user, loading, router]);

  const handleSubmit = async (data: WorkoutSchema) => {
    if (!user) return;

    setSubmitting(true);
    try {
      await createWorkout(data, user.uid);
      toast.success('Workout created successfully');
      router.push('/workouts');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkoutsExtracted = (workouts: any[]) => {
    setExtractedWorkouts(workouts);
    toast.success(`Extracted ${workouts.length} workout(s). Review and submit each below.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'coach') return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Workout</h1>
        <p className="text-muted-foreground mt-1">
          Add a workout manually or upload a whiteboard photo for AI extraction
        </p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="vision">Whiteboard Vision</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <WorkoutForm
            onSubmit={handleSubmit}
            students={students}
            loading={submitting}
          />
        </TabsContent>

        <TabsContent value="vision" className="mt-6 space-y-6">
          <WhiteboardUpload onWorkoutsExtracted={handleWorkoutsExtracted} />

          {extractedWorkouts.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Extracted Workouts</h3>
              {extractedWorkouts.map((workout, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Workout {index + 1}: {workout.name}</h4>
                  <WorkoutForm
                    onSubmit={handleSubmit}
                    defaultValues={{
                      name: workout.name,
                      type: workout.type,
                      description: workout.description,
                      date: workout.date ? new Date(workout.date) : undefined,
                      duration: workout.duration,
                      assignedTo: students[0]?.uid || '',
                    }}
                    students={students}
                    loading={submitting}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

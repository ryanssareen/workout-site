'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkoutsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  const loadWorkouts = async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.uid, user.role);
    setWorkouts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkouts();
  }, [user]);

  const handleEdit = (id: string) => {
    router.push(`/workouts/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;

    try {
      await deleteWorkout(id);
      toast.success('Workout deleted successfully');
      await loadWorkouts(); // Refresh list
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workout');
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean, notes?: string) => {
    try {
      await completeWorkout(id, completed, notes);
      toast.success(completed ? 'Workout marked as complete!' : 'Workout marked as incomplete');
      await loadWorkouts(); // Refresh list
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    }
  };

  const handleViewDetails = (id: string) => {
    router.push(`/workouts/${id}`);
  };

  const loadAIRecommendations = async () => {
    if (!user) return;
    setLoadingAI(true);
    try {
      const response = await fetch('/api/ai/general-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutCount: workouts.length,
          role: user.role,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data.tips || []);
      }
    } catch (error) {
      console.error('AI tips error:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading workouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {user?.role === 'coach' ? 'My Workouts' : 'Assigned Workouts'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'coach' 
              ? 'Manage all workouts you\'ve created' 
              : 'View and track your assigned training sessions'}
          </p>
        </div>
        {user?.role === 'coach' && (
          <Button asChild>
            <Link href="/workouts/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Workout
            </Link>
          </Button>
        )}
      </div>

      {/* AI Recommendations Card */}
      {user?.role === 'student' && workouts.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Training Tips</CardTitle>
              </div>
              {aiRecommendations.length === 0 && (
                <Button
                  onClick={loadAIRecommendations}
                  disabled={loadingAI}
                  size="sm"
                  variant="outline"
                >
                  {loadingAI ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Get Tips
                    </>
                  )}
                </Button>
              )}
            </div>
            <CardDescription>
              Personalized tips based on your training
            </CardDescription>
          </CardHeader>
          {aiRecommendations.length > 0 && (
            <CardContent className="space-y-3">
              {aiRecommendations.map((tip, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                >
                  <Lightbulb className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <WorkoutList
        workouts={workouts}
        onEdit={user?.role === 'coach' ? handleEdit : undefined}
        onDelete={user?.role === 'coach' ? handleDelete : undefined}
        onToggleComplete={handleToggleComplete}
        onViewDetails={handleViewDetails}
        isCoach={user?.role === 'coach'}
      />
    </div>
  );
}

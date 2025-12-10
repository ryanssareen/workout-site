'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewWorkoutPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStudents() {
      if (!user || user.role !== 'coach') return;
      
      const data = await getCoachStudents(user.uid);
      setStudents(data);
    }

    loadStudents();
  }, [user]);

  // Redirect if not a coach
  useEffect(() => {
    if (user && user.role !== 'coach') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (data: WorkoutSchema) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const workoutId = await createWorkout(data, user.uid);
      
      // Find the student's email
      const student = students.find(s => s.uid === data.assignedTo);
      
      if (student && student.email) {
        // Show success with email option
        toast.success('Workout created! Send email notification?', {
          duration: 10000,
          action: {
            label: '📧 Send Email',
            onClick: async () => {
              try {
                const response = await fetch('/api/send-workout-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    studentEmail: student.email,
                    studentName: student.displayName,
                    workout: {
                      name: data.name,
                      type: data.type,
                      description: data.description,
                      date: { seconds: Math.floor(data.date.getTime() / 1000) },
                      duration: data.duration,
                    }
                  })
                });
                
                if (response.ok) {
                  toast.success('📧 Email sent to ' + student.displayName + '!');
                } else {
                  toast.error('Failed to send email');
                }
              } catch (error) {
                toast.error('Failed to send email');
              }
            }
          }
        });
      } else {
        toast.success('Workout created successfully!');
      }
      
      // Wait a bit then redirect
      setTimeout(() => router.push('/workouts'), 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workout');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'coach') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/workouts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Workout</h1>
          <p className="text-muted-foreground">Design and assign workouts to your students</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workout Details</CardTitle>
          <CardDescription>Fill in the details for the new workout</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutForm
            onSubmit={handleSubmit}
            students={students}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

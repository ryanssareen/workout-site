'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { ArrowLeft, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewWorkoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateData, setTemplateData] = useState<any>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const templateId = searchParams.get('templateId');

  useEffect(() => {
    async function loadStudents() {
      if (!user || user.role !== 'coach') return;
      
      const data = await getCoachStudents(user.uid);
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
      
      toast.success('Workout created successfully!');
      
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
          <CardTitle>
            {templateData ? (
              <div className="flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-orange-500" />
                Creating from Template: {templateData.name}
              </div>
            ) : (
              'Workout Details'
            )}
          </CardTitle>
          <CardDescription>
            {templateData 
              ? 'Pre-filled from template. Modify as needed and assign to a student.'
              : 'Fill in the details for the new workout'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutForm
            onSubmit={handleSubmit}
            students={students}
            loading={loading || loadingTemplate}
            defaultValues={templateData ? {
              name: templateData.name,
              type: templateData.type,
              description: templateData.description || '',
              date: new Date(),
              duration: templateData.duration || undefined,
              assignedTo: students[0]?.uid || '', // Default to first student
            } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

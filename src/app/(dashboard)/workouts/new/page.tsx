'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { ArrowLeft, BookmarkCheck, Sparkles } from 'lucide-react';
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
  const aiGenerated = searchParams.get('aiGenerated') === 'true';

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

  // Load AI-generated workout data from sessionStorage
  useEffect(() => {
    if (aiGenerated) {
      try {
        const storedData = sessionStorage.getItem('aiWorkoutData');
        if (storedData) {
          const aiWorkout = JSON.parse(storedData);
          
          // Map AI-generated structured data to form's expected format
          // The AI returns: { name, type, [type]: { ...fields } }
          // We need to preserve this structure for defaultValues
          setTemplateData(aiWorkout);
          
          // Clear from sessionStorage after loading
          sessionStorage.removeItem('aiWorkoutData');
          
          toast.success('AI-generated workout loaded! Modify and assign as needed.');
        }
      } catch (error) {
        console.error('Failed to load AI workout data:', error);
        toast.error('Failed to load AI workout data');
      }
    }
  }, [aiGenerated]);

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

  const getHeaderTitle = () => {
    if (aiGenerated) {
      return (
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
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
      return 'AI-generated workout ready to customize. Modify as needed and assign to a student.';
    }
    if (templateData) {
      return 'Pre-filled from template. Modify as needed and assign to a student.';
    }
    return 'Fill in the details for the new workout';
  };

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

      <Card className={aiGenerated ? 'border-purple-200 dark:border-purple-900' : ''}>
        <CardHeader>
          <CardTitle>{getHeaderTitle()}</CardTitle>
          <CardDescription>{getHeaderDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutForm
            onSubmit={handleSubmit}
            students={students}
            loading={loading || loadingTemplate}
            defaultValues={templateData ? {
              name: templateData.name,
              type: templateData.type,
              date: new Date(),
              assignedTo: students[0]?.uid || '',
              // Pass the type-specific nested data
              // AI generates: { name, type: "run", run: { distance, time, ... } }
              // WorkoutForm expects exactly this structure
              ...(templateData.run && { run: templateData.run }),
              ...(templateData.swim && { swim: templateData.swim }),
              ...(templateData.bike && { bike: templateData.bike }),
              ...(templateData.strength && { strength: templateData.strength }),
              ...(templateData.other && { other: templateData.other }),
            } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

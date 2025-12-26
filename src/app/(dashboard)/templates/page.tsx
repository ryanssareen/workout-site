'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Copy, Trash2, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WorkoutTemplate {
  id: string;
  name: string;
  type: 'swim' | 'bike' | 'run' | 'strength';
  description: string;
  duration: number | null;
  createdBy: string;
  createdAt: any;
}

const typeColors = {
  swim: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  bike: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  run: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  strength: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function TemplatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/templates?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setDeleting(templateId);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== templateId));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    } finally {
      setDeleting(null);
    }
  };

  const handleUseTemplate = (templateId: string) => {
    router.push(`/workouts/new?templateId=${templateId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Workout Templates</h1>
          <p className="text-muted-foreground mt-2">
            Save and reuse your favorite workouts
          </p>
        </div>
        <Link href="/workouts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workout
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a workout and save it as a template to get started
            </p>
            <Link href="/workouts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Workout
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[template.type]}`}>
                        {template.type}
                      </span>
                      {template.duration && (
                        <span className="text-xs text-muted-foreground">
                          {template.duration} min
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                </div>
                {template.description && (
                  <CardDescription className="line-clamp-2 mt-2">
                    {template.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUseTemplate(template.id)}
                    className="flex-1"
                    variant="default"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                  <Button
                    onClick={() => handleDelete(template.id)}
                    variant="destructive"
                    size="icon"
                    disabled={deleting === template.id}
                  >
                    {deleting === template.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

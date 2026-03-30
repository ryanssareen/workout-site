'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { Workout } from '@/types';
import { format } from 'date-fns';
import { safeToDate } from '@/lib/dateUtils';

interface WorkoutRecommendationsProps {
  workout: Workout;
}

export function WorkoutRecommendations({ workout }: WorkoutRecommendationsProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/workout-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout: {
            name: workout.name,
            type: workout.type,
            duration: workout.duration,
            description: workout.description,
            date: format(safeToDate(workout), 'MMM d, yyyy'),
            completed: workout.completed,
            completedLate: workout.completedLate,
            completionNotes: workout.completionNotes,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get recommendations');
      }

      const result = await response.json();
      setRecommendations(result.recommendations || []);
      setSummary(result.summary || null);
    } catch (error: any) {
      console.error('Recommendations error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Recommendations</CardTitle>
          </div>
          {!recommendations && (
            <Button
              onClick={loadRecommendations}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get AI Tips
                </>
              )}
            </Button>
          )}
        </div>
        <CardDescription>
          Get personalized tips and insights for this workout
        </CardDescription>
      </CardHeader>

      {recommendations && (
        <CardContent className="space-y-4">
          {summary && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">{summary}</p>
            </div>
          )}

          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-muted rounded-lg"
              >
                <Lightbulb className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </div>

          <Button
            onClick={loadRecommendations}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Refresh Recommendations'
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

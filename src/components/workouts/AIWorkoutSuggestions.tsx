'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WorkoutSuggestion {
  name: string;
  type: string;
  description: string;
  duration?: number;
  notes?: string;
}

interface AIWorkoutSuggestionsProps {
  userId: string;
  recentWorkouts?: any[];
}

export function AIWorkoutSuggestions({ userId, recentWorkouts = [] }: AIWorkoutSuggestionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WorkoutSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/workout-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recentWorkouts: recentWorkouts.slice(0, 5).map(w => ({
            type: w.type,
            name: w.name,
            date: w.date?.toDate?.()?.toLocaleDateString() || 'Recent',
          })),
          preferences: {
            sports: 'Various',
            level: 'Intermediate',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      console.error('Suggestions error:', err);
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSuggestion = (suggestion: WorkoutSuggestion) => {
    // Encode the suggestion data and navigate to workout creation page with prefilled data
    const params = new URLSearchParams({
      name: suggestion.name,
      type: suggestion.type,
      description: suggestion.description,
      duration: suggestion.duration?.toString() || '60',
      notes: suggestion.notes || '',
      aiGenerated: 'true',
    });
    router.push(`/workouts/new?${params.toString()}`);
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'swim': return 'default';
      case 'run': return 'secondary';
      case 'bike': return 'outline';
      case 'strength': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">AI Workout Suggestions</CardTitle>
          </div>
          {suggestions.length === 0 && (
            <Button
              onClick={loadSuggestions}
              disabled={loading}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Suggestions
                </>
              )}
            </Button>
          )}
        </div>
        <CardDescription>
          AI-powered workout ideas tailored to your training
        </CardDescription>
      </CardHeader>

      {error && (
        <CardContent>
          <div className="text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        </CardContent>
      )}

      {suggestions.length > 0 && (
        <CardContent className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <Card
              key={index}
              className="border-purple-200 hover:border-purple-400 dark:border-purple-800 dark:hover:border-purple-600 transition-all cursor-pointer hover:shadow-md"
              onClick={() => handleViewSuggestion(suggestion)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-base">{suggestion.name}</h4>
                      <Badge
                        variant={getTypeBadgeVariant(suggestion.type)}
                        className="capitalize"
                      >
                        {suggestion.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                    {suggestion.duration && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {suggestion.duration} min
                      </div>
                    )}
                    {suggestion.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {suggestion.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewSuggestion(suggestion);
                    }}
                  >
                    Use Template
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            onClick={loadSuggestions}
            disabled={loading}
            variant="outline"
            size="sm"
            className="w-full mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              'Get New Suggestions'
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

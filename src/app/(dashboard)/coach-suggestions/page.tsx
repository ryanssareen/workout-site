'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  TrendingUp,
  Users,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

interface Suggestion {
  type: 'warning' | 'success' | 'info';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  students?: string[];
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
  stats: {
    totalStudents: number;
    totalWorkouts: number;
    overallCompletionRate: number;
  };
}

export default function CoachSuggestionsPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadSuggestions = async () => {
    if (!user || user.role !== 'coach') {
      toast.error('Only coaches can access AI suggestions');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          coachId: user.uid,
          userEmail: user.email,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('API Error Response:', result);
        throw new Error(result.error || result.details || 'Failed to load suggestions');
      }
      
      setData(result);
      setLastUpdated(new Date());
      toast.success('AI analysis complete!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load suggestions');
      console.error('Suggestions error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'coach') {
      loadSuggestions();
    }
  }, [user]);

  if (user?.role !== 'coach') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">Coach Only</h3>
            <p className="text-muted-foreground">
              This feature is only available for coaches.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Coach Suggestions
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights and recommendations for your coaching
          </p>
        </div>

        <Button
          onClick={loadSuggestions}
          disabled={loading}
          size="lg"
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh Analysis
            </>
          )}
        </Button>
      </div>

      {/* Stats Overview */}
      {data?.stats && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-3xl font-bold">{data.stats.totalStudents}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Workouts Assigned (30d)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                <span className="text-3xl font-bold">{data.stats.totalWorkouts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completion Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{data.stats.overallCompletionRate}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI is analyzing your data...</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Reviewing student performance, identifying patterns, and generating personalized recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {data?.suggestions && data.suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              AI Recommendations ({data.suggestions.length})
            </h2>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="grid gap-4">
            {data.suggestions
              .sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
              })
              .map((suggestion, index) => (
                <Card
                  key={index}
                  className={`border-2 ${getColor(suggestion.type)}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getColor(suggestion.type)}`}>
                          {getIcon(suggestion.type)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={getPriorityColor(suggestion.priority)}
                            >
                              {suggestion.priority.toUpperCase()} PRIORITY
                            </Badge>
                            {suggestion.students && suggestion.students.length > 0 && (
                              <Badge variant="secondary">
                                {suggestion.students.length} student{suggestion.students.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      {suggestion.description}
                    </p>
                    {suggestion.students && suggestion.students.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-2">Affected Students:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.students.map((student, idx) => (
                            <Badge key={idx} variant="outline">
                              {student}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {data && (!data.suggestions || data.suggestions.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Everything looks great!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No immediate suggestions. Your students are making good progress. Check back later for new insights.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            How AI Suggestions Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Analyzes all your students' workout data from the last 30 days</p>
          <p>• Identifies patterns in completion rates, missed workouts, and late completions</p>
          <p>• Provides specific, actionable recommendations to improve coaching effectiveness</p>
          <p>• Updates in real-time when you click "Refresh Analysis"</p>
          <p>• Powered by Groq AI (LLaMA 3.3 70B) for intelligent insights</p>
        </CardContent>
      </Card>
    </div>
  );
}

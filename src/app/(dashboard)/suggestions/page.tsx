'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Loader2, RefreshCw, TrendingUp, Users, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface SuggestionsData {
  suggestions: string;
  dataSnapshot: {
    students: number;
    totalWorkouts: number;
    completionRate: number;
    recentActivity: number;
  };
}

export default function SuggestionsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Redirect if not coach
  useEffect(() => {
    if (!loading && user?.role !== 'coach') {
      toast.error('This page is only available for coaches');
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const generateSuggestions = async () => {
    if (!user) return;

    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          role: user.role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate suggestions');
      }

      const data = await response.json();
      setSuggestions(data);
      setLastUpdated(new Date());
      toast.success('AI suggestions generated!');
    } catch (error: any) {
      console.error('Suggestions error:', error);
      toast.error(error.message || 'Failed to generate suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    if (user?.role === 'coach' && !suggestions) {
      generateSuggestions();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== 'coach') {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            AI Business Suggestions
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalized coaching insights powered by AI
          </p>
        </div>
        <Button
          onClick={generateSuggestions}
          disabled={loadingSuggestions}
          className="gap-2"
        >
          {loadingSuggestions ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh Suggestions
            </>
          )}
        </Button>
      </div>

      {/* Stats Overview */}
      {suggestions?.dataSnapshot && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suggestions.dataSnapshot.students}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Workouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suggestions.dataSnapshot.totalWorkouts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Completion Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {suggestions.dataSnapshot.completionRate}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Last 30 Days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suggestions.dataSnapshot.recentActivity}</div>
              <p className="text-xs text-muted-foreground">workouts assigned</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loadingSuggestions && !suggestions && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1">Analyzing Your Coaching Data</h3>
                <p className="text-sm text-muted-foreground">
                  AI is reviewing your athletes, workouts, and performance metrics...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Suggestions */}
      {suggestions && !loadingSuggestions && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-purple-500/10">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Personalized Suggestions
              </CardTitle>
              {lastUpdated && (
                <Badge variant="outline" className="text-xs">
                  Updated {lastUpdated.toLocaleTimeString()}
                </Badge>
              )}
            </div>
            <CardDescription>
              AI-generated insights based on your coaching data
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h2 className="text-2xl font-bold mt-6 mb-3 flex items-center gap-2">
                      {children}
                    </h2>
                  ),
                  h2: ({ children }) => (
                    <h3 className="text-xl font-semibold mt-5 mb-2 flex items-center gap-2">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 my-4">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                }}
              >
                {suggestions.suggestions}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 About AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Suggestions are generated by analyzing your athletes' workout completion rates,
            programming patterns, and engagement metrics
          </p>
          <p>
            • Click "Refresh Suggestions" to get updated insights based on the latest data
          </p>
          <p>
            • These are recommendations to help improve your coaching business - use your
            professional judgment when implementing them
          </p>
          <p>
            • The AI sees anonymized data about workout types, completion rates, and athlete
            engagement patterns
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

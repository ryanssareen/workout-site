'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  Clock,
  ChevronRight,
  Target,
  TrendingUp,
  Zap,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WorkoutSuggestion {
  name: string;
  type: 'run' | 'swim' | 'bike' | 'strength' | 'other';
  difficulty?: string;
  estimatedDuration?: number;
  description?: string;
  rationale?: string;
  benefits?: string[];
  warmup?: string;
  mainSet?: string;
  cooldown?: string;
  targetPace?: string;
  intensityZones?: string;
  keyFocus?: string[];
  run?: any;
  swim?: any;
  bike?: any;
  strength?: any;
  other?: any;
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
    // Store the full structured workout in sessionStorage
    sessionStorage.setItem('aiWorkoutData', JSON.stringify(suggestion));
    
    // Navigate to workout creation page
    router.push('/workouts/new?aiGenerated=true');
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

  const getSummary = (suggestion: WorkoutSuggestion) => {
    const type = suggestion.type;
    const data = suggestion[type];
    
    if (!data) return '';
    
    switch (type) {
      case 'run':
        return `${data.distance} ${data.distanceUnit} • ${data.time} min • ${data.terrain}`;
      case 'swim':
        return `${data.distance} ${data.distanceUnit} • ${data.laps} laps • ${data.stroke}`;
      case 'bike':
        return `${data.distance} ${data.distanceUnit} • ${data.time} min`;
      case 'strength':
        return `${data.sets} sets × ${data.reps} reps • ${data.exercises?.length || 0} exercises`;
      case 'other':
        return `${data.duration} min`;
      default:
        return '';
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
          {suggestions.map((suggestion, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <Card
                key={index}
                className="border-purple-200 hover:border-purple-400 dark:border-purple-800 dark:hover:border-purple-600 transition-all hover:shadow-md"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header Section */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-base">{suggestion.name}</h4>
                        <Badge
                          variant={getTypeBadgeVariant(suggestion.type)}
                          className="capitalize"
                        >
                          {suggestion.type}
                        </Badge>
                        {suggestion.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {suggestion.difficulty}
                          </Badge>
                        )}
                        {suggestion.estimatedDuration && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {suggestion.estimatedDuration} min
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description || getSummary(suggestion)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      >
                        {isExpanded ? (
                          <>
                            Less
                            <ChevronUp className="h-4 w-4 ml-1" />
                          </>
                        ) : (
                          <>
                            Details
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  {isExpanded && (
                    <div className="space-y-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                      {/* Rationale */}
                      {suggestion.rationale && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
                            <Target className="h-4 w-4" />
                            Why This Workout?
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">
                            {suggestion.rationale}
                          </p>
                        </div>
                      )}

                      {/* Benefits */}
                      {suggestion.benefits && suggestion.benefits.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                            <TrendingUp className="h-4 w-4" />
                            Expected Benefits
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                            {suggestion.benefits.map((benefit, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Workout Structure */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                          <Zap className="h-4 w-4" />
                          Workout Structure
                        </div>
                        <div className="space-y-2 pl-6 text-sm">
                          {suggestion.warmup && (
                            <div>
                              <span className="font-medium">Warmup:</span>
                              <p className="text-muted-foreground">{suggestion.warmup}</p>
                            </div>
                          )}
                          {suggestion.mainSet && (
                            <div>
                              <span className="font-medium">Main Set:</span>
                              <p className="text-muted-foreground">{suggestion.mainSet}</p>
                            </div>
                          )}
                          {suggestion.cooldown && (
                            <div>
                              <span className="font-medium">Cooldown:</span>
                              <p className="text-muted-foreground">{suggestion.cooldown}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Target Zones */}
                      {(suggestion.targetPace || suggestion.intensityZones) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Info className="h-4 w-4" />
                            Target Zones
                          </div>
                          <div className="text-sm text-muted-foreground pl-6 space-y-1">
                            {suggestion.targetPace && (
                              <p><span className="font-medium">Pace:</span> {suggestion.targetPace}</p>
                            )}
                            {suggestion.intensityZones && (
                              <p><span className="font-medium">Intensity:</span> {suggestion.intensityZones}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Key Focus Points */}
                      {suggestion.keyFocus && suggestion.keyFocus.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Target className="h-4 w-4" />
                            Key Focus Points
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                            {suggestion.keyFocus.map((focus, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-purple-600 dark:text-purple-400">•</span>
                                <span>{focus}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Use Template Button */}
                      <Button
                        onClick={() => handleViewSuggestion(suggestion)}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        Use This Workout Template
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}

                  {/* Quick Action Button (when collapsed) */}
                  {!isExpanded && (
                    <Button
                      onClick={() => handleViewSuggestion(suggestion)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Use Template
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

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

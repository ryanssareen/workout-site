'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Loader2, Clock, ChevronRight, Target, TrendingUp, Zap,
  Info, CheckCircle2, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';

interface WorkoutSuggestion {
  name: string;
  type: 'run' | 'swim' | 'bike' | 'strength' | 'other';
  date?: string;
  intensity?: string;
  durationMin?: number;
  estimatedDuration?: number;
  sessionType?: string;
  description?: string;
  rationale?: string;
  benefits?: string[];
  tags?: string[];
  warmup?: string;
  mainSet?: string;
  cooldown?: string;
  sessionLoad?: number;
  aiModified?: boolean;
  changesCount?: number;
  loadDeltaPercent?: number;
  run?: any;
  swim?: any;
  bike?: any;
  strength?: any;
  other?: any;
  specs?: Record<string, any>;
}

interface TrainingAnalysis {
  totalWorkouts: number;
  workoutsByType?: Record<string, number>;
  completedRate?: number;
  avgDuration?: number;
  daysSinceLast?: number;
  phase?: string;
  weeksOut?: number | null;
  deload?: boolean;
  fatigueState?: string;
}

interface AthleteProfile {
  sportPreferences?: string[];
  fitnessGoals?: string[];
  trainingFor?: string[];
  experienceLevel?: string;
  ageRange?: string;
  eventDate?: string;
  weeklyAvailability?: string;
  bio?: string;
  timezone?: string;
}

interface AIWorkoutSuggestionsProps {
  userId: string;
  recentWorkouts?: any[];
  athleteProfile?: AthleteProfile;
}

export function AIWorkoutSuggestions({ userId, recentWorkouts = [], athleteProfile }: AIWorkoutSuggestionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WorkoutSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<TrainingAnalysis | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const response = await fetch('/api/ai/workout-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recentWorkouts: Array.isArray(recentWorkouts)
            ? recentWorkouts.slice(0, 10).map((w) => {
                const workoutDate = w.date?.toDate?.() ?? w.date;
                const dateValue = workoutDate instanceof Date ? workoutDate.toISOString() : workoutDate;
                return {
                  type: w.type, name: w.name, date: dateValue || 'Recent',
                  duration: w.duration, description: w.description, tags: w.tags, completed: w.completed,
                  run: w.run, bike: w.bike, swim: w.swim,
                  strength: w.strength ? { totalTime: w.strength.totalTime, rpe: w.strength.rpe, exerciseCount: w.strength.exercises?.length || 0 } : undefined,
                  other: w.other,
                };
              })
            : [],
          preferences: {
            sports: athleteProfile?.sportPreferences?.join(', ') || 'Various',
            level: athleteProfile?.experienceLevel || 'Intermediate',
          },
          athleteProfile: athleteProfile || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to load suggestions');

      const data = await response.json();
      setAnalysis(data.analysis || null);
      setAiEnhanced(data.aiEnhanced ?? false);

      const rawSuggestions = data.suggestions;
      if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
        setError('No suggestions returned');
        return;
      }

      // Normalize: flatten specs into top-level type keys for form compatibility
      setSuggestions(rawSuggestions.map((s: any) => {
        const specs = s.specs || {};
        return {
          ...s,
          // Flatten specs.run → s.run etc for form + display
          ...(specs.run && !s.run ? { run: specs.run } : {}),
          ...(specs.swim && !s.swim ? { swim: specs.swim } : {}),
          ...(specs.bike && !s.bike ? { bike: specs.bike } : {}),
          ...(specs.strength && !s.strength ? { strength: specs.strength } : {}),
          ...(specs.other && !s.other ? { other: specs.other } : {}),
          benefits: Array.isArray(s.benefits) ? s.benefits : [],
          tags: Array.isArray(s.tags) ? s.tags : [],
        };
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleUseWorkout = (suggestion: WorkoutSuggestion) => {
    // Flatten for form compatibility
    const formData = {
      name: suggestion.name,
      type: suggestion.type,
      date: suggestion.date,
      description: suggestion.description
        || [suggestion.warmup, suggestion.mainSet, suggestion.cooldown].filter(Boolean).join('\n\n'),
      tags: suggestion.tags,
      difficulty: suggestion.intensity,
      estimatedDuration: suggestion.durationMin || suggestion.estimatedDuration,
      run: suggestion.run,
      swim: suggestion.swim,
      bike: suggestion.bike,
      strength: suggestion.strength,
      other: suggestion.other,
      // Pass full AI data for reference
      warmup: suggestion.warmup,
      mainSet: suggestion.mainSet,
      cooldown: suggestion.cooldown,
    };
    sessionStorage.setItem('aiWorkoutData', JSON.stringify(formData));
    router.push('/workouts/new?aiGenerated=true');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'run': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'swim': return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30';
      case 'bike': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'strength': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30';
    }
  };

  const getIntensityColor = (d?: string) => {
    switch (d) {
      case 'easy': return 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-400';
      case 'hard': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    }
  };

  const getSpecsSummary = (s: WorkoutSuggestion) => {
    if (s.run) return `${s.run.distance} ${s.run.distanceUnit} · ${s.run.time} min${s.run.terrain ? ` · ${s.run.terrain}` : ''}`;
    if (s.swim) return `${s.swim.distance} ${s.swim.distanceUnit} · ${s.swim.time} min${s.swim.strokeType ? ` · ${s.swim.strokeType}` : ''}`;
    if (s.bike) return `${s.bike.distance} ${s.bike.distanceUnit} · ${s.bike.time} min${s.bike.elevationGain ? ` · ${s.bike.elevationGain}m↑` : ''}`;
    if (s.strength) return `${s.strength.totalTime} min · RPE ${s.strength.rpe || '?'}/10`;
    if (s.other) return `${s.other.duration} min`;
    return `${s.durationMin || s.estimatedDuration || '?'} min`;
  };

  return (
    <Card className="border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50 to-neutral-50 dark:from-red-950/20 dark:to-neutral-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-600" />
            <CardTitle className="text-lg">AI Workout Suggestions</CardTitle>
          </div>
          {suggestions.length === 0 && (
            <Button onClick={loadSuggestions} disabled={loading} size="sm" className="bg-red-600 hover:bg-red-700">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Get Suggestions</>}
            </Button>
          )}
        </div>
        <CardDescription>Personalized workouts based on your history, level, and goals — logic engine + AI coaching</CardDescription>
      </CardHeader>

      {error && (
        <CardContent>
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </CardContent>
      )}

      {suggestions.length > 0 && (
        <CardContent className="space-y-3">
          {/* Validation Status */}
          <div className="flex items-center gap-2">
            {aiEnhanced ? (
              <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">✓ AI-Enhanced & Validated</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Logic-Only (AI skipped or failed validation)</Badge>
            )}
          </div>

          {/* Training Snapshot */}
          {analysis && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-white/70 dark:bg-red-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                <Info className="h-4 w-4" />Training Snapshot
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Workouts:</span> {analysis.totalWorkouts}</div>
                <div><span className="font-medium text-foreground">Completion:</span> {analysis.completedRate ?? 0}%</div>
                <div><span className="font-medium text-foreground">Avg Session:</span> {analysis.avgDuration ?? 0} min</div>
                <div><span className="font-medium text-foreground">Last:</span> {typeof analysis.daysSinceLast === 'number' ? `${analysis.daysSinceLast}d ago` : 'Unknown'}</div>
                {(analysis.phase && analysis.phase !== 'general') && (
                  <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-foreground">Phase:</span>
                    <Badge variant="outline" className="text-xs">{analysis.phase}{analysis.weeksOut ? ` (${analysis.weeksOut}w to event)` : ''}</Badge>
                    {analysis.deload && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Deload</Badge>}
                    {analysis.fatigueState === 'fatigued' && <Badge variant="outline" className="text-xs border-red-500 text-red-600">Fatigued</Badge>}
                    {analysis.fatigueState === 'loaded' && <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Loaded</Badge>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workout Cards */}
          {suggestions.map((s, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <Card key={index} className="border-red-200 hover:border-red-400 dark:border-red-800 dark:hover:border-red-600 transition-all hover:shadow-md">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-base">{s.name}</h4>
                        <Badge className={`capitalize border ${getTypeColor(s.type)}`}>{s.type}</Badge>
                        {s.intensity && <Badge className={`text-xs ${getIntensityColor(s.intensity)}`}>{s.intensity}</Badge>}
                        {s.aiModified && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">AI-adjusted</Badge>}
                      </div>
                      {/* Date + Specs line */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        {s.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(parseISO(s.date), 'EEE, MMM d')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {getSpecsSummary(s)}
                        </span>
                      </div>
                      {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setExpandedIndex(isExpanded ? null : index)}>
                      {isExpanded ? <>Less <ChevronUp className="h-4 w-4 ml-1" /></> : <>Details <ChevronDown className="h-4 w-4 ml-1" /></>}
                    </Button>
                  </div>

                  {/* Tags */}
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {s.tags.map((tag, i) => <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>)}
                    </div>
                  )}

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="space-y-4 pt-3 border-t">
                      {/* Rationale */}
                      {s.rationale && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400"><Target className="h-4 w-4" />Why This Workout?</div>
                          <p className="text-sm text-muted-foreground pl-6">{s.rationale}</p>
                        </div>
                      )}

                      {/* Benefits */}
                      {s.benefits && s.benefits.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400"><TrendingUp className="h-4 w-4" />Benefits</div>
                          <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                            {s.benefits.map((b, i) => <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />{b}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Structure */}
                      {(s.warmup || s.mainSet || s.cooldown) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400"><Zap className="h-4 w-4" />Workout Structure</div>
                          <div className="space-y-2 pl-6 text-sm">
                            {s.warmup && <div><span className="font-medium">Warmup:</span><p className="text-muted-foreground">{s.warmup}</p></div>}
                            {s.mainSet && <div><span className="font-medium">Main Set:</span><p className="text-muted-foreground">{s.mainSet}</p></div>}
                            {s.cooldown && <div><span className="font-medium">Cooldown:</span><p className="text-muted-foreground">{s.cooldown}</p></div>}
                          </div>
                        </div>
                      )}

                      {/* Use Button */}
                      <Button onClick={() => handleUseWorkout(s)} className="w-full bg-red-600 hover:bg-red-700">
                        Use This Workout <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}

                  {/* Quick Use (collapsed) */}
                  {!isExpanded && (
                    <Button onClick={() => handleUseWorkout(s)} variant="outline" size="sm" className="w-full">
                      Use Workout <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Button onClick={loadSuggestions} disabled={loading} variant="outline" size="sm" className="w-full mt-2">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regenerating...</> : 'Get New Suggestions'}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

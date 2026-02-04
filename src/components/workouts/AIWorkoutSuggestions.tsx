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

interface NutritionPlan {
  pre?: string;
  during?: string;
  post?: string;
}

interface WorkoutSegment {
  name?: string;
  duration?: number;
  intensity?: string;
  notes?: string;
}

interface TrainingAnalysis {
  totalWorkouts: number;
  workoutsByType?: Record<string, number>;
  dominantType?: string;
  averageFrequency?: number;
  hasConsistency?: boolean;
  needsVariety?: boolean;
  lastWorkoutDaysAgo?: number | null;
  longestGapDays?: number | null;
  totalDurationMinutes?: number;
  averageDurationMinutes?: number;
  completedRate?: number;
  distanceByType?: Record<string, Record<string, number>>;
  tagCounts?: Record<string, number>;
}

interface WorkoutSuggestion {
  name: string;
  type: 'run' | 'swim' | 'bike' | 'strength' | 'other';
  difficulty?: string;
  estimatedDuration?: number;
  objective?: string;
  sessionType?: string;
  description?: string;
  rationale?: string;
  benefits?: string[];
  energySystems?: string[];
  rpe?: number;
  warmup?: string;
  mainSet?: string;
  cooldown?: string;
  targetPace?: string;
  intensityZones?: string;
  zoneDistribution?: string;
  keyFocus?: string[];
  techniqueCues?: string[];
  commonMistakes?: string[];
  segments?: WorkoutSegment[];
  equipment?: string[];
  environment?: string;
  nutrition?: NutritionPlan;
  recoveryTips?: string[];
  timeCrunchedOption?: string;
  lowImpactAlternative?: string;
  progression?: string;
  safetyNotes?: string[];
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
  const [analysis, setAnalysis] = useState<TrainingAnalysis | null>(null);

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
            ? recentWorkouts.slice(0, 8).map((w) => {
                const workoutDate = w.date?.toDate?.() ?? w.date;
                const dateValue = workoutDate instanceof Date ? workoutDate.toISOString() : workoutDate;
                return {
                  type: w.type,
                  name: w.name,
                  date: dateValue || 'Recent',
                  duration: w.duration,
                  description: w.description,
                  tags: w.tags,
                  completed: w.completed,
                  run: w.run ? {
                    distance: w.run.distance,
                    distanceUnit: w.run.distanceUnit,
                    time: w.run.time,
                    pace: w.run.pace,
                    terrain: w.run.terrain,
                    elevationGain: w.run.elevationGain,
                  } : undefined,
                  bike: w.bike ? {
                    distance: w.bike.distance,
                    distanceUnit: w.bike.distanceUnit,
                    time: w.bike.time,
                    avgPower: w.bike.avgPower,
                    avgCadence: w.bike.avgCadence,
                    elevationGain: w.bike.elevationGain,
                  } : undefined,
                  swim: w.swim ? {
                    distance: w.swim.distance,
                    distanceUnit: w.swim.distanceUnit,
                    time: w.swim.time,
                    strokeType: w.swim.strokeType,
                    poolLength: w.swim.poolLength,
                  } : undefined,
                  strength: w.strength ? {
                    totalTime: w.strength.totalTime,
                    rpe: w.strength.rpe,
                    exerciseCount: w.strength.exercises?.length || 0,
                  } : undefined,
                  other: w.other ? {
                    duration: w.other.duration,
                    description: w.other.description,
                  } : undefined,
                };
              })
            : [],
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
      console.log('📊 Received AI response:', data);
      setAnalysis(data.analysis || null);

      // Normalize suggestions to ensure arrays are properly formatted
      const rawSuggestions = data.suggestions;

      // Ensure suggestions is an array
      if (!Array.isArray(rawSuggestions)) {
        console.error('❌ Suggestions is not an array:', typeof rawSuggestions, rawSuggestions);
        setError('Invalid response format from AI');
        setSuggestions([]);
        setAnalysis(null);
        return;
      }

      console.log(`✅ Processing ${rawSuggestions.length} suggestions`);

      const normalizedSuggestions = rawSuggestions.map((suggestion: any) => ({
        ...suggestion,
        benefits: Array.isArray(suggestion.benefits) ? suggestion.benefits : [],
        keyFocus: Array.isArray(suggestion.keyFocus) ? suggestion.keyFocus : [],
        energySystems: Array.isArray(suggestion.energySystems) ? suggestion.energySystems : [],
        techniqueCues: Array.isArray(suggestion.techniqueCues) ? suggestion.techniqueCues : [],
        commonMistakes: Array.isArray(suggestion.commonMistakes) ? suggestion.commonMistakes : [],
        segments: Array.isArray(suggestion.segments) ? suggestion.segments : [],
        equipment: Array.isArray(suggestion.equipment) ? suggestion.equipment : [],
        recoveryTips: Array.isArray(suggestion.recoveryTips) ? suggestion.recoveryTips : [],
        safetyNotes: Array.isArray(suggestion.safetyNotes) ? suggestion.safetyNotes : [],
        nutrition: {
          pre: suggestion.nutrition?.pre || '',
          during: suggestion.nutrition?.during || '',
          post: suggestion.nutrition?.post || '',
        },
      }));

      setSuggestions(normalizedSuggestions);
      console.log('✅ Suggestions set successfully');
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

  const formatDistanceSummary = (distanceByType?: Record<string, Record<string, number>>) => {
    if (!distanceByType || Object.keys(distanceByType).length === 0) return 'None';
    return Object.entries(distanceByType)
      .map(([type, units]) => {
        const unitSummary = Object.entries(units || {})
          .map(([unit, value]) => `${value.toFixed(1)} ${unit}`)
          .join(', ');
        return unitSummary ? `${type}: ${unitSummary}` : null;
      })
      .filter(Boolean)
      .join(' • ');
  };

  const formatTagSummary = (tagCounts?: Record<string, number>) => {
    if (!tagCounts || Object.keys(tagCounts).length === 0) return 'None';
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => `${tag} (${count})`)
      .join(', ');
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

      {Array.isArray(suggestions) && suggestions.length > 0 && (
        <CardContent className="space-y-3">
          {analysis && (
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-purple-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
                <Info className="h-4 w-4" />
                Training Snapshot
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Total:</span> {analysis.totalWorkouts}</div>
                <div><span className="font-medium text-foreground">Avg/Week:</span> {analysis.averageFrequency ? analysis.averageFrequency.toFixed(1) : '0.0'}</div>
                <div><span className="font-medium text-foreground">Completion:</span> {analysis.completedRate ?? 0}%</div>
                <div><span className="font-medium text-foreground">Total Time:</span> {analysis.totalDurationMinutes?.toFixed(0) ?? 0} min</div>
                <div><span className="font-medium text-foreground">Avg Session:</span> {analysis.averageDurationMinutes?.toFixed(0) ?? 0} min</div>
                <div>
                  <span className="font-medium text-foreground">Last Workout:</span>{' '}
                  {typeof analysis.lastWorkoutDaysAgo === 'number' ? `${analysis.lastWorkoutDaysAgo}d` : 'Unknown'}
                </div>
                <div>
                  <span className="font-medium text-foreground">Longest Gap:</span>{' '}
                  {typeof analysis.longestGapDays === 'number' ? `${analysis.longestGapDays}d` : 'Unknown'}
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="font-medium text-foreground">Distribution:</span>{' '}
                  {analysis.workoutsByType
                    ? Object.entries(analysis.workoutsByType).map(([type, count]) => `${type}: ${count}`).join(', ')
                    : 'None'}
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="font-medium text-foreground">Distance Totals:</span> {formatDistanceSummary(analysis.distanceByType)}
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="font-medium text-foreground">Top Tags:</span> {formatTagSummary(analysis.tagCounts)}
                </div>
              </div>
            </div>
          )}
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
                        {suggestion.description || suggestion.objective || getSummary(suggestion)}
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

                      {/* Session Snapshot */}
                      {(suggestion.objective || suggestion.sessionType || (suggestion.energySystems && suggestion.energySystems.length > 0) || typeof suggestion.rpe === 'number') && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                            <Info className="h-4 w-4" />
                            Session Snapshot
                          </div>
                          <div className="text-sm text-muted-foreground pl-6 space-y-1">
                            {suggestion.objective && (
                              <p><span className="font-medium">Objective:</span> {suggestion.objective}</p>
                            )}
                            {suggestion.sessionType && (
                              <p><span className="font-medium">Session Type:</span> {suggestion.sessionType}</p>
                            )}
                            {suggestion.energySystems && suggestion.energySystems.length > 0 && (
                              <p><span className="font-medium">Energy Systems:</span> {suggestion.energySystems.join(', ')}</p>
                            )}
                            {typeof suggestion.rpe === 'number' && (
                              <p><span className="font-medium">RPE:</span> {suggestion.rpe}/10</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Benefits */}
                      {suggestion.benefits && Array.isArray(suggestion.benefits) && suggestion.benefits.length > 0 && (
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

                      {/* Session Segments */}
                      {suggestion.segments && suggestion.segments.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                            <Zap className="h-4 w-4" />
                            Session Segments
                          </div>
                          <div className="space-y-2 pl-6 text-sm">
                            {suggestion.segments.map((segment, i) => (
                              <div key={i} className="rounded-md border border-purple-200/60 dark:border-purple-800/60 p-2 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{segment.name || `Segment ${i + 1}`}</span>
                                  {segment.duration !== undefined && (
                                    <span className="text-xs text-muted-foreground">{segment.duration} min</span>
                                  )}
                                </div>
                                {segment.intensity && (
                                  <p className="text-muted-foreground"><span className="font-medium">Intensity:</span> {segment.intensity}</p>
                                )}
                                {segment.notes && (
                                  <p className="text-muted-foreground">{segment.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Target Zones */}
                      {(suggestion.targetPace || suggestion.intensityZones || suggestion.zoneDistribution) && (
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
                            {suggestion.zoneDistribution && (
                              <p><span className="font-medium">Zone Split:</span> {suggestion.zoneDistribution}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Key Focus Points */}
                      {suggestion.keyFocus && Array.isArray(suggestion.keyFocus) && suggestion.keyFocus.length > 0 && (
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

                      {/* Technique & Mistakes */}
                      {((suggestion.techniqueCues && suggestion.techniqueCues.length > 0) || (suggestion.commonMistakes && suggestion.commonMistakes.length > 0)) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Target className="h-4 w-4" />
                            Technique & Mistakes
                          </div>
                          <div className="space-y-2 pl-6 text-sm text-muted-foreground">
                            {suggestion.techniqueCues && suggestion.techniqueCues.length > 0 && (
                              <div>
                                <div className="font-medium text-foreground">Technique Cues</div>
                                <ul className="space-y-1">
                                  {suggestion.techniqueCues.map((cue, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-purple-600 dark:text-purple-400">•</span>
                                      <span>{cue}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {suggestion.commonMistakes && suggestion.commonMistakes.length > 0 && (
                              <div>
                                <div className="font-medium text-foreground">Mistakes to Avoid</div>
                                <ul className="space-y-1">
                                  {suggestion.commonMistakes.map((mistake, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-red-500">•</span>
                                      <span>{mistake}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Equipment & Environment */}
                      {(suggestion.environment || (suggestion.equipment && suggestion.equipment.length > 0)) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Info className="h-4 w-4" />
                            Equipment & Setup
                          </div>
                          <div className="text-sm text-muted-foreground pl-6 space-y-1">
                            {suggestion.environment && (
                              <p><span className="font-medium">Environment:</span> {suggestion.environment}</p>
                            )}
                            {suggestion.equipment && suggestion.equipment.length > 0 && (
                              <div>
                                <div className="font-medium text-foreground">Equipment</div>
                                <ul className="space-y-1">
                                  {suggestion.equipment.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-purple-600 dark:text-purple-400">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fueling & Recovery */}
                      {(suggestion.nutrition?.pre || suggestion.nutrition?.during || suggestion.nutrition?.post || (suggestion.recoveryTips && suggestion.recoveryTips.length > 0)) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <TrendingUp className="h-4 w-4" />
                            Fueling & Recovery
                          </div>
                          <div className="text-sm text-muted-foreground pl-6 space-y-1">
                            {suggestion.nutrition?.pre && (
                              <p><span className="font-medium">Pre:</span> {suggestion.nutrition.pre}</p>
                            )}
                            {suggestion.nutrition?.during && (
                              <p><span className="font-medium">During:</span> {suggestion.nutrition.during}</p>
                            )}
                            {suggestion.nutrition?.post && (
                              <p><span className="font-medium">Post:</span> {suggestion.nutrition.post}</p>
                            )}
                            {suggestion.recoveryTips && suggestion.recoveryTips.length > 0 && (
                              <div>
                                <div className="font-medium text-foreground">Recovery Tips</div>
                                <ul className="space-y-1">
                                  {suggestion.recoveryTips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-green-600">•</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Alternatives & Progression */}
                      {(suggestion.timeCrunchedOption || suggestion.lowImpactAlternative || suggestion.progression) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <TrendingUp className="h-4 w-4" />
                            Alternatives & Progression
                          </div>
                          <div className="text-sm text-muted-foreground pl-6 space-y-1">
                            {suggestion.timeCrunchedOption && (
                              <p><span className="font-medium">Time-crunched:</span> {suggestion.timeCrunchedOption}</p>
                            )}
                            {suggestion.lowImpactAlternative && (
                              <p><span className="font-medium">Low-impact:</span> {suggestion.lowImpactAlternative}</p>
                            )}
                            {suggestion.progression && (
                              <p><span className="font-medium">Progression:</span> {suggestion.progression}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Safety Notes */}
                      {suggestion.safetyNotes && suggestion.safetyNotes.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Info className="h-4 w-4" />
                            Safety Notes
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                            {suggestion.safetyNotes.map((note, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-500">•</span>
                                <span>{note}</span>
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

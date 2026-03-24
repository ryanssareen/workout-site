'use client';

import { useMemo, useState } from 'react';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Clock, Flame, MapPin, TrendingUp, Trophy, Zap, Mountain,
  Heart, Timer, Calendar as CalIcon, Target, ChevronDown, ChevronRight,
  Dumbbell, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import {
  TimeRange, filterByTimeRange, computeSummary, computeTimeSeries,
  computeTypeDistribution, computeWeeklyRhythm, computeCalendarData,
  computeInsights, computePRTimeline,
} from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { format, startOfMonth, getDay, getDaysInMonth, subMonths, eachMonthOfInterval } from 'date-fns';

// ── Time filter pills (per-chart) ──
const TIME_RANGES: TimeRange[] = ['ALL', '1Y', '6M', '3M', '1M', 'MO', 'WK'];

function ChartTimeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex gap-0.5">
      {TIME_RANGES.map(r => (
        <button
          key={r}
          onClick={(e) => { e.stopPropagation(); onChange(r); }}
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors',
            value === r
              ? 'bg-green-500 text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Stat Card ──
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 text-center">
        <div className={cn('mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-2', color || 'bg-primary/10')}>
          {icon}
        </div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Mini Calendar Heatmap ──
function MonthGrid({ month, data }: { month: Date; data: Map<string, number> }) {
  const start = startOfMonth(month);
  const firstDayOfWeek = getDay(start);
  const daysInMonth = getDaysInMonth(month);
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="text-center">
      <p className="text-xs font-medium mb-1.5 text-muted-foreground">{format(month, 'MMM')}</p>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="w-3 h-3" />;
          const key = format(new Date(month.getFullYear(), month.getMonth(), day), 'yyyy-MM-dd');
          const count = data.get(key) || 0;
          return (
            <div
              key={key}
              className={cn(
                'w-3 h-3 rounded-[2px] transition-colors',
                count === 0 && 'bg-muted/40',
                count === 1 && 'bg-green-500/50',
                count === 2 && 'bg-green-500/75',
                count >= 3 && 'bg-green-500',
              )}
              title={`${format(new Date(month.getFullYear(), month.getMonth(), day), 'MMM d')}: ${count} workout${count !== 1 ? 's' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Chart tooltip ──
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Chart wrapper with its own time filter ──
function ChartPanel({ emoji, title, subtitle, defaultRange = '6M', children }: {
  emoji: string; title: string; subtitle: string; defaultRange?: TimeRange;
  children: (range: TimeRange) => React.ReactNode;
}) {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm font-medium">{emoji} {title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <ChartTimeFilter value={range} onChange={setRange} />
      </div>
      <div className="mt-3">{children(range)}</div>
    </div>
  );
}

// ── Main Dashboard ──
interface ReportsDashboardProps {
  workouts: Workout[];
  athleteName?: string;
}

export function ReportsDashboard({ workouts, athleteName }: ReportsDashboardProps) {
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const typeDistro = useMemo(() => computeTypeDistribution(workouts), [workouts]);
  const weeklyRhythm = useMemo(() => computeWeeklyRhythm(workouts), [workouts]);
  const insights = useMemo(() => computeInsights(workouts), [workouts]);

  const hasStrengthData = summary.totalVolumeKg > 0;
  const hasDistanceData = summary.totalDistanceKm > 0;
  const hasCalorieData = summary.totalCalories > 0;
  const hasPRData = workouts.some(w => w.prs && w.prs.length > 0);

  // Calendar data (always 12 months)
  const calendarData = useMemo(() => {
    const data = computeCalendarData(workouts, 12);
    const map = new Map<string, number>();
    for (const d of data) map.set(format(d.date, 'yyyy-MM-dd'), d.count);
    return map;
  }, [workouts]);

  const calendarMonths = useMemo(() => {
    const now = new Date();
    return eachMonthOfInterval({ start: subMonths(now, 11), end: now });
  }, []);

  if (workouts.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium text-foreground">No workout data yet</p>
        <p className="text-sm mt-1">Complete some workouts to see your analytics dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Trophy className="h-5 w-5 text-amber-500" />}
          label="Total Workouts"
          value={String(summary.totalWorkouts)}
          sub={`${summary.completedWorkouts} completed`}
          color="bg-amber-500/10"
        />
        {hasStrengthData ? (
          <StatCard
            icon={<Dumbbell className="h-5 w-5 text-violet-500" />}
            label="Total Volume"
            value={`${(summary.totalVolumeKg / 1000).toFixed(1)}t`}
            sub={`${summary.totalVolumeKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`}
            color="bg-violet-500/10"
          />
        ) : (
          <StatCard
            icon={<MapPin className="h-5 w-5 text-blue-500" />}
            label="Total Distance"
            value={`${summary.totalDistanceKm.toFixed(1)} km`}
            color="bg-blue-500/10"
          />
        )}
        <StatCard
          icon={<Timer className="h-5 w-5 text-green-500" />}
          label="Total Hours Trained"
          value={summary.totalHours.toFixed(1)}
          color="bg-green-500/10"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          label="Avg Workout Time"
          value={`${Math.round(summary.avgDurationMin)}m`}
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          label="Workout Streak"
          value={`${summary.currentStreak}`}
          sub={summary.currentStreak > 0 ? 'days' : 'Start today!'}
          color="bg-orange-500/10"
        />
      </div>

      {/* ── Training Analysis ── */}
      <CollapsibleSection
        icon={<BarChart2 className="h-5 w-5 text-primary" />}
        title="Training Analysis"
      >
        <div className="grid md:grid-cols-2 gap-6 mt-2">
          {/* Hours Trained */}
          <ChartPanel emoji="⏱️" title="Hours Trained" subtitle="Training duration over time">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="gradHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="hours" name="Hours" stroke="#10b981" strokeWidth={2} fill="url(#gradHours)" dot={{ r: 3, fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              );
            }}
          </ChartPanel>

          {/* Volume Progression (if strength data) */}
          {hasStrengthData && (
            <ChartPanel emoji="💪" title="Volume Progression" subtitle="Total weight lifted per period">
              {(range) => {
                const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="volumeKg" name="Volume (kg)" stroke="#a855f7" strokeWidth={2} fill="url(#gradVol)" dot={{ r: 3, fill: '#a855f7' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartPanel>
          )}

          {/* Distance (if distance data) */}
          {hasDistanceData && (
            <ChartPanel emoji="📏" title="Distance" subtitle="Total distance per period">
              {(range) => {
                const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="gradDist" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="distanceKm" name="Distance (km)" stroke="#3b82f6" strokeWidth={2} fill="url(#gradDist)" dot={{ r: 3, fill: '#3b82f6' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartPanel>
          )}

          {/* Workout Count */}
          <ChartPanel emoji="🏋️" title="Workouts" subtitle="Number of workouts per period">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={25} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="workoutCount" name="Workouts" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }}
          </ChartPanel>

          {/* Reps & Sets (if strength data) */}
          {hasStrengthData && (
            <ChartPanel emoji="📊" title="Reps & Sets" subtitle="Training volume breakdown">
              {(range) => {
                const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} width={35} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="totalReps" name="Reps" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                      <Bar dataKey="totalSets" name="Sets" fill="#06b6d4" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartPanel>
          )}

          {/* Calories */}
          {hasCalorieData && (
            <ChartPanel emoji="🔥" title="Calories Burned" subtitle="Energy expenditure over time">
              {(range) => {
                const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="calories" name="Calories" fill="#f97316" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartPanel>
          )}

          {/* PRs Over Time */}
          {hasPRData && (
            <ChartPanel emoji="🏆" title="PRs Over Time" subtitle="Personal records achieved">
              {(range) => {
                const data = computePRTimeline(workouts, range);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} width={25} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="PRs" fill="#eab308" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartPanel>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Exercise Insights ── */}
      <CollapsibleSection
        icon={<Zap className="h-5 w-5 text-amber-500" />}
        title="Exercise Insights"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {insights.mostActiveType && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Most Trained Type</p>
              </div>
              <p className="text-lg font-bold capitalize">{insights.mostActiveType.type}</p>
              <p className="text-xs text-muted-foreground">{insights.mostActiveType.count} sessions</p>
            </div>
          )}
          {insights.longestWorkout && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Longest Workout</p>
              </div>
              <p className="text-lg font-bold">
                {insights.longestWorkout.durationMin >= 60
                  ? `${Math.floor(insights.longestWorkout.durationMin / 60)}h ${insights.longestWorkout.durationMin % 60}m`
                  : `${insights.longestWorkout.durationMin}m`}
              </p>
              <p className="text-xs text-muted-foreground truncate">{insights.longestWorkout.name}</p>
            </div>
          )}
          {hasStrengthData && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="h-5 w-5 text-violet-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Volume</p>
              </div>
              <p className="text-lg font-bold">{Math.round(summary.totalVolumeKg / summary.totalWorkouts).toLocaleString()} kg</p>
              <p className="text-xs text-muted-foreground">per workout</p>
            </div>
          )}
          {hasDistanceData && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Distance</p>
              </div>
              <p className="text-lg font-bold">{insights.avgDistanceKm.toFixed(1)} km</p>
              <p className="text-xs text-muted-foreground">per workout</p>
            </div>
          )}
          {insights.totalElevationGain > 0 && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mountain className="h-5 w-5 text-green-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Elevation</p>
              </div>
              <p className="text-lg font-bold">{Math.round(insights.totalElevationGain)}m</p>
              <p className="text-xs text-muted-foreground">elevation gain</p>
            </div>
          )}
          {insights.avgHeartRate && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-red-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Heart Rate</p>
              </div>
              <p className="text-lg font-bold">{insights.avgHeartRate} bpm</p>
              <p className="text-xs text-muted-foreground">across workouts</p>
            </div>
          )}
          {!hasStrengthData && !hasDistanceData && (
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-violet-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Completion Rate</p>
              </div>
              <p className="text-lg font-bold">{Math.round(summary.completionRate)}%</p>
              <p className="text-xs text-muted-foreground">of assigned workouts</p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Calendar Views ── */}
      <CollapsibleSection
        icon={<CalIcon className="h-5 w-5 text-green-500" />}
        title="Calendar Views"
      >
        <div className="grid lg:grid-cols-2 gap-6 mt-2">
          {/* Calendar Heatmap */}
          <div>
            <div className="mb-3">
              <p className="text-sm font-medium">📅 Workout Calendar</p>
              <p className="text-xs text-muted-foreground">Workout consistency over the last 12 months</p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {calendarMonths.map(m => (
                <MonthGrid key={format(m, 'yyyy-MM')} month={m} data={calendarData} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-[2px] bg-muted/40" />
                <div className="w-3 h-3 rounded-[2px] bg-green-500/50" />
                <div className="w-3 h-3 rounded-[2px] bg-green-500/75" />
                <div className="w-3 h-3 rounded-[2px] bg-green-500" />
              </div>
              <span>More</span>
            </div>
          </div>

          {/* Weekly Rhythm Radar */}
          <div>
            <div className="mb-3">
              <p className="text-sm font-medium">🔥 Weekly Rhythm</p>
              <p className="text-xs text-muted-foreground">Training frequency by day</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={weeklyRhythm} outerRadius="70%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                <Radar
                  dataKey="count" name="Workouts"
                  stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Workout Type Distribution ── */}
      <CollapsibleSection
        icon={<Activity className="h-5 w-5 text-blue-500" />}
        title="Workout Type Distribution"
        defaultOpen={false}
      >
        <div className="grid md:grid-cols-2 gap-6 items-center mt-2">
          {/* Donut Chart */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeDistro}
                  cx="50%" cy="50%"
                  innerRadius={0} outerRadius={100}
                  dataKey="count" nameKey="type"
                  stroke="none"
                  paddingAngle={2}
                >
                  {typeDistro.map((entry) => (
                    <Cell key={entry.type} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} workouts`, name]}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {typeDistro.map(t => (
              <div key={t.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium capitalize">{t.type}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{t.count}</span>
                  <span className="text-xs text-muted-foreground ml-1">({t.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Workout } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Clock, Flame, MapPin, Trophy, Zap, Mountain,
  Heart, Timer, Target, Dumbbell, BarChart2,
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

// ── Shared: Time filter pills ──
const TIME_RANGES: TimeRange[] = ['ALL', '1Y', '6M', '3M', '1M', 'MO', 'WK'];

function ChartTimeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex gap-0.5">
      {TIME_RANGES.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors',
            value === r
              ? 'bg-emerald-500 text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ── Shared: Chart panel with own filter ──
function ChartPanel({ emoji, title, subtitle, defaultRange = '6M', children }: {
  emoji: string; title: string; subtitle: string; defaultRange?: TimeRange;
  children: (range: TimeRange) => React.ReactNode;
}) {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">{emoji} {title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChartTimeFilter value={range} onChange={setRange} />
      </div>
      {children(range)}
    </div>
  );
}

// ── Shared: Tooltip ──
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

// ── Shared: Stat Card ──
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-center')}>
      <div className={cn('mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-2', color || 'bg-primary/10')}>
        {icon}
      </div>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Shared: Insight Tile ──
function InsightTile({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-muted/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Shared: Empty state ──
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium text-foreground">No data yet</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
}

// ════════════════════════════════════════════
// 1. DASHBOARD OVERVIEW — stat cards + quick snapshot
// ════════════════════════════════════════════
interface SectionProps { workouts: Workout[]; }

export function DashboardOverview({ workouts }: SectionProps) {
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const hasStrength = summary.totalVolumeKg > 0;
  const hasDistance = summary.totalDistanceKm > 0;

  if (workouts.length === 0) return <EmptyState message="Complete some workouts to see your dashboard." />;

  return (
    <div className="space-y-5">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Trophy className="h-5 w-5 text-amber-500" />}
          label="Total Workouts" value={String(summary.totalWorkouts)}
          sub={`${summary.completedWorkouts} completed`} color="bg-amber-500/10"
        />
        {hasStrength ? (
          <StatCard
            icon={<Dumbbell className="h-5 w-5 text-violet-500" />}
            label="Total Volume" value={`${(summary.totalVolumeKg / 1000).toFixed(1)}t`}
            sub={`${summary.totalVolumeKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`}
            color="bg-violet-500/10"
          />
        ) : (
          <StatCard
            icon={<MapPin className="h-5 w-5 text-blue-500" />}
            label="Total Distance" value={`${summary.totalDistanceKm.toFixed(1)} km`}
            color="bg-blue-500/10"
          />
        )}
        <StatCard
          icon={<Timer className="h-5 w-5 text-emerald-500" />}
          label="Total Hours" value={summary.totalHours.toFixed(1)} color="bg-emerald-500/10"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          label="Avg Time" value={`${Math.round(summary.avgDurationMin)}m`} color="bg-blue-500/10"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          label="Streak" value={`${summary.currentStreak}`}
          sub={summary.currentStreak > 0 ? 'days' : 'Start today!'} color="bg-orange-500/10"
        />
      </div>

      {/* Quick snapshot charts — hours + workouts */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartPanel emoji="⏱️" title="Hours Trained" subtitle="Duration over time">
          {(range) => {
            const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
            return (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="hours" name="Hours" stroke="#10b981" strokeWidth={2} fill="url(#gH)" dot={{ r: 2, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            );
          }}
        </ChartPanel>
        <ChartPanel emoji="🏋️" title="Workouts" subtitle="Count per period">
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
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 2. TRAINING ANALYSIS — all the detailed charts
// ════════════════════════════════════════════
export function TrainingAnalysis({ workouts }: SectionProps) {
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const hasStrength = summary.totalVolumeKg > 0;
  const hasDistance = summary.totalDistanceKm > 0;
  const hasCalories = summary.totalCalories > 0;
  const hasPRs = workouts.some(w => w.prs && w.prs.length > 0);

  if (workouts.length === 0) return <EmptyState message="Complete workouts to see training analysis." />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Training Analysis</h2>
        <p className="text-sm text-muted-foreground">Detailed breakdown of your training metrics over time</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ChartPanel emoji="⏱️" title="Hours Trained" subtitle="Training duration over time">
          {(range) => {
            const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
            return (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="gHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="hours" name="Hours" stroke="#10b981" strokeWidth={2} fill="url(#gHr)" dot={{ r: 2, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            );
          }}
        </ChartPanel>

        {hasStrength && (
          <ChartPanel emoji="💪" title="Volume Progression" subtitle="Total weight lifted per period">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="volumeKg" name="Volume (kg)" stroke="#a855f7" strokeWidth={2} fill="url(#gV)" dot={{ r: 2, fill: '#a855f7' }} />
                  </AreaChart>
                </ResponsiveContainer>
              );
            }}
          </ChartPanel>
        )}

        {hasDistance && (
          <ChartPanel emoji="📏" title="Distance" subtitle="Total distance per period">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="distanceKm" name="Distance (km)" stroke="#3b82f6" strokeWidth={2} fill="url(#gD)" dot={{ r: 2, fill: '#3b82f6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              );
            }}
          </ChartPanel>
        )}

        <ChartPanel emoji="🏋️" title="Workouts" subtitle="Sessions per period">
          {(range) => {
            const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
            return (
              <ResponsiveContainer width="100%" height={220}>
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

        {hasStrength && (
          <ChartPanel emoji="📊" title="Reps & Sets" subtitle="Volume breakdown">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={220}>
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

        {hasCalories && (
          <ChartPanel emoji="🔥" title="Calories Burned" subtitle="Energy expenditure">
            {(range) => {
              const data = computeTimeSeries(filterByTimeRange(workouts, range), range);
              return (
                <ResponsiveContainer width="100%" height={220}>
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

        {hasPRs && (
          <ChartPanel emoji="🏆" title="PRs Over Time" subtitle="Personal records achieved">
            {(range) => {
              const data = computePRTimeline(workouts, range);
              return (
                <ResponsiveContainer width="100%" height={220}>
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
    </div>
  );
}

// ════════════════════════════════════════════
// 3. EXERCISE INSIGHTS — insight tiles
// ════════════════════════════════════════════
export function ExerciseInsights({ workouts }: SectionProps) {
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const insights = useMemo(() => computeInsights(workouts), [workouts]);
  const hasStrength = summary.totalVolumeKg > 0;
  const hasDistance = summary.totalDistanceKm > 0;

  if (workouts.length === 0) return <EmptyState message="Complete workouts to see insights." />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Exercise Insights</h2>
        <p className="text-sm text-muted-foreground">Key highlights from your training data</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.mostActiveType && (
          <InsightTile
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            label="Most Trained Type"
            value={insights.mostActiveType.type}
            sub={`${insights.mostActiveType.count} sessions`}
          />
        )}
        {insights.longestWorkout && (
          <InsightTile
            icon={<Clock className="h-5 w-5 text-blue-500" />}
            label="Longest Workout"
            value={insights.longestWorkout.durationMin >= 60
              ? `${Math.floor(insights.longestWorkout.durationMin / 60)}h ${insights.longestWorkout.durationMin % 60}m`
              : `${insights.longestWorkout.durationMin}m`}
            sub={insights.longestWorkout.name}
          />
        )}
        {hasStrength && (
          <InsightTile
            icon={<BarChart2 className="h-5 w-5 text-violet-500" />}
            label="Avg Volume"
            value={`${Math.round(summary.totalVolumeKg / summary.totalWorkouts).toLocaleString()} kg`}
            sub="per workout"
          />
        )}
        {hasDistance && (
          <InsightTile
            icon={<MapPin className="h-5 w-5 text-blue-500" />}
            label="Avg Distance"
            value={`${insights.avgDistanceKm.toFixed(1)} km`}
            sub="per workout"
          />
        )}
        {insights.totalElevationGain > 0 && (
          <InsightTile
            icon={<Mountain className="h-5 w-5 text-emerald-500" />}
            label="Total Elevation"
            value={`${Math.round(insights.totalElevationGain)}m`}
            sub="elevation gain"
          />
        )}
        {insights.avgHeartRate && (
          <InsightTile
            icon={<Heart className="h-5 w-5 text-red-500" />}
            label="Avg Heart Rate"
            value={`${insights.avgHeartRate} bpm`}
            sub="across workouts"
          />
        )}
        <InsightTile
          icon={<Target className="h-5 w-5 text-violet-500" />}
          label="Completion Rate"
          value={`${Math.round(summary.completionRate)}%`}
          sub="of assigned workouts"
        />
        {hasStrength && summary.totalSets > 0 && (
          <InsightTile
            icon={<Dumbbell className="h-5 w-5 text-cyan-500" />}
            label="Total Sets & Reps"
            value={`${summary.totalSets.toLocaleString()} sets`}
            sub={`${summary.totalReps.toLocaleString()} total reps`}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 4. CALENDAR VIEWS — heatmap + weekly rhythm
// ════════════════════════════════════════════
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
          if (day === null) return <div key={`e${i}`} className="w-3.5 h-3.5" />;
          const key = format(new Date(month.getFullYear(), month.getMonth(), day), 'yyyy-MM-dd');
          const count = data.get(key) || 0;
          return (
            <div
              key={key}
              className={cn(
                'w-3.5 h-3.5 rounded-sm transition-colors',
                count === 0 && 'bg-muted/40',
                count === 1 && 'bg-emerald-500/40',
                count === 2 && 'bg-emerald-500/70',
                count >= 3 && 'bg-emerald-500',
              )}
              title={`${format(new Date(month.getFullYear(), month.getMonth(), day), 'MMM d')}: ${count} workout${count !== 1 ? 's' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CalendarViews({ workouts }: SectionProps) {
  const weeklyRhythm = useMemo(() => computeWeeklyRhythm(workouts), [workouts]);

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

  if (workouts.length === 0) return <EmptyState message="Complete workouts to see calendar data." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Calendar Views</h2>
        <p className="text-sm text-muted-foreground">Consistency and rhythm patterns</p>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold">📅 Workout Calendar</p>
          <p className="text-[11px] text-muted-foreground">Last 12 months of training consistency</p>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
          {calendarMonths.map(m => (
            <MonthGrid key={format(m, 'yyyy-MM')} month={m} data={calendarData} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3.5 h-3.5 rounded-sm bg-muted/40" />
            <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/40" />
            <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/70" />
            <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Weekly Rhythm */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3">
          <p className="text-sm font-semibold">🔥 Weekly Rhythm</p>
          <p className="text-[11px] text-muted-foreground">Training frequency by day of the week</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={weeklyRhythm} outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Radar dataKey="count" name="Workouts" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 5. TYPE DISTRIBUTION — donut + legend
// ════════════════════════════════════════════
export function TypeDistribution({ workouts }: SectionProps) {
  const typeDistro = useMemo(() => computeTypeDistribution(workouts), [workouts]);

  if (workouts.length === 0) return <EmptyState message="Complete workouts to see distribution." />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Workout Type Distribution</h2>
        <p className="text-sm text-muted-foreground">Breakdown by workout type</p>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          {/* Donut */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={typeDistro} cx="50%" cy="50%"
                  innerRadius={65} outerRadius={110}
                  dataKey="count" nameKey="type"
                  stroke="none" paddingAngle={2}
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
              <div key={t.type} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
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
      </div>
    </div>
  );
}

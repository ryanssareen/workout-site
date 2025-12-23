'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, getCoachStudents } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Target, Flame, Calendar, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, differenceInDays } from 'date-fns';

interface WeeklyData {
  week: string;
  weekStart: Date;
  total: number;
  completed: number;
  rate: number;
}

interface TypeData {
  name: string;
  value: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  run: '#3b82f6',
  bike: '#22c55e',
  swim: '#06b6d4',
  strength: '#ec4899',
};

const DATE_RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export default function ProgressPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);

  const isCoach = user?.role === 'coach';

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);

      if (isCoach) {
        const studentList = await getCoachStudents(user.uid);
        setStudents(studentList);
        if (studentList.length > 0 && !selectedStudent) {
          setSelectedStudent(studentList[0].uid);
        }
      }

      // Load workouts based on role
      const userId = isCoach ? (selectedStudent || user.uid) : user.uid;
      const role = isCoach ? 'coach' : 'student';
      const data = await getUserWorkouts(userId, role);

      // Filter to only assigned workouts for the selected user
      const filtered = isCoach && selectedStudent
        ? data.filter(w => w.assignedTo === selectedStudent)
        : data;

      setWorkouts(filtered);
      setLoading(false);
    };

    loadData();
  }, [user, selectedStudent, isCoach]);

  // Filter workouts by date range
  const filteredWorkouts = useMemo(() => {
    if (dateRange === 'all') return workouts;

    const days = parseInt(dateRange);
    const cutoff = subDays(new Date(), days);

    return workouts.filter(w => w.date.toDate() >= cutoff);
  }, [workouts, dateRange]);

  // Calculate weekly completion rates
  const weeklyData = useMemo((): WeeklyData[] => {
    const weeks: Record<string, { total: number; completed: number; weekStart: Date }> = {};
    const now = new Date();
    const weeksToShow = dateRange === 'all' ? 52 : Math.ceil(parseInt(dateRange) / 7);

    // Initialize weeks
    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = startOfWeek(subDays(now, i * 7), { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'MMM d');
      weeks[weekKey] = { total: 0, completed: 0, weekStart };
    }

    // Populate with workout data
    filteredWorkouts.forEach(workout => {
      const workoutDate = workout.date.toDate();
      const weekStart = startOfWeek(workoutDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'MMM d');

      if (weeks[weekKey]) {
        weeks[weekKey].total++;
        if (workout.completed) {
          weeks[weekKey].completed++;
        }
      }
    });

    return Object.entries(weeks)
      .map(([week, data]) => ({
        week,
        weekStart: data.weekStart,
        total: data.total,
        completed: data.completed,
        rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .slice(-12); // Last 12 weeks
  }, [filteredWorkouts, dateRange]);

  // Calculate workout type distribution
  const typeData = useMemo((): TypeData[] => {
    const counts: Record<string, number> = { run: 0, bike: 0, swim: 0, strength: 0 };

    filteredWorkouts.filter(w => w.completed).forEach(workout => {
      counts[workout.type]++;
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: TYPE_COLORS[name],
      }));
  }, [filteredWorkouts]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = filteredWorkouts.filter(w => w.completed);
    const total = filteredWorkouts.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // Calculate streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = subDays(today, i);
      checkDate.setHours(0, 0, 0, 0);

      const dayWorkouts = filteredWorkouts.filter(w => {
        const wDate = w.date.toDate();
        wDate.setHours(0, 0, 0, 0);
        return wDate.getTime() === checkDate.getTime();
      });

      if (dayWorkouts.length === 0) {
        // No workouts scheduled this day, continue
        continue;
      }

      const allCompleted = dayWorkouts.every(w => w.completed);
      if (allCompleted) {
        streak++;
      } else {
        break;
      }
    }

    // Find best week
    const bestWeek = weeklyData.reduce((best, week) =>
      week.rate > best.rate ? week : best,
      { week: '-', rate: 0 } as WeeklyData
    );

    // Aggregate Strava stats
    let totalDistance = 0;
    let totalTime = 0;
    let totalCalories = 0;

    completed.forEach(w => {
      if (w.actualStats) {
        totalDistance += w.actualStats.distance || 0;
        totalTime += w.actualStats.duration || 0;
        totalCalories += w.actualStats.calories || 0;
      }
    });

    return {
      total,
      completed: completed.length,
      completionRate,
      streak,
      bestWeek: bestWeek.week,
      bestWeekRate: bestWeek.rate,
      totalDistance: (totalDistance / 1000).toFixed(1), // km
      totalTime: Math.round(totalTime / 60), // minutes
      totalCalories,
    };
  }, [filteredWorkouts, weeklyData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Progress</h1>
          <p className="text-muted-foreground">
            Track your workout performance and trends
          </p>
        </div>

        <div className="flex gap-3">
          {/* Coach: Student selector */}
          {isCoach && students.length > 0 && (
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.uid} value={student.uid}>
                    {student.displayName || student.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date range selector */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}/{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.streak} days</div>
            <p className="text-xs text-muted-foreground">
              Keep it going!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bestWeekRate}%</div>
            <p className="text-xs text-muted-foreground">
              Week of {stats.bestWeek}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistance} km</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTime} min • {stats.totalCalories.toLocaleString()} cal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Completion Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Completion Rate</CardTitle>
            <CardDescription>Your workout completion percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Completion Rate']}
                    labelFormatter={(label) => `Week of ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Workout Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Workout Distribution</CardTitle>
            <CardDescription>Breakdown of completed workouts by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No completed workouts in this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Breakdown Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown</CardTitle>
          <CardDescription>Assigned vs completed workouts per week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="total" name="Assigned" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

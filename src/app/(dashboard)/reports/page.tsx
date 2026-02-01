'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getCoachStudents, getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout, User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  FileText, Download, Printer, Users, Target, CheckCircle2,
  TrendingUp, Calendar as CalendarIcon, Loader2, BarChart3
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

type DateRange = '7' | '30' | '90' | 'custom';

interface StudentInfo {
  uid: string;
  displayName: string;
  email: string;
}

const TYPE_COLORS: Record<string, string> = {
  run: '#3b82f6',
  bike: '#22c55e',
  swim: '#06b6d4',
  strength: '#ec4899',
  other: '#8b5cf6',
};

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [dataLoading, setDataLoading] = useState(true);

  const reportRef = useRef<HTMLDivElement>(null);

  // Redirect non-coaches
  useEffect(() => {
    if (!loading && user && user.role !== 'coach') {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Load students and workouts
  useEffect(() => {
    async function loadData() {
      if (!user || user.role !== 'coach') return;

      setDataLoading(true);

      const studentData = await getCoachStudents(user.uid);
      setStudents(studentData.map(s => ({
        uid: s.uid,
        displayName: s.displayName || 'Unknown',
        email: s.email || '',
      })));

      const workouts = await getUserWorkouts(user.uid, 'coach');
      setAllWorkouts(workouts);

      setDataLoading(false);
    }

    loadData();
  }, [user]);

  // Calculate date range
  const dateFilter = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    if (dateRange === 'custom' && customStartDate && customEndDate) {
      start = startOfDay(customStartDate);
      end = endOfDay(customEndDate);
    } else {
      const days = parseInt(dateRange);
      start = startOfDay(subDays(now, days));
    }

    return { start, end };
  }, [dateRange, customStartDate, customEndDate]);

  // Filter workouts
  const filteredWorkouts = useMemo(() => {
    return allWorkouts.filter(workout => {
      const workoutDate = workout.date?.toDate?.() || new Date(workout.date as any);

      // Date filter
      if (!isWithinInterval(workoutDate, { start: dateFilter.start, end: dateFilter.end })) {
        return false;
      }

      // Student filter
      if (selectedStudent !== 'all' && workout.assignedTo !== selectedStudent) {
        return false;
      }

      return true;
    });
  }, [allWorkouts, dateFilter, selectedStudent]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredWorkouts.length;
    const completed = filteredWorkouts.filter(w => w.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byType: Record<string, { total: number; completed: number }> = {
      run: { total: 0, completed: 0 },
      bike: { total: 0, completed: 0 },
      swim: { total: 0, completed: 0 },
      strength: { total: 0, completed: 0 },
      other: { total: 0, completed: 0 },
    };

    filteredWorkouts.forEach(w => {
      const type = w.type || 'other';
      if (byType[type]) {
        byType[type].total++;
        if (w.completed) byType[type].completed++;
      }
    });

    return { total, completed, completionRate, byType };
  }, [filteredWorkouts]);

  // Chart data - workouts over time
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFilter.start, end: dateFilter.end });

    return days.map(day => {
      const dayWorkouts = filteredWorkouts.filter(w => {
        const workoutDate = w.date?.toDate?.() || new Date(w.date as any);
        return format(workoutDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });

      return {
        date: format(day, 'MMM d'),
        total: dayWorkouts.length,
        completed: dayWorkouts.filter(w => w.completed).length,
      };
    });
  }, [filteredWorkouts, dateFilter]);

  // Pie chart data for workout types
  const typeChartData = useMemo(() => {
    return Object.entries(stats.byType)
      .filter(([_, data]) => data.total > 0)
      .map(([type, data]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: data.total,
        color: TYPE_COLORS[type] || '#666',
      }));
  }, [stats.byType]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    // Use browser's print to PDF functionality
    window.print();
  };

  // Get student name
  const getStudentName = (uid: string) => {
    const student = students.find(s => s.uid === uid);
    return student?.displayName || 'Unknown';
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'coach') {
    return null;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-1">Analyze athlete performance and progress</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="print:hidden">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExportPDF} className="print:hidden">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Student Selector */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Athlete</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select athlete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Athletes</SelectItem>
                  {students.map(student => (
                    <SelectItem key={student.uid} value={student.uid}>
                      {student.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Selector */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Pickers */}
            {dateRange === 'custom' && (
              <>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content - this part gets printed */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* Print Header */}
        <div className="hidden print:block mb-8">
          <h1 className="text-2xl font-bold">Workout Report</h1>
          <p className="text-sm text-gray-600">
            {selectedStudent === 'all' ? 'All Athletes' : getStudentName(selectedStudent)} |{' '}
            {format(dateFilter.start, 'MMM d, yyyy')} - {format(dateFilter.end, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-gray-500">Generated on {format(new Date(), 'PPP')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Workouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
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
              <div className="text-3xl font-bold">{stats.completionRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Athletes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {selectedStudent === 'all' ? students.length : 1}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* By Type Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Workouts by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div key={type} className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium capitalize mb-1">{type}</div>
                  <div className="text-2xl font-bold" style={{ color: TYPE_COLORS[type] }}>
                    {data.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.completed} completed
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
          {/* Workouts Over Time */}
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Workouts Over Time</CardTitle>
              <CardDescription>Daily workout count in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] print:h-[200px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data for selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workout Type Distribution */}
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Type Distribution</CardTitle>
              <CardDescription>Breakdown by workout type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] print:h-[200px]">
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {typeChartData.map((entry, index) => (
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
                    No data for selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workouts Table */}
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>Workout Details</CardTitle>
            <CardDescription>
              {filteredWorkouts.length} workouts in selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredWorkouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No workouts found for the selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Workout</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkouts
                      .sort((a, b) => {
                        const dateA = a.date?.toDate?.() || new Date(a.date as any);
                        const dateB = b.date?.toDate?.() || new Date(b.date as any);
                        return dateB.getTime() - dateA.getTime();
                      })
                      .slice(0, 50) // Limit to 50 for performance
                      .map(workout => {
                        const workoutDate = workout.date?.toDate?.() || new Date(workout.date as any);
                        return (
                          <TableRow key={workout.id}>
                            <TableCell className="font-medium">
                              {format(workoutDate, 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>{getStudentName(workout.assignedTo)}</TableCell>
                            <TableCell>{workout.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="capitalize"
                                style={{ backgroundColor: `${TYPE_COLORS[workout.type]}20`, color: TYPE_COLORS[workout.type] }}
                              >
                                {workout.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {workout.duration ? `${workout.duration} min` : '-'}
                            </TableCell>
                            <TableCell>
                              {workout.completed ? (
                                <Badge variant="default" className="bg-green-500">
                                  Completed
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                {filteredWorkouts.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 50 of {filteredWorkouts.length} workouts
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          nav, header, footer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

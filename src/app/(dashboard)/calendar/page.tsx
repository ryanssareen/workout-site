'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  Circle,
  Activity,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isPast,
  startOfWeek,
  endOfWeek,
  getWeek,
} from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CalendarPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function loadWorkouts() {
      if (!user) return;

      const data = await getUserWorkouts(user.uid, user.role);
      setWorkouts(data);
      setLoading(false);
    }

    loadWorkouts();
  }, [user]);

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(workout =>
      isSameDay(workout.date.toDate(), date)
    );
  };

  // Calculate week stats
  const weekStats = useMemo(() => {
    const stats: Record<number, { total: number; completed: number }> = {};

    workouts.forEach(workout => {
      const workoutDate = workout.date.toDate();
      if (isSameMonth(workoutDate, currentMonth)) {
        const weekNum = getWeek(workoutDate);
        if (!stats[weekNum]) {
          stats[weekNum] = { total: 0, completed: 0 };
        }
        stats[weekNum].total++;
        if (workout.completed) {
          stats[weekNum].completed++;
        }
      }
    });

    return stats;
  }, [workouts, currentMonth]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Get days to show (including previous/next month padding)
  const firstDayOfMonth = startOfMonth(currentMonth).getDay();
  const daysToShow: Date[] = [];

  // Add padding days from previous month
  for (let i = 0; i < firstDayOfMonth; i++) {
    const day = new Date(currentMonth);
    day.setDate(0 - (firstDayOfMonth - i - 1));
    daysToShow.push(day);
  }

  // Add current month days
  daysToShow.push(...daysInMonth);

  // Pad to complete last week
  const remainingDays = 7 - (daysToShow.length % 7);
  if (remainingDays < 7) {
    const lastDay = daysToShow[daysToShow.length - 1];
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(lastDay);
      day.setDate(day.getDate() + i);
      daysToShow.push(day);
    }
  }

  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  // Generate ICS file for export
  const generateICS = () => {
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Workout Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    workouts.forEach(workout => {
      const workoutDate = workout.date.toDate();
      const dateStr = format(workoutDate, "yyyyMMdd'T'HHmmss");
      const endDate = new Date(workoutDate);
      endDate.setMinutes(endDate.getMinutes() + (workout.duration || 60));
      const endStr = format(endDate, "yyyyMMdd'T'HHmmss");

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${workout.id}@workout-tracker`,
        `DTSTART:${dateStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${workout.name} (${workout.type})`,
        `DESCRIPTION:${workout.description.replace(/\n/g, '\\n')}`,
        `STATUS:${workout.completed ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      );
    });

    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts-${format(currentMonth, 'yyyy-MM')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Calendar exported! Import into Google Calendar, Apple Calendar, or Outlook.');
  };

  const handleToggleComplete = async (workout: Workout) => {
    try {
      await completeWorkout(workout.id, !workout.completed);
      
      // Reload workouts to get updated completedLate field
      const data = await getUserWorkouts(user!.uid, user!.role);
      setWorkouts(data);
      
      toast.success(workout.completed ? 'Marked as incomplete' : 'Marked as complete!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dayWorkouts = getWorkoutsForDate(date);
    if (dayWorkouts.length > 0) {
      setModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Workout Calendar
          </h1>
          <p className="text-muted-foreground mt-2">View and manage your workout schedule</p>
        </div>

        <Button variant="outline" onClick={generateICS}>
          <Download className="h-4 w-4 mr-2" />
          Export to Calendar
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {daysToShow.map((date, index) => {
                const dayWorkouts = getWorkoutsForDate(date);
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isTodayDate = isToday(date);
                const isPastDate = isPast(date) && !isTodayDate;

                // Determine day status
                const hasWorkouts = dayWorkouts.length > 0;
                const allCompleted = hasWorkouts && dayWorkouts.every(w => w.completed);
                const hasLateCompletion = hasWorkouts && dayWorkouts.some(w => w.completed && w.completedLate);
                const hasMissed = hasWorkouts && isPastDate && dayWorkouts.some(w => !w.completed);
                const hasUpcoming = hasWorkouts && !isPastDate && dayWorkouts.some(w => !w.completed);

                // Get completion stats for the week (show on Sundays)
                const weekNum = getWeek(date);
                const isWeekStart = date.getDay() === 0;
                const weekStat = weekStats[weekNum];

                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      'min-h-[80px] p-2 rounded-lg border-2 transition-all relative',
                      'flex flex-col items-start',
                      !isCurrentMonth && 'bg-muted/30 opacity-50',
                      isCurrentMonth && 'bg-background',
                      isSelected && 'border-primary bg-primary/10',
                      !isSelected && 'border-transparent hover:border-muted-foreground/20',
                      isTodayDate && 'ring-2 ring-primary ring-offset-2',
                      allCompleted && !hasLateCompletion && isCurrentMonth && 'bg-green-50 dark:bg-green-950/30',
                      hasLateCompletion && isCurrentMonth && 'bg-orange-50 dark:bg-orange-950/30',
                      hasMissed && isCurrentMonth && 'bg-red-50 dark:bg-red-950/30',
                    )}
                  >
                    <span className={cn(
                      'text-sm font-medium',
                      !isCurrentMonth && 'text-muted-foreground',
                      isTodayDate && 'text-primary font-bold',
                    )}>
                      {format(date, 'd')}
                    </span>

                    {/* Workout indicators */}
                    {hasWorkouts && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dayWorkouts.slice(0, 3).map((workout, idx) => {
                          let dotColor = 'bg-blue-500'; // upcoming
                          if (workout.completed) {
                            if (workout.completedLate) {
                              dotColor = 'bg-orange-500'; // completed late
                            } else {
                              dotColor = 'bg-green-500'; // completed on time
                            }
                          } else if (isPastDate) {
                            dotColor = 'bg-red-500'; // missed
                          }

                          const status = workout.completed 
                            ? (workout.completedLate ? 'completed late' : 'completed on time')
                            : (isPastDate ? 'missed' : 'upcoming');

                          return (
                            <div
                              key={idx}
                              className={cn('w-2 h-2 rounded-full', dotColor)}
                              title={`${workout.name} (${status})`}
                            />
                          );
                        })}
                        {dayWorkouts.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            +{dayWorkouts.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Workout count badge */}
                    {hasWorkouts && (
                      <div className="absolute bottom-1 right-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] px-1 py-0 h-4',
                            allCompleted && !hasLateCompletion && 'bg-green-100 text-green-700',
                            hasLateCompletion && 'bg-orange-100 text-orange-700',
                            hasMissed && 'bg-red-100 text-red-700',
                            hasUpcoming && 'bg-blue-100 text-blue-700',
                          )}
                        >
                          {dayWorkouts.length}
                        </Badge>
                      </div>
                    )}

                    {/* Week completion indicator (Sunday) */}
                    {isWeekStart && weekStat && weekStat.total > 0 && isCurrentMonth && (
                      <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-background"
                        >
                          {Math.round((weekStat.completed / weekStat.total) * 100)}%
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
            <CardDescription>
              {selectedDate && selectedDateWorkouts.length > 0
                ? `${selectedDateWorkouts.length} workout${selectedDateWorkouts.length !== 1 ? 's' : ''}`
                : 'No workouts scheduled'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateWorkouts.length > 0 ? (
              <div className="space-y-3">
                {selectedDateWorkouts.map(workout => {
                  const isPastWorkout = isPast(workout.date.toDate()) && !isToday(workout.date.toDate());
                  const isMissed = isPastWorkout && !workout.completed;

                  return (
                    <div
                      key={workout.id}
                      className={cn(
                        'p-4 border rounded-lg transition-colors',
                        workout.completed && 'bg-green-50 dark:bg-green-950/20 border-green-200',
                        isMissed && 'bg-red-50 dark:bg-red-950/20 border-red-200',
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/workouts/${workout.id}`} className="hover:underline">
                            <h3 className="font-semibold">{workout.name}</h3>
                          </Link>
                          <Badge
                            variant={workout.completed ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {workout.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {workout.description}
                        </p>
                        {workout.duration && (
                          <p className="text-xs text-muted-foreground">
                            Duration: {workout.duration} minutes
                          </p>
                        )}

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-2">
                          {workout.completed && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                          {workout.completedBy === 'strava' && (
                            <Badge variant="outline" className="border-orange-500 text-orange-600">
                              <Activity className="h-3 w-3 mr-1" />
                              Strava
                            </Badge>
                          )}
                          {isMissed && (
                            <Badge variant="destructive">
                              Missed
                            </Badge>
                          )}
                        </div>

                        {/* Quick complete button */}
                        <Button
                          variant={workout.completed ? 'outline' : 'default'}
                          size="sm"
                          className={cn(
                            'w-full mt-2',
                            !workout.completed && 'bg-green-600 hover:bg-green-700'
                          )}
                          onClick={() => handleToggleComplete(workout)}
                        >
                          {workout.completed ? (
                            <>
                              <Circle className="h-4 w-4 mr-1" />
                              Mark Incomplete
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark Complete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">
                  {selectedDate ? 'No workouts on this date' : 'Click a date to view workouts'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>Completed Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg ring-2 ring-primary ring-offset-2" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] px-1">75%</Badge>
              <span>Week completion rate</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout Modal (for mobile-friendly quick view) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDateWorkouts.map(workout => (
              <Link
                key={workout.id}
                href={`/workouts/${workout.id}`}
                className={cn(
                  'block p-4 border rounded-lg hover:bg-muted/50 transition-colors',
                  workout.completed && 'bg-green-50 dark:bg-green-950/20 border-green-200',
                )}
                onClick={() => setModalOpen(false)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{workout.type}</p>
                  </div>
                  {workout.completed && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

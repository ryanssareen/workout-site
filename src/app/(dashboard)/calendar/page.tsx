'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import Link from 'next/link';

export default function CalendarPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-8 w-8" />
          Workout Calendar
        </h1>
        <p className="text-muted-foreground mt-2">View and manage your workout schedule</p>
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
            <div className="grid grid-cols-7 gap-2">
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
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      min-h-[80px] p-2 rounded-lg border-2 transition-all
                      ${isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                      ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted-foreground/20'}
                      ${isTodayDate ? 'ring-2 ring-primary' : ''}
                      flex flex-col items-start
                    `}
                  >
                    <span className={`
                      text-sm font-medium
                      ${!isCurrentMonth && 'text-muted-foreground'}
                      ${isTodayDate && 'text-primary font-bold'}
                    `}>
                      {format(date, 'd')}
                    </span>
                    {dayWorkouts.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dayWorkouts.slice(0, 3).map((workout, idx) => (
                          <div 
                            key={idx}
                            className={`
                              w-2 h-2 rounded-full
                              ${workout.completed ? 'bg-green-500' : 'bg-blue-500'}
                            `}
                            title={workout.name}
                          />
                        ))}
                        {dayWorkouts.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayWorkouts.length - 3}
                          </span>
                        )}
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
                {selectedDateWorkouts.map(workout => (
                  <Link
                    key={workout.id}
                    href={`/workouts/${workout.id}`}
                    className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{workout.name}</h3>
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
                      {workout.completed && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          ✓ Completed
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
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
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Pending workout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Completed workout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg ring-2 ring-primary" />
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import Link from 'next/link';
import { Loader2, Calendar, User, Repeat, Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface RecurringSchedule {
  id: string;
  studentId: string;
  intervalDays: number;
  workoutTemplate: {
    name: string;
    type: string;
  };
  endCondition: {
    type: 'date' | 'count' | 'none';
    endDate?: any;
    remainingCount?: number;
    totalCount?: number;
  };
  nextSendDate: any;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  sentWorkoutIds: string[];
}

export default function RecurringSchedulesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [students, setStudents] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchSchedules();
  }, [user]);

  const fetchSchedules = async () => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/recurring-schedules', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch schedules');

      const data = await response.json();
      setSchedules(data);

      // Fetch student details
      const studentIds = [...new Set(data.map((s: any) => s.studentId))];
      const studentData: Record<string, any> = {};

      for (const studentId of studentIds) {
        const studentRes = await fetch(`/api/users/${studentId}`);
        if (studentRes.ok) {
          const student = await studentRes.json();
          studentData[studentId] = student;
        }
      }

      setStudents(studentData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = async (scheduleId: string, currentStatus: string) => {
    try {
      const token = await user?.getIdToken();
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update schedule');

      toast.success(`Schedule ${newStatus === 'active' ? 'resumed' : 'paused'}`);
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
    }
  };

  const handleCancel = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to cancel this recurring schedule?')) return;

    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to cancel schedule');

      toast.success('Schedule cancelled');
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel schedule');
    }
  };

  const filteredSchedules = schedules.filter(s =>
    activeTab === 'all' ? true : s.status === activeTab
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recurring Workout Schedules</h1>
          <p className="text-muted-foreground mt-1">
            Manage automatic workout scheduling for your students
          </p>
        </div>
        <Button asChild>
          <Link href="/workouts/new">Create New Schedule</Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">
            Active ({schedules.filter(s => s.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused ({schedules.filter(s => s.status === 'paused').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({schedules.filter(s => s.status === 'completed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {filteredSchedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Repeat className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No schedules found</h3>
                <p className="text-muted-foreground text-center max-w-md mt-2">
                  {activeTab === 'all'
                    ? 'Create recurring workout schedules to automatically send workouts to your students'
                    : `No ${activeTab} schedules found`
                  }
                </p>
                {activeTab === 'all' && (
                  <Button asChild className="mt-4">
                    <Link href="/workouts/new">Create Your First Schedule</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredSchedules.map((schedule) => {
              const student = students[schedule.studentId];
              const nextSend = schedule.nextSendDate?.toDate
                ? schedule.nextSendDate.toDate()
                : new Date(schedule.nextSendDate);

              return (
                <Card key={schedule.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle>{schedule.workoutTemplate.name}</CardTitle>
                        <CardDescription className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {student?.displayName || 'Loading...'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Repeat className="h-3 w-3" />
                            Every {schedule.intervalDays} days
                          </span>
                        </CardDescription>
                      </div>
                      <Badge variant={
                        schedule.status === 'active' ? 'default' :
                        schedule.status === 'paused' ? 'secondary' :
                        'outline'
                      }>
                        {schedule.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-muted-foreground">Next send</p>
                          <p className="font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(nextSend, 'PPP')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Sent workouts</p>
                          <p className="font-medium">
                            {schedule.sentWorkoutIds?.length || 0}
                          </p>
                        </div>
                      </div>

                      {schedule.endCondition.type === 'count' && (
                        <p className="text-sm text-muted-foreground">
                          {schedule.endCondition.remainingCount} of {schedule.endCondition.totalCount} remaining
                        </p>
                      )}
                      {schedule.endCondition.type === 'date' && schedule.endCondition.endDate && (
                        <p className="text-sm text-muted-foreground">
                          Ends on {format(
                            schedule.endCondition.endDate.toDate
                              ? schedule.endCondition.endDate.toDate()
                              : new Date(schedule.endCondition.endDate),
                            'PP'
                          )}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        {schedule.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePauseResume(schedule.id, schedule.status)}
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {schedule.status === 'paused' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePauseResume(schedule.id, schedule.status)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        {(schedule.status === 'active' || schedule.status === 'paused') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

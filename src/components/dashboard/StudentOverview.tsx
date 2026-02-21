'use client';

import { StudentWithStats } from '@/lib/firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressRing } from './stats/ProgressRing';
import { Users, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StudentOverviewProps {
  students: StudentWithStats[];
  delay?: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function StudentCard({ student, index }: { student: StudentWithStats; index: number }) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl border bg-card hover:shadow-md dark:hover:shadow-none hover:border-primary/20 dark:hover:border-white/20 transition-all duration-300',
        'animate-in fade-in slide-in-from-bottom-2 duration-500'
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
          student.isActive
            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
            : 'bg-muted text-muted-foreground'
        )}>
          {getInitials(student.displayName)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{student.displayName}</h4>
            {student.isActive && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active this week" />
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {student.assignedWorkouts}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {student.completedWorkouts}
            </span>
          </div>
        </div>

        {/* Progress */}
        <ProgressRing
          progress={student.completionRate}
          size="sm"
          color={student.completionRate >= 70 ? 'stroke-green-500' : student.completionRate >= 40 ? 'stroke-amber-500' : 'stroke-red-400'}
        />
      </div>
    </div>
  );
}

export function StudentOverview({ students, delay = 0 }: StudentOverviewProps) {
  const displayStudents = students.slice(0, 6);
  const hasMore = students.length > 6;

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Your Athletes
            </CardTitle>
            <CardDescription>
              {students.length} athlete{students.length !== 1 ? 's' : ''} enrolled
            </CardDescription>
          </div>
          {hasMore && (
            <Badge variant="secondary" className="text-xs">
              +{students.length - 6} more
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {students.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No athletes yet. Share your coach code to get started!
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {displayStudents.map((student, index) => (
              <StudentCard key={student.uid} student={student} index={index} />
            ))}
          </div>
        )}

        {students.length > 0 && (
          <Button
            variant="ghost"
            className="w-full mt-4 group"
            asChild
          >
            <Link href="/workouts">
              View All Activity
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

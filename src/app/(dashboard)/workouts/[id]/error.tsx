'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function WorkoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Workout detail error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <AlertCircle className="h-12 w-12 text-amber-500" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')
          ? 'Firebase daily quota has been reached. Please try again later.'
          : 'Failed to load this workout. This is usually temporary.'}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/workouts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workouts
          </Link>
        </Button>
      </div>
    </div>
  );
}

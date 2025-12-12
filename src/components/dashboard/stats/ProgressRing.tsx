'use client';

import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  color?: string;
}

const sizeMap = {
  sm: 48,
  md: 72,
  lg: 96,
};

export function ProgressRing({
  progress,
  size = 'md',
  strokeWidth = 6,
  className,
  showValue = true,
  color = 'stroke-primary',
}: ProgressRingProps) {
  const dimension = sizeMap[size];
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn('transition-all duration-1000 ease-out', color)}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            ['--progress' as string]: offset,
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            'font-bold',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-lg'
          )}>
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

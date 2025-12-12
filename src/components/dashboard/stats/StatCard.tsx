'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  iconGradient: string;
  delay?: number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  gradient,
  iconGradient,
  delay = 0,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden group hover:shadow-lg hover:scale-[1.02] transition-all duration-300',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Gradient background on hover */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          gradient
        )}
      />

      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <CardDescription className="text-sm font-medium">{title}</CardDescription>
          <div
            className={cn(
              'p-2.5 rounded-xl bg-gradient-to-br shadow-sm',
              iconGradient
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>

        <div className="flex items-end gap-2 mt-2">
          <CardTitle className="text-4xl font-bold tracking-tight animate-count-up">
            {value}
          </CardTitle>
          {trend && (
            <span
              className={cn(
                'text-sm font-medium mb-1',
                trend.isPositive ? 'text-green-600' : 'text-red-500'
              )}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardHeader>
    </Card>
  );
}

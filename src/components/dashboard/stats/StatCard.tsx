'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  iconGradient: string;
  delay?: number;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, gradient, iconGradient, delay = 0, trend, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden p-5 transition-all duration-300 group',
        'hover:shadow-lg dark:hover:shadow-none dark:hover:border-white/20',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity',
        gradient
      )} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('p-2 rounded-lg bg-gradient-to-br shadow-sm', iconGradient)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <span className={cn('text-sm font-medium mb-1', trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </Card>
  );
}

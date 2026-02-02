import { StatSection } from '@/types/reports';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  section: StatSection;
}

export function StatCard({ section }: StatCardProps) {
  const { label, value, trend, change, subtitle } = section;

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600';
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'neutral':
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              {value}
            </p>
            {change && (
              <div className={cn('flex items-center gap-1 text-sm font-semibold', getTrendColor())}>
                {getTrendIcon()}
                <span>{change}</span>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

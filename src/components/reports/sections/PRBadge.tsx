import { PRBadgeSection } from '@/types/reports';
import { Trophy, TrendingUp } from 'lucide-react';

interface PRBadgeProps {
  section: PRBadgeSection;
}

export function PRBadge({ section }: PRBadgeProps) {
  const { exercise, value, date, previous } = section;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Trophy className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Personal Record
            </p>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            {exercise}
          </h3>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {value}
            </p>
            {previous && (
              <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                <TrendingUp className="h-3 w-3" />
                <span>from {previous}</span>
              </div>
            )}
          </div>
          {date && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {date}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

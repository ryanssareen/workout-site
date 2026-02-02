import { HighlightSection } from '@/types/reports';
import { Trophy, Flame, Target, AlertCircle, Info, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HighlightCalloutProps {
  section: HighlightSection;
}

export function HighlightCallout({ section }: HighlightCalloutProps) {
  const { icon, content, variant = 'info' } = section;

  const getIcon = () => {
    switch (icon) {
      case 'trophy':
        return <Trophy className="h-5 w-5" />;
      case 'fire':
        return <Flame className="h-5 w-5" />;
      case 'target':
        return <Target className="h-5 w-5" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      case 'star':
        return <Star className="h-5 w-5" />;
      case 'trend':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const variantStyles = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    warning: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    achievement: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
  };

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-xl border-2 shadow-sm',
      variantStyles[variant]
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <p className="flex-1 font-medium leading-relaxed">
        {content}
      </p>
    </div>
  );
}

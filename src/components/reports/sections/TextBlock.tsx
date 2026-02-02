import { TextSection } from '@/types/reports';
import { cn } from '@/lib/utils';

interface TextBlockProps {
  section: TextSection;
}

export function TextBlock({ section }: TextBlockProps) {
  const { content, variant = 'default' } = section;

  const variantStyles = {
    default: 'text-slate-700 dark:text-slate-300',
    muted: 'text-slate-500 dark:text-slate-400 text-sm',
    emphasis: 'text-slate-900 dark:text-slate-100 font-medium',
  };

  return (
    <p className={cn('leading-relaxed', variantStyles[variant])}>
      {content}
    </p>
  );
}

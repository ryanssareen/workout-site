'use client';

import { WorkoutRating } from '@/types';
import { cn } from '@/lib/utils';

interface RatingSelectorProps {
  value?: WorkoutRating;
  onChange: (rating: WorkoutRating | undefined) => void;
  disabled?: boolean;
}

const ratings: { value: WorkoutRating; emoji: string; label: string; color: string }[] = [
  { value: 'too_easy', emoji: '😌', label: 'Too Easy', color: 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200' },
  { value: 'just_right', emoji: '😊', label: 'Just Right', color: 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' },
  { value: 'too_hard', emoji: '😰', label: 'Too Hard', color: 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' },
];

export function RatingSelector({ value, onChange, disabled }: RatingSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ratings.map((rating) => (
        <button
          key={rating.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === rating.value ? undefined : rating.value)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            value === rating.value
              ? `${rating.color} border-current`
              : 'bg-muted/50 border-transparent hover:border-muted-foreground/20'
          )}
        >
          <span className="text-lg">{rating.emoji}</span>
          <span>{rating.label}</span>
        </button>
      ))}
    </div>
  );
}

export function RatingBadge({ rating }: { rating: WorkoutRating }) {
  const ratingData = ratings.find((r) => r.value === rating);
  if (!ratingData) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        rating === 'too_easy' && 'bg-blue-100 text-blue-700',
        rating === 'just_right' && 'bg-green-100 text-green-700',
        rating === 'too_hard' && 'bg-red-100 text-red-700'
      )}
    >
      <span>{ratingData.emoji}</span>
      <span>{ratingData.label}</span>
    </span>
  );
}

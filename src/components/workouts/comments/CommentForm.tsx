'use client';

import { useState } from 'react';
import { WorkoutRating } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RatingSelector } from './RatingSelector';
import { Send, X } from 'lucide-react';

interface CommentFormProps {
  onSubmit: (text: string, rating?: WorkoutRating) => Promise<void>;
  isCoach?: boolean;
  replyingTo?: string;
  onCancelReply?: () => void;
  placeholder?: string;
}

export function CommentForm({
  onSubmit,
  isCoach,
  replyingTo,
  onCancelReply,
  placeholder = 'Share your feedback...',
}: CommentFormProps) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState<WorkoutRating | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(text.trim(), rating);
      setText('');
      setRating(undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {replyingTo && (
        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          <span>Replying to comment</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Rating selector - only for athletes (not coaches replying) */}
      {!isCoach && !replyingTo && (
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            How did this workout feel?
          </label>
          <RatingSelector
            value={rating}
            onChange={setRating}
            disabled={isSubmitting}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          rows={2}
          className="resize-none flex-1"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!text.trim() || isSubmitting}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

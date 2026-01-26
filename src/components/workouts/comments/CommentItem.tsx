'use client';

import { WorkoutComment } from '@/types';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Reply } from 'lucide-react';
import { RatingBadge } from './RatingSelector';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: WorkoutComment;
  currentUserId: string;
  onDelete?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  isCoach?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isCoach,
}: CommentItemProps) {
  const isOwn = comment.userId === currentUserId;
  const initials = comment.userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg',
        comment.isCoachReply && 'ml-8 bg-muted/50',
        !comment.isCoachReply && 'bg-background'
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs',
            comment.userRole === 'coach'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{comment.userName}</span>
          {comment.userRole === 'coach' && (
            <Badge variant="secondary" className="text-xs">
              Coach
            </Badge>
          )}
          {comment.rating && <RatingBadge rating={comment.rating} />}
          <span className="text-xs text-muted-foreground">
            {format(comment.createdAt.toDate(), 'MMM d, h:mm a')}
          </span>
        </div>

        <p className="text-sm mt-1 text-foreground whitespace-pre-wrap break-words">
          {comment.text}
        </p>

        <div className="flex items-center gap-2 mt-2">
          {/* Coach can reply to athlete comments */}
          {isCoach && comment.userRole === 'athlete' && !comment.isCoachReply && onReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}

          {/* Users can delete their own comments */}
          {isOwn && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

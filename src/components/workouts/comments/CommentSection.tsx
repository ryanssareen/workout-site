'use client';

import { useState, useEffect } from 'react';
import { WorkoutComment, WorkoutRating } from '@/types';
import { getWorkoutComments, addWorkoutComment, deleteWorkoutComment } from '@/lib/firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface CommentSectionProps {
  workoutId: string;
  workoutName: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'coach' | 'athlete';
  coachId?: string;
}

export function CommentSection({
  workoutId,
  workoutName,
  currentUserId,
  currentUserName,
  currentUserRole,
}: CommentSectionProps) {
  const [comments, setComments] = useState<WorkoutComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | undefined>();

  const loadComments = async () => {
    const data = await getWorkoutComments(workoutId);
    setComments(data);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [workoutId]);

  const handleSubmit = async (text: string, rating?: WorkoutRating) => {
    try {
      await addWorkoutComment(
        workoutId,
        currentUserId,
        currentUserRole,
        currentUserName,
        text,
        rating,
        replyingTo
      );

      // Send notification email to coach if athlete comments
      if (currentUserRole === 'athlete') {
        try {
          await fetch('/api/notifications/workout-comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workoutId,
              workoutName,
              commentText: text,
              athleteName: currentUserName,
              rating,
            }),
          });
        } catch (e) {
          // Don't fail the comment if notification fails
          console.error('Failed to send notification:', e);
        }
      }

      toast.success('Comment added');
      setReplyingTo(undefined);
      await loadComments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await deleteWorkoutComment(workoutId, commentId);
      toast.success('Comment deleted');
      await loadComments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete comment');
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
  };

  // Group comments with their replies
  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parentCommentId) {
      if (!acc[c.parentCommentId]) {
        acc[c.parentCommentId] = [];
      }
      acc[c.parentCommentId].push(c);
    }
    return acc;
  }, {} as Record<string, WorkoutComment[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Feedback & Comments
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment form */}
        <CommentForm
          onSubmit={handleSubmit}
          isCoach={currentUserRole === 'coach'}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(undefined)}
          placeholder={
            currentUserRole === 'coach'
              ? 'Add a note for your athlete...'
              : 'How did this workout feel?'
          }
        />

        {/* Comments list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to share feedback!
          </div>
        ) : (
          <div className="space-y-2 mt-6">
            {topLevelComments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isCoach={currentUserRole === 'coach'}
                />
                {/* Replies */}
                {repliesByParent[comment.id]?.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    onDelete={handleDelete}
                    isCoach={currentUserRole === 'coach'}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

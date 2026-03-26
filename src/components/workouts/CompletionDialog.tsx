'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { Confetti } from '@/components/ui/confetti';

const RATING_EMOJIS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😫', label: 'Struggled' },
  2: { emoji: '😓', label: 'Tough' },
  3: { emoji: '😊', label: 'Solid' },
  4: { emoji: '💪', label: 'Strong' },
  5: { emoji: '🔥', label: 'Crushed it' },
};

interface CompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutName: string;
  onConfirm: (notes?: string, rating?: 1 | 2 | 3 | 4 | 5) => void;
  isLoading?: boolean;
}

export function CompletionDialog({
  open,
  onOpenChange,
  workoutName,
  onConfirm,
  isLoading = false,
}: CompletionDialogProps) {
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleConfirm = () => {
    setShowConfetti(true);
    onConfirm(notes.trim() || undefined, rating ?? undefined);
    setNotes('');
    setRating(null);
  };

  const handleCancel = () => {
    setNotes('');
    setRating(null);
    onOpenChange(false);
  };

  return (
    <>
    <Confetti show={showConfetti} onDone={() => setShowConfetti(false)} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Complete Workout
          </DialogTitle>
          <DialogDescription>
            Mark &quot;{workoutName}&quot; as completed
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>How did it feel? (optional)</Label>
            <div className="flex gap-2 justify-center">
              {([1, 2, 3, 4, 5] as const).map((value) => {
                const { emoji, label } = RATING_EMOJIS[value];
                const selected = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(rating === value ? null : value)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-3 rounded-xl transition-all duration-200 border ${
                      selected
                        ? 'bg-primary/10 border-primary/40 scale-110 shadow-sm'
                        : 'bg-muted/30 border-transparent hover:bg-muted/60 hover:scale-105'
                    }`}
                  >
                    <span className={`text-2xl transition-transform ${selected ? 'scale-110' : ''}`}>{emoji}</span>
                    <span className={`text-[10px] font-medium ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Share any notes about this workout..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Completing...' : 'Complete Workout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

interface UncompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function UncompletionDialog({
  open,
  onOpenChange,
  workoutName,
  onConfirm,
  isLoading = false,
}: UncompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark as Incomplete?</DialogTitle>
          <DialogDescription>
            Are you sure you want to mark &quot;{workoutName}&quot; as incomplete? This will remove the completion status and any notes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Mark Incomplete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

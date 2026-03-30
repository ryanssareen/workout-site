'use client';

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { PRCard } from './PRCard';
import { MilestoneCard } from './MilestoneCard';
import { Share2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AchievementResult } from '@/types/achievements';

interface CelebrationModalProps {
  achievements: AchievementResult;
  open: boolean;
  onClose: () => void;
  userName?: string;
}

export function CelebrationModal({ achievements, open, onClose, userName }: CelebrationModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showShare, setShowShare] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { newPRs, newMilestones } = achievements;
  const totalItems = newPRs.length + newMilestones.length;
  if (totalItems === 0) return null;

  const now = new Date();

  const currentIsPR = currentIndex < newPRs.length;
  const currentPR = currentIsPR ? newPRs[currentIndex] : null;
  const currentMilestone = !currentIsPR ? newMilestones[currentIndex - newPRs.length] : null;

  const shareTitle = currentIsPR
    ? `New PR: ${currentPR!.name}`
    : `Milestone: ${currentMilestone!.name}`;

  const shareText = currentIsPR
    ? `Just hit a new personal record! ${currentPR!.name}: ${currentPR!.value} ${currentPR!.unit}${currentPR!.improvement ? ` (${currentPR!.improvement})` : ''}`
    : `Achievement unlocked! ${currentMilestone!.name} - ${currentMilestone!.description}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              {totalItems > 1 ? `Achievement ${currentIndex + 1} of ${totalItems}` : 'Achievement Unlocked!'}
            </DialogTitle>
            <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Card */}
          <div ref={cardRef}>
            {currentIsPR && currentPR ? (
              <PRCard pr={currentPR} date={now} userName={userName} />
            ) : currentMilestone ? (
              <MilestoneCard milestone={currentMilestone} date={now} userName={userName} />
            ) : null}
          </div>

          {/* Navigation (multiple achievements) */}
          {totalItems > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous achievement"
                className="h-8 w-8"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalItems }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next achievement"
                className="h-8 w-8"
                disabled={currentIndex === totalItems - 1}
                onClick={() => setCurrentIndex(i => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Actions */}
          {showShare ? (
            <ShareButtons
              title="Share Achievement"
              shareText={shareText}
              shareUrl={typeof window !== 'undefined' ? window.location.href : ''}
              fileName={`achievement-${Date.now()}`}
              cardRef={cardRef}
              onClose={() => setShowShare(false)}
              captureBg="#0a0a0f"
            />
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setShowShare(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { PRCard } from './PRCard';
import { MilestoneCard } from './MilestoneCard';
import { Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AchievementResult } from '@/types/achievements';

interface CelebrationModalProps {
  achievements: AchievementResult;
  open: boolean;
  onClose: () => void;
  userName?: string;
}

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 2;
        const size = 4 + Math.random() * 6;
        const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899'];
        const color = colors[i % colors.length];
        const rotation = Math.random() * 360;
        const drift = -30 + Math.random() * 60;

        return (
          <div
            key={i}
            className="absolute -top-3 animate-confetti-fall"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              '--drift': `${drift}px`,
            } as React.CSSProperties}
          >
            <div
              className="animate-confetti-spin"
              style={{
                width: size,
                height: size * 0.6,
                backgroundColor: color,
                borderRadius: size > 7 ? '50%' : '1px',
                transform: `rotate(${rotation}deg)`,
                animationDuration: `${0.5 + Math.random()}s`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function CelebrationModal({ achievements, open, onClose, userName }: CelebrationModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showShare, setShowShare] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const { newPRs, newMilestones } = achievements;
  const totalItems = newPRs.length + newMilestones.length;

  useEffect(() => {
    if (open && totalItems > 0) {
      setCurrentIndex(0);
      setShowShare(false);
      requestAnimationFrame(() => {
        setEntered(true);
        setShowConfetti(true);
      });
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setEntered(false);
      setShowConfetti(false);
    }
  }, [open, totalItems]);

  if (!open || totalItems === 0) return null;

  const currentIsPR = currentIndex < newPRs.length;
  const currentPR = currentIsPR ? newPRs[currentIndex] : null;
  const currentMilestone = !currentIsPR ? newMilestones[currentIndex - newPRs.length] : null;

  const shareText = currentIsPR
    ? `Just hit a new personal record! ${currentPR!.name}: ${currentPR!.value} ${currentPR!.unit}${currentPR!.improvement ? ` (${currentPR!.improvement})` : ''}`
    : `Achievement unlocked! ${currentMilestone!.name} - ${currentMilestone!.description}`;

  const handleClose = () => {
    setEntered(false);
    setTimeout(onClose, 200);
  };

  return (
    <>
      {showConfetti && <Confetti />}

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
          entered ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/0'
        }`}
        onClick={handleClose}
      >
        {/* Radial glow behind card */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${entered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
        </div>

        {/* Card container */}
        <div
          className={`relative w-full max-w-md transition-all duration-500 ease-out ${
            entered ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-8'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Achievement counter badge */}
          {totalItems > 1 && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
              {currentIndex + 1} of {totalItems}
            </div>
          )}

          {/* The card */}
          <div ref={cardRef}>
            {currentIsPR && currentPR ? (
              <PRCard pr={currentPR} date={new Date()} userName={userName} />
            ) : currentMilestone ? (
              <MilestoneCard milestone={currentMilestone} date={new Date()} userName={userName} />
            ) : null}
          </div>

          {/* Navigation */}
          {totalItems > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 rounded-full bg-white/10 border-0 text-white hover:bg-white/20"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalItems }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 rounded-full bg-white/10 border-0 text-white hover:bg-white/20"
                disabled={currentIndex === totalItems - 1}
                onClick={() => setCurrentIndex(i => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4">
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
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowShare(true)}
                  className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1 h-11 bg-white text-black hover:bg-white/90 border-0 font-semibold"
                >
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

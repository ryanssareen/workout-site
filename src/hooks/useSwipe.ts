import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

/**
 * Hook for swipe gesture detection.
 * Works on touch (phone/tablet) and mouse drag (desktop/laptop).
 * @param onSwipeLeft  - called when user swipes left (go next)
 * @param onSwipeRight - called when user swipes right (go prev)
 * @param threshold    - minimum px to count as swipe (default 50)
 */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
): SwipeHandlers {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const handleStart = useCallback((x: number, y: number) => {
    startX.current = x;
    startY.current = y;
  }, []);

  const handleEnd = useCallback((x: number, y: number) => {
    if (startX.current === null || startY.current === null) return;
    const dx = x - startX.current;
    const dy = y - startY.current;
    // Only trigger if horizontal movement > vertical (not a scroll)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    startX.current = null;
    startY.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: useCallback((e: React.TouchEvent) => {
      const t = e.touches[0];
      handleStart(t.clientX, t.clientY);
    }, [handleStart]),
    onTouchEnd: useCallback((e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      handleEnd(t.clientX, t.clientY);
    }, [handleEnd]),
    onMouseDown: useCallback((e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    }, [handleStart]),
    onMouseUp: useCallback((e: React.MouseEvent) => {
      handleEnd(e.clientX, e.clientY);
    }, [handleEnd]),
  };
}

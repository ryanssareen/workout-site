'use client';

import { useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkoutPhotosProps {
  photos: string[];
  className?: string;
  /** Show as compact thumbnails (for WorkoutCard) */
  compact?: boolean;
}

export function WorkoutPhotos({ photos, className, compact = false }: WorkoutPhotosProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  if (compact) {
    return (
      <div className={cn('flex gap-1.5 overflow-x-auto', className)}>
        {photos.slice(0, 3).map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Workout photo ${i + 1}`}
            className="h-16 w-16 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
          />
        ))}
        {photos.length > 3 && (
          <div
            className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-muted/80 transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(3); }}
          >
            <span className="text-xs font-medium text-muted-foreground">+{photos.length - 3}</span>
          </div>
        )}
        {lightboxIndex !== null && (
          <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-semibold flex items-center gap-2">
        <Camera className="h-4 w-4 text-orange-500" />
        Photos ({photos.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Workout photo ${i + 1}`}
            className="w-full aspect-square rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
      )}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 text-white/80 hover:text-white z-10"
        onClick={onClose}
      >
        <X className="h-8 w-8" />
      </button>

      {photos.length > 1 && index > 0 && (
        <button
          className="absolute left-4 text-white/80 hover:text-white z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
        >
          <ChevronLeft className="h-10 w-10" />
        </button>
      )}

      <img
        src={photos[index]}
        alt={`Photo ${index + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && index < photos.length - 1 && (
        <button
          className="absolute right-4 text-white/80 hover:text-white z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
        >
          <ChevronRight className="h-10 w-10" />
        </button>
      )}

      <div className="absolute bottom-4 text-white/60 text-sm">
        {index + 1} / {photos.length}
      </div>
    </div>
  );
}

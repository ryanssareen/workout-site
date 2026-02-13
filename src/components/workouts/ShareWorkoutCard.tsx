'use client';

import { useRef, useState, useCallback } from 'react';
import { Workout } from '@/types';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import {
  Share2, Download, MessageCircle, Twitter, Send, Copy, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareWorkoutCardProps {
  workout: Workout;
}

export function ShareWorkoutCard({ workout }: ShareWorkoutCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const workoutDate = workout.date?.toDate
    ? format(workout.date.toDate(), 'MMM d, yyyy')
    : '';

  const distance = workout.actualStats?.distance
    ? (workout.actualStats.distance / 1000).toFixed(1)
    : workout.stravaData?.distance
      ? (workout.stravaData.distance / 1000).toFixed(1)
      : null;

  const duration = workout.duration
    || (workout.actualStats?.duration ? Math.round(workout.actualStats.duration / 60) : null);

  const elevation = workout.actualStats?.elevationGain || workout.stravaData?.elevationGain;

  // Compute pace from distance/duration (min/km)
  const paceValue = (() => {
    const dist = workout.actualStats?.distance || workout.stravaData?.distance;
    const dur = workout.actualStats?.duration || (workout.duration ? workout.duration * 60 : null);
    if (dist && dur && dist > 0) {
      const minPerKm = (dur / 60) / (dist / 1000);
      if (minPerKm > 0 && minPerKm < 30) {
        return `${Math.floor(minPerKm)}:${String(Math.round((minPerKm % 1) * 60)).padStart(2, '0')}`;
      }
    }
    return null;
  })();

  const aiComment = workout.routeData?.aiComment;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/workouts/${workout.id}`
    : '';

  const shareText = `🏋️ ${workout.name}${distance ? ` • ${distance} km` : ''}${duration ? ` • ${duration} min` : ''}${aiComment ? `\n${aiComment}` : ''}\n\nTracked on CoachTrack`;

  const generateImage = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate image:', err);
      toast.error('Failed to generate share image');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${workout.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.png`;
    link.href = dataUrl;
    link.click();
    toast.success('Image downloaded!');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');
  };

  const handleTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleIMessage = () => {
    window.open(`sms:&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');
  };

  const handleNativeShare = async () => {
    const dataUrl = await generateImage();
    if (navigator.share && dataUrl) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'workout.png', { type: 'image/png' });
        await navigator.share({ title: workout.name, text: shareText, files: [file] });
      } catch {
        // User cancelled or not supported, fall back to link share
        try {
          await navigator.share({ title: workout.name, text: shareText, url: shareUrl });
        } catch { /* cancelled */ }
      }
    } else if (navigator.share) {
      try {
        await navigator.share({ title: workout.name, text: shareText, url: shareUrl });
      } catch { /* cancelled */ }
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Share2 className="h-4 w-4" />
        Share Workout
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Share button row */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Share2 className="h-4 w-4 text-emerald-500" />
            Share This Workout
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGenerating} className="gap-2">
            <Download className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Save Image'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp} className="gap-2 hover:bg-green-500/10 hover:border-green-500/30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={handleTwitter} className="gap-2 hover:bg-sky-500/10 hover:border-sky-500/30">
            <Twitter className="h-4 w-4" />
            Twitter
          </Button>
          <Button variant="outline" size="sm" onClick={handleIMessage} className="gap-2 hover:bg-blue-500/10 hover:border-blue-500/30">
            <MessageCircle className="h-4 w-4" />
            iMessage
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="outline" size="sm" onClick={handleNativeShare} className="gap-2">
              <Send className="h-4 w-4" />
              More...
            </Button>
          )}
        </div>
      </div>

      {/* Preview card — this is what gets exported as image */}
      <div className="rounded-xl border overflow-hidden">
        <p className="text-xs text-muted-foreground px-4 py-2 bg-muted/30">Preview — this is what your friends will see</p>
        <div
          ref={cardRef}
          className="p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950"
          style={{ width: '100%', minHeight: 200 }}
        >
          {/* Brand */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">CT</span>
              </div>
              <span className="text-gray-400 text-sm font-medium">CoachTrack</span>
            </div>
            <span className="text-gray-500 text-xs">{workoutDate}</span>
          </div>

          {/* Workout name */}
          <h2 className="text-2xl font-bold text-white mb-1">{workout.name}</h2>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-sm text-emerald-400 font-medium capitalize">{workout.type}</span>
            {workout.completed && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">✓ Completed</span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {distance && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Distance</p>
                <p className="text-white text-xl font-bold">{distance} <span className="text-sm font-normal text-gray-400">km</span></p>
              </div>
            )}
            {duration && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Duration</p>
                <p className="text-white text-xl font-bold">{duration} <span className="text-sm font-normal text-gray-400">min</span></p>
              </div>
            )}
            {paceValue && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Pace</p>
                <p className="text-white text-xl font-bold">{paceValue} <span className="text-sm font-normal text-gray-400">/km</span></p>
              </div>
            )}
            {elevation && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Elevation</p>
                <p className="text-white text-xl font-bold">{Math.round(elevation)} <span className="text-sm font-normal text-gray-400">m</span></p>
              </div>
            )}
          </div>

          {/* AI Comment */}
          {aiComment && (
            <div className="bg-white/5 rounded-lg px-4 py-3 border border-white/10">
              <p className="text-white/90 text-sm">🤖 {aiComment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

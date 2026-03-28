'use client';

import { useRef, useState, useCallback } from 'react';
import { toJpeg } from 'html-to-image';
import { format } from 'date-fns';
import { Share2, Download, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { track } from '@/lib/posthog';

// ── Brand SVG Icons ──

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IMessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.54 1.33 4.826 3.444 6.385C5.18 18.18 4.544 20.2 2.5 21.5c2.534 0 4.845-1.3 6.137-2.452A11.5 11.5 0 0012 19.5c5.523 0 10-3.813 10-8.5S17.523 2 12 2z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

// ── Share Buttons Component (reusable) ──

interface ShareButtonsProps {
  title: string;
  shareText: string;
  shareUrl: string;
  fileName: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  /** Override the background color for the captured image. Defaults to '#0a0a0a'. */
  captureBg?: string;
  /** Override the capture width in px. Defaults to 520. */
  captureW?: number;
  /** Source page for analytics (e.g. 'wrap', 'review', 'wrapped', 'workout'). */
  source?: string;
}

function ShareButtons({ title, shareText, shareUrl: _shareUrl, fileName, cardRef, onClose, captureBg, captureW, source }: ShareButtonsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateImage = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setIsGenerating(true);

    // Hide cross-origin images before capture to prevent CORS errors
    const imgs = cardRef.current.querySelectorAll('img');
    const hidden: { el: HTMLImageElement; display: string }[] = [];
    imgs.forEach((img) => {
      const src = img.src || '';
      if (src && !src.startsWith('data:') && !src.startsWith(window.location.origin) && !src.startsWith('blob:')) {
        hidden.push({ el: img, display: img.style.display });
        img.style.display = 'none';
      }
    });

    // Force a fixed width so responsive grids render fully (prevents cut-off)
    const el = cardRef.current;
    const prevWidth = el.style.width;
    const prevMaxWidth = el.style.maxWidth;
    const captureWidth = captureW || 520;
    el.style.width = `${captureWidth}px`;
    el.style.maxWidth = `${captureWidth}px`;

    try {
      const result = await toJpeg(el, {
        quality: 0.92,
        pixelRatio: 2,
        width: captureWidth,
        cacheBust: true,
        backgroundColor: captureBg || '#0a0a0a',
      });
      return result;
    } catch (err) {
      console.error('Failed to generate image:', err);
      toast.error('Failed to generate share image');
      return null;
    } finally {
      // Restore width and hidden images
      el.style.width = prevWidth;
      el.style.maxWidth = prevMaxWidth;
      hidden.forEach(({ el: img, display }) => { img.style.display = display; });
      setIsGenerating(false);
    }
  }, [cardRef, captureBg, captureW]);

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${fileName}-${format(new Date(), 'yyyy-MM-dd')}.jpg`;
    link.href = dataUrl;
    link.click();
    track('report_shared', { platform: 'download', source });
    toast.success('Image downloaded!');
  };

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    track('report_shared', { platform: 'copy_caption', source });
    toast.success('Caption copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Native share with image only on mobile (desktop triggers generic macOS share sheet)
    if (isMobile) {
      const dataUrl = await generateImage();
      if (dataUrl) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: shareText });
            track('report_shared', { platform: 'whatsapp', source });
            return;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
    } else {
      // Desktop: save image + copy caption
      const dataUrl = await generateImage();
      if (dataUrl) {
        const dl = document.createElement('a');
        dl.download = `${fileName}.jpg`;
        dl.href = dataUrl;
        dl.click();
        try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
        toast.success('Image saved! Caption copied — paste in WhatsApp');
      }
    }
    track('report_shared', { platform: 'whatsapp', source });
    // window.open avoids macOS system share sheet, opens WhatsApp Web directly
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
  };

  const handleTwitter = async () => {
    // Download image + copy caption (Twitter intent doesn't support image uploads)
    const dataUrl = await generateImage();
    if (dataUrl) {
      const dl = document.createElement('a');
      dl.download = `${fileName}.jpg`;
      dl.href = dataUrl;
      dl.click();
      try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
      toast.success('Image saved! Attach it to your post');
    }
    track('report_shared', { platform: 'x', source });
    window.open('https://twitter.com/compose/tweet', '_blank');
  };

  const handleInstagramStory = async () => {
    // Save image + copy caption in background
    const dataUrl = await generateImage();
    if (dataUrl) {
      const dl = document.createElement('a');
      dl.download = `${fileName}.jpg`;
      dl.href = dataUrl;
      dl.click();
    }
    try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
    track('report_shared', { platform: 'instagram_story', source });

    // Open Instagram — app on mobile, website on desktop
    window.location.href = 'https://www.instagram.com/';
  };

  const handleIMessageShare = async () => {
    // Try sharing the image via native share (works great on iOS for iMessage)
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    // Fallback to sms: link — use location.href so the OS handles the protocol
    track('report_shared', { platform: 'imessage', source });
    window.location.href = `sms:&body=${encodeURIComponent(shareText)}`;
  };

  return (
    <div className="rounded-2xl border bg-card shadow-2xl shadow-black/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <h3 className="font-bold text-lg flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-red-500/15">
            <Share2 className="h-4 w-4 text-red-500" />
          </div>
          {title}
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Share targets — big icon buttons */}
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Share to</p>
        <div className="grid grid-cols-4 gap-2">
          {/* Instagram Story */}
          <button onClick={handleInstagramStory} disabled={isGenerating}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-orange-500/20 border border-pink-500/20 transition-all group">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/30 group-hover:scale-110 transition-transform">
              <InstagramIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-medium">Story</span>
          </button>
          {/* WhatsApp */}
          <button onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 transition-all group">
            <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30 group-hover:scale-110 transition-transform">
              <WhatsAppIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-medium">WhatsApp</span>
          </button>
          {/* X / Twitter */}
          <button onClick={handleTwitter}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-all group">
            <div className="w-11 h-11 rounded-full bg-foreground flex items-center justify-center shadow-lg shadow-foreground/20 group-hover:scale-110 transition-transform">
              <XIcon className="h-4.5 w-4.5 text-background" />
            </div>
            <span className="text-[10px] font-medium">X</span>
          </button>
          {/* iMessage */}
          <button onClick={handleIMessageShare}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#34C759]/10 hover:bg-[#34C759]/20 border border-[#34C759]/20 transition-all group">
            <div className="w-11 h-11 rounded-full bg-[#34C759] flex items-center justify-center shadow-lg shadow-[#34C759]/30 group-hover:scale-110 transition-transform">
              <IMessageIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-medium">iMessage</span>
          </button>
        </div>

        {/* Action buttons row */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleDownload} disabled={isGenerating}
            className="flex-1 gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border-0">
            <Download className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Save Image'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyCaption} className="flex-1 gap-2">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Caption'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ShareButtons };

// ══════════════════════════════════════════
// Workout Share Card
// ══════════════════════════════════════════

import { Workout } from '@/types';

function safeToDate(w: { date?: any }): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

interface ShareWorkoutCardProps {
  workout: Workout;
}

export function ShareWorkoutCard({ workout }: ShareWorkoutCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const workoutDate = format(safeToDate(workout), 'MMM d, yyyy');

  const distance = workout.actualStats?.distance
    ? (workout.actualStats.distance / 1000).toFixed(1)
    : workout.stravaData?.distance
      ? (workout.stravaData.distance / 1000).toFixed(1)
      : null;

  const duration = workout.duration
    || (workout.actualStats?.duration ? Math.round(workout.actualStats.duration / 60) : null);

  const elevation = workout.actualStats?.elevationGain || workout.stravaData?.elevationGain;

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
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/preview/${workout.ownerUsername}/${workout.id}` : '';
  const shareText = `🏋️ ${workout.name}${distance ? ` • ${distance} km` : ''}${duration ? ` • ${duration} min` : ''}${aiComment ? `\n${aiComment}` : ''}\n\nTracked on The Daily Athlete`;

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Share2 className="h-4 w-4" />
        Share Workout
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <ShareButtons
        title="Share This Workout"
        shareText={shareText}
        shareUrl={shareUrl}
        fileName={workout.name.replace(/\s+/g, '-').toLowerCase()}
        cardRef={cardRef}
        onClose={() => setIsOpen(false)}
      />

      {/* Preview card — exported as image */}
      <div className="rounded-xl border overflow-hidden">
        <p className="text-xs text-muted-foreground px-4 py-2 bg-muted/30">Preview — this is what your friends will see</p>
        <div ref={cardRef} className="p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-red-950" style={{ width: '100%', minHeight: 200 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">CT</span>
              </div>
              <span className="text-gray-400 text-sm font-medium">CoachTrack</span>
            </div>
            <span className="text-gray-500 text-xs">{workoutDate}</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">{workout.name}</h2>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-sm text-red-400 font-medium capitalize">{workout.type}</span>
            {workout.completed && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">✓ Completed</span>
            )}
          </div>

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

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData, SPORT_OPTIONS, TRAINING_FOR_OPTIONS } from '@/lib/schemas/profile';
import { User } from '@/types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Save,
  Pencil,
  Bell,
  Camera,
  CheckCircle2,
  Dumbbell,
  Target,
  Mail,
  Clock,
  ImagePlus,
  Flag,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const ROLE_DISPLAY: Record<string, string> = {
  student: 'Athlete',
  athlete: 'Athlete',
  coach: 'Coach',
};

function getDefaultValues(user: User | null): ProfileFormData {
  return {
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    sportPreferences: user?.sportPreferences || [],
    trainingFor: user?.trainingFor || [],
    notificationPreferences: user?.notificationPreferences || {
      emailSummary: true,
      workoutReminders: true,
      coachMessages: true,
    },
  };
}

function calculateCompletion(data: ProfileFormData & { photoURL?: string }) {
  let score = 0;
  if (data.displayName) score += 20;
  if (data.photoURL) score += 10;
  if (data.bio) score += 15;
  if (data.timezone) score += 15;
  if (data.sportPreferences && data.sportPreferences.length > 0) score += 15;
  if (data.trainingFor && data.trainingFor.length > 0) score += 15;
  if (data.notificationPreferences) score += 10;
  return score;
}

function formatTimezone(timezone?: string) {
  if (!timezone) return 'Not set';
  return timezone.replace(/_/g, ' ');
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ── Circular progress ring ─────────────────────────────────────────── */
function ProgressRing({ percent, size = 120, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/50" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#progressGradient)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Profile Pic Uploader ───────────────────────────────────────────── */
function ProfilePicUploader({ currentPhotoURL, userId, onUploadComplete }: { currentPhotoURL?: string; userId: string; onUploadComplete: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) { toast.error('Please use a JPEG, PNG, WebP, or GIF image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uid', userId);
      const res = await fetch('/api/upload-profile-pic', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onUploadComplete(data.photoURL);
      toast.success('Profile picture updated!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      setPreview(null);
    } finally { setUploading(false); }
  }, [userId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }, [handleFile]);
  const displayUrl = preview || currentPhotoURL;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn('relative group cursor-pointer rounded-full transition-all duration-200', dragOver && 'ring-4 ring-primary/40 scale-105')} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
        <Avatar className="w-28 h-28 border-4 border-background shadow-xl">
          {displayUrl ? <AvatarImage src={displayUrl} alt="Profile" /> : null}
          <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary/20 to-orange-500/20 text-primary"><ImagePlus className="w-8 h-8" /></AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
      </div>
      <div className="text-center">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors" disabled={uploading}>
          {uploading ? 'Uploading...' : displayUrl ? 'Change photo' : 'Upload photo'}
        </button>
        <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP or GIF · Max 5MB</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PROFILE PAGE
   ══════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [editOpen, setEditOpen] = useState(false);
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: getDefaultValues(user),
  });

  useEffect(() => { reset(getDefaultValues(user)); }, [user, reset]);

  useEffect(() => {
    if (autoOpenHandled) return;
    if (searchParams.get('edit') === '1') { setEditOpen(true); setAutoOpenHandled(true); router.replace('/profile'); }
  }, [searchParams, autoOpenHandled, router]);

  const sportPreferences = watch('sportPreferences') || [];
  const trainingFor = watch('trainingFor') || [];
  const notificationPrefs = watch('notificationPreferences') || { emailSummary: true, workoutReminders: true, coachMessages: true };

  const toggleArrayItem = (field: 'sportPreferences' | 'trainingFor', item: string) => {
    const current = field === 'sportPreferences' ? sportPreferences : trainingFor;
    const updated = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    setValue(field, updated, { shouldDirty: true });
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    if (data.displayName !== user.displayName) {
      setCheckingName(true);
      try {
        const res = await fetch('/api/ai/profanity-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: data.displayName }) });
        const check = await res.json();
        if (!check.isClean) { toast.error(check.reason || 'Please choose an appropriate name'); setCheckingName(false); return; }
      } catch { /* allow through */ }
      setCheckingName(false);
    }

    setSaving(true);
    try {
      const profileCompleted = calculateCompletion({ ...data, photoURL: user.photoURL });
      await updateDoc(doc(getDbInstance(), 'users', user.uid), {
        displayName: data.displayName,
        bio: data.bio || null,
        timezone: data.timezone || null,
        sportPreferences: data.sportPreferences || [],
        trainingFor: data.trainingFor || [],
        notificationPreferences: data.notificationPreferences || null,
        profileCompleted,
        updatedAt: serverTimestamp(),
      });

      setUser({
        ...user,
        displayName: data.displayName,
        bio: data.bio,
        timezone: data.timezone,
        sportPreferences: data.sportPreferences,
        trainingFor: data.trainingFor,
        notificationPreferences: data.notificationPreferences,
        profileCompleted,
      });

      toast.success('Profile updated!');
      setEditOpen(false);
    } catch { toast.error('Failed to save profile'); }
    finally { setSaving(false); }
  };

  const handleProfilePicUploaded = (photoURL: string) => { if (!user) return; setUser({ ...user, photoURL }); };
  const handleDialogOpenChange = (open: boolean) => { setEditOpen(open); if (!open) reset(getDefaultValues(user)); };

  if (!user) return null;

  const isLoading = saving || checkingName;
  const profileCompletion = user.profileCompleted ?? calculateCompletion({ ...getDefaultValues(user), photoURL: user.photoURL });
  const completionItems = [
    { label: 'Name', done: !!user.displayName },
    { label: 'Photo', done: !!user.photoURL },
    { label: 'Bio', done: !!user.bio },
    { label: 'Timezone', done: !!user.timezone },
    { label: 'Sports', done: (user.sportPreferences?.length ?? 0) > 0 },
    { label: 'Training', done: (user.trainingFor?.length ?? 0) > 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-orange-500/5 to-rose-500/5 border border-border/50">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative px-6 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <div className="relative shrink-0">
              <ProgressRing percent={profileCompletion} size={140} stroke={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar className="w-[116px] h-[116px] border-4 border-background shadow-xl">
                  {user.photoURL ? <AvatarImage src={user.photoURL} alt={user.displayName} /> : null}
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary/20 to-orange-500/20 text-primary">
                    {user.displayName ? getInitials(user.displayName) : '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-3 py-1 shadow-md">
                <span className="text-xs font-bold tabular-nums">{profileCompletion}%</span>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight truncate">{user.displayName || 'Your Profile'}</h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</span>
                  {user.timezone && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatTimezone(user.timezone)}</span>}
                  <Badge variant="secondary" className="text-xs">{ROLE_DISPLAY[user.role] || user.role}</Badge>
                </div>
              </div>
              {user.bio && <p className="text-muted-foreground text-sm max-w-lg whitespace-pre-wrap leading-relaxed">{user.bio}</p>}
              <Button onClick={() => setEditOpen(true)} size="sm" className="mt-2"><Pencil className="mr-2 h-3.5 w-3.5" />Edit Profile</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── COMPLETION CHECKLIST ──────────────────────────────────── */}
      {profileCompletion < 100 && (
        <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
          <CardContent className="py-4 px-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Complete your profile</p>
              <button onClick={() => setEditOpen(true)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Fill in →</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {completionItems.map(({ label, done }) => (
                <span key={label} className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors', done ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current opacity-40" />}
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── INFO CARDS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10"><Dumbbell className="h-4 w-4 text-blue-500" /></div>
              Sports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.sportPreferences && user.sportPreferences.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">{user.sportPreferences.map((sport) => <Badge key={sport} variant="secondary" className="font-normal">{sport}</Badge>)}</div>
            ) : <p className="text-sm text-muted-foreground italic">No sports selected</p>}
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10"><Flag className="h-4 w-4 text-amber-500" /></div>
              Training For
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.trainingFor && user.trainingFor.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">{user.trainingFor.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}</div>
            ) : <p className="text-sm text-muted-foreground italic">Not set yet</p>}
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/10"><Bell className="h-4 w-4 text-violet-500" /></div>
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {[
                { label: 'Weekly Summary', on: user.notificationPreferences?.emailSummary !== false },
                { label: 'Workout Reminders', on: user.notificationPreferences?.workoutReminders !== false },
                { label: 'Coach Messages', on: user.notificationPreferences?.coachMessages !== false },
              ].map(({ label, on }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', on ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                  <span className={cn(on ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════
         EDIT PROFILE DIALOG
         ══════════════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Build Your Profile</DialogTitle>
            <DialogDescription>Add your details so your coach and teammates know who you are.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-center pt-2">
              <ProfilePicUploader currentPhotoURL={user.photoURL} userId={user.uid} onUploadComplete={handleProfilePicUploaded} />
            </div>

            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input id="displayName" {...register('displayName')} maxLength={50} />
                  {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" {...register('bio')} placeholder="Tell us about yourself and your training..." maxLength={300} rows={3} />
                  <div className="flex justify-between">
                    {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
                    <p className="text-xs text-muted-foreground ml-auto tabular-nums">{(watch('bio') || '').length}/300</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={watch('timezone') || ''} onValueChange={(val) => setValue('timezone', val, { shouldDirty: true })}>
                    <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{formatTimezone(tz)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Sport Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pick Your Sport</CardTitle>
                <CardDescription>Select the sports you do</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {SPORT_OPTIONS.map((sport) => (
                    <Badge
                      key={sport}
                      variant={sportPreferences.includes(sport) ? 'default' : 'outline'}
                      className={cn('cursor-pointer transition-all duration-150 px-3 py-1.5', sportPreferences.includes(sport) ? 'bg-primary hover:bg-primary/90 shadow-sm' : 'hover:border-primary/50 hover:text-primary')}
                      onClick={() => toggleArrayItem('sportPreferences', sport)}
                    >{sport}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Training For */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What Are You Training For?</CardTitle>
                <CardDescription>Select any events or goals you&apos;re working towards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {TRAINING_FOR_OPTIONS.map((item) => (
                    <Badge
                      key={item}
                      variant={trainingFor.includes(item) ? 'default' : 'outline'}
                      className={cn('cursor-pointer transition-all duration-150 px-3 py-1.5', trainingFor.includes(item) ? 'bg-primary hover:bg-primary/90 shadow-sm' : 'hover:border-primary/50 hover:text-primary')}
                      onClick={() => toggleArrayItem('trainingFor', item)}
                    >{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notifications</CardTitle>
                <CardDescription>Choose what updates you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: 'emailSummary' as const, label: 'Weekly Email Summary', desc: 'Receive a weekly recap of your training' },
                  { key: 'workoutReminders' as const, label: 'Workout Reminders', desc: 'Get reminded about upcoming workouts' },
                  { key: 'coachMessages' as const, label: 'Coach Messages', desc: 'Notifications when your coach comments' },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                    <Switch checked={notificationPrefs[key]} onCheckedChange={(checked) => setValue('notificationPreferences', { ...notificationPrefs, [key]: checked }, { shouldDirty: true })} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button type="submit" disabled={isLoading || !isDirty} className="w-full">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{checkingName ? 'Checking...' : 'Saving...'}</> : <><Save className="mr-2 h-4 w-4" />Save Profile</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

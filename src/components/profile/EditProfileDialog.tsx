'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Save, Check } from 'lucide-react';
import { PhotoUpload } from '@/components/profile/PhotoUpload';
import {
  SPORT_OPTIONS,
  TRAINING_FOR_OPTIONS,
  AGE_RANGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from '@/lib/schemas/profile';
import { cn } from '@/lib/utils';
import type { User as UserType } from '@/types';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditProfileDialog({ open, onOpenChange, onSaved }: EditProfileDialogProps) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [timezone, setTimezone] = useState(user?.timezone || '');
  const [ageRange, setAgeRange] = useState(user?.ageRange || '');
  const [experienceLevel, setExperienceLevel] = useState(user?.experienceLevel || '');
  const [height, setHeight] = useState<string>(user?.height ? String(user.height) : '');
  const [heightUnit, setHeightUnit] = useState(user?.heightUnit || 'cm');
  const [weight, setWeight] = useState<string>(user?.weight ? String(user.weight) : '');
  const [weightUnit, setWeightUnit] = useState(user?.weightUnit || 'kg');
  const [sportPreferences, setSportPreferences] = useState<string[]>(user?.sportPreferences || []);
  const [trainingFor, setTrainingFor] = useState<string[]>(user?.trainingFor || []);
  const [events, setEvents] = useState<Array<{ goal: string; eventName: string; eventDate?: string }>>(user?.events || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setTimezone(user.timezone || '');
      setAgeRange(user.ageRange || '');
      setExperienceLevel(user.experienceLevel || '');
      setHeight(user.height ? String(user.height) : '');
      setHeightUnit(user.heightUnit || 'cm');
      setWeight(user.weight ? String(user.weight) : '');
      setWeightUnit(user.weightUnit || 'kg');
      setSportPreferences(user.sportPreferences || []);
      setTrainingFor(user.trainingFor || []);
      setEvents(user.events || []);
    }
  }, [open, user]);

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const toggleSport = (sport: string) => setSportPreferences(prev => toggleArrayItem(prev, sport));

  const toggleGoal = (goal: string) => {
    setTrainingFor(prev => {
      if (prev.includes(goal)) {
        setEvents(evts => evts.filter(e => e.goal !== goal));
        return prev.filter(g => g !== goal);
      } else {
        setEvents(evts => [...evts, { goal, eventName: '', eventDate: '' }]);
        return [...prev, goal];
      }
    });
  };

  const updateEvent = (goal: string, field: 'eventName' | 'eventDate', value: string) => {
    setEvents(evts => evts.map(e => e.goal === goal ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!displayName.trim() || displayName.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    setIsSaving(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { getDbInstance } = await import('@/lib/firebase/config');
      const updates: Record<string, unknown> = {
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        timezone: timezone || null,
        ageRange: ageRange || null,
        experienceLevel: experienceLevel || null,
        height: height ? parseFloat(height) : null,
        heightUnit,
        weight: weight ? parseFloat(weight) : null,
        weightUnit,
        sportPreferences,
        trainingFor,
        events: events.filter(e => trainingFor.includes(e.goal)),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(getDbInstance(), 'users', user.username), updates);
      setUser({
        ...user,
        ...updates,
        updatedAt: new Date() as unknown,
      } as UserType);
      toast.success('Profile updated!');
      onOpenChange(false);
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      toast.error(message);
    }
    setIsSaving(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal information and training preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <PhotoUpload user={user} size={80} />
            <div className="flex-1 w-full space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-displayName" className="text-xs">Display Name</Label>
                  <Input id="edit-displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Username</Label>
                  <Input value={`@${user.username}`} disabled className="opacity-60 font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-bio" className="text-xs">Bio</Label>
                  <span className={cn(
                    "text-xs",
                    300 - bio.length < 30 ? "text-orange-500" : "text-muted-foreground"
                  )}>
                    {300 - bio.length} remaining
                  </span>
                </div>
                <Textarea id="edit-bio" value={bio} onChange={e => setBio(e.target.value.slice(0, 300))} placeholder="Tell us about yourself..." rows={2} maxLength={300} />
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="border-t pt-6 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal Details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Age Range</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger><SelectValue placeholder="Select age range" /></SelectTrigger>
                  <SelectContent>
                    {AGE_RANGE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Experience Level</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVEL_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Height</Label>
                <div className="flex gap-2">
                  <Input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="Height" className="flex-1" />
                  <Select value={heightUnit} onValueChange={(v: 'cm' | 'ft') => setHeightUnit(v)}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="ft">ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weight</Label>
                <div className="flex gap-2">
                  <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Weight" className="flex-1" />
                  <Select value={weightUnit} onValueChange={(v: 'kg' | 'lbs') => setWeightUnit(v)}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Intl.supportedValuesOf('timeZone').filter(tz => tz.includes('/')).map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sports & Goals */}
          <div className="border-t pt-6 space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sports</p>
              <div className="flex flex-wrap gap-1.5">
                {SPORT_OPTIONS.map(sport => {
                  const selected = sportPreferences.includes(sport);
                  return (
                    <Badge
                      key={sport}
                      variant={selected ? 'default' : 'outline'}
                      className={cn(
                        "cursor-pointer text-xs transition-all gap-1",
                        selected && "shadow-sm"
                      )}
                      onClick={() => toggleSport(sport)}
                    >
                      {selected && <Check className="h-3 w-3" />}
                      {sport}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Training For</p>
              <div className="flex flex-wrap gap-1.5">
                {TRAINING_FOR_OPTIONS.map(goal => {
                  const selected = trainingFor.includes(goal);
                  return (
                    <Badge
                      key={goal}
                      variant={selected ? 'default' : 'outline'}
                      className={cn(
                        "cursor-pointer text-xs transition-all gap-1",
                        selected && "shadow-sm"
                      )}
                      onClick={() => toggleGoal(goal)}
                    >
                      {selected && <Check className="h-3 w-3" />}
                      {goal}
                    </Badge>
                  );
                })}
              </div>
              {events.filter(e => trainingFor.includes(e.goal)).length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">Event Details</p>
                  {events.filter(e => trainingFor.includes(e.goal)).map(evt => (
                    <div key={evt.goal} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-muted/30">
                      <span className="text-xs font-semibold text-foreground shrink-0 pt-1.5 min-w-[100px]">{evt.goal}</span>
                      <Input
                        placeholder="Event name (optional)"
                        value={evt.eventName}
                        onChange={e => updateEvent(evt.goal, 'eventName', e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        type="date"
                        value={evt.eventDate || ''}
                        onChange={e => updateEvent(evt.goal, 'eventDate', e.target.value)}
                        className="h-8 text-xs w-36"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-4 border-t">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

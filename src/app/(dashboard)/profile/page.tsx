'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData, SPORT_OPTIONS, FITNESS_GOAL_OPTIONS } from '@/lib/schemas/profile';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCircle, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [saving, setSaving] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      bio: user?.bio || '',
      timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      sportPreferences: user?.sportPreferences || [],
      fitnessGoals: user?.fitnessGoals || [],
      notificationPreferences: user?.notificationPreferences || {
        emailSummary: true,
        workoutReminders: true,
        coachMessages: true,
      },
    },
  });

  const sportPreferences = watch('sportPreferences') || [];
  const fitnessGoals = watch('fitnessGoals') || [];
  const notificationPrefs = watch('notificationPreferences');

  const toggleArrayItem = (field: 'sportPreferences' | 'fitnessGoals', item: string) => {
    const current = field === 'sportPreferences' ? sportPreferences : fitnessGoals;
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setValue(field, updated, { shouldDirty: true });
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    if (data.displayName !== user.displayName) {
      setCheckingName(true);
      try {
        const res = await fetch('/api/ai/profanity-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.displayName }),
        });
        const check = await res.json();
        if (!check.isClean) {
          toast.error(check.reason || 'Please choose an appropriate name');
          setCheckingName(false);
          return;
        }
      } catch {
        // Allow through if check fails
      }
      setCheckingName(false);
    }

    setSaving(true);
    try {
      const profileCompleted = calculateCompletion(data);
      const userRef = doc(getDbInstance(), 'users', user.uid);
      await updateDoc(userRef, {
        displayName: data.displayName,
        bio: data.bio || null,
        timezone: data.timezone || null,
        sportPreferences: data.sportPreferences || [],
        fitnessGoals: data.fitnessGoals || [],
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
        fitnessGoals: data.fitnessGoals,
        notificationPreferences: data.notificationPreferences,
        profileCompleted,
      });
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to save profile');
    }
    setSaving(false);
  };

  if (!user) return null;

  const isLoading = saving || checkingName;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
            <UserCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Personalize your experience</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" {...register('displayName')} maxLength={50} />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                {...register('bio')}
                placeholder="Tell us about yourself..."
                maxLength={300}
                rows={3}
              />
              {errors.bio && (
                <p className="text-sm text-destructive">{errors.bio.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={watch('timezone') || ''}
                onValueChange={(val) => setValue('timezone', val, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sport Preferences</CardTitle>
            <CardDescription>Select the sports you enjoy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SPORT_OPTIONS.map((sport) => (
                <Badge
                  key={sport}
                  variant={sportPreferences.includes(sport) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    sportPreferences.includes(sport) && 'bg-primary hover:bg-primary/90'
                  )}
                  onClick={() => toggleArrayItem('sportPreferences', sport)}
                >
                  {sport}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fitness Goals</CardTitle>
            <CardDescription>What are you working towards?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FITNESS_GOAL_OPTIONS.map((goal) => (
                <Badge
                  key={goal}
                  variant={fitnessGoals.includes(goal) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    fitnessGoals.includes(goal) && 'bg-primary hover:bg-primary/90'
                  )}
                  onClick={() => toggleArrayItem('fitnessGoals', goal)}
                >
                  {goal}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Choose what updates you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'emailSummary' as const, label: 'Weekly Email Summary', desc: 'Receive a weekly recap of your training' },
              { key: 'workoutReminders' as const, label: 'Workout Reminders', desc: 'Get reminded about upcoming workouts' },
              { key: 'coachMessages' as const, label: 'Coach Messages', desc: 'Notifications when your coach comments' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={notificationPrefs?.[key] ?? true}
                  onCheckedChange={(checked) => {
                    setValue(
                      'notificationPreferences',
                      { ...notificationPrefs!, [key]: checked },
                      { shouldDirty: true }
                    );
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={isLoading || !isDirty} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {checkingName ? 'Checking...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

function calculateCompletion(data: ProfileFormData & { photoURL?: string }) {
  let score = 0;
  if (data.displayName) score += 20;
  if (data.photoURL) score += 10;
  if (data.bio) score += 15;
  if (data.timezone) score += 15;
  if (data.sportPreferences && data.sportPreferences.length > 0) score += 15;
  if (data.fitnessGoals && data.fitnessGoals.length > 0) score += 15;
  if (data.notificationPreferences) score += 10;
  return score;
}

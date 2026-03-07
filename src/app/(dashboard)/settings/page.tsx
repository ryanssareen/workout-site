'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Unlink,
  Settings,
  LogOut,
  Key,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Globe,
  RefreshCw,
  Pencil,
  Save,
  Eye,
} from 'lucide-react';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';
import { StravaDuplicateDialog } from '@/components/strava/DuplicateDialog';
import { PhotoUpload } from '@/components/profile/PhotoUpload';
import {
  SPORT_OPTIONS,
  TRAINING_FOR_OPTIONS,
  AGE_RANGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from '@/lib/schemas/profile';
import { cn } from '@/lib/utils';
import { useStravaSyncStore } from '@/lib/stores/stravaSyncStore';
import type { User as UserType } from '@/types';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // ── Edit Profile state ──
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // ── Unsaved changes tracking ──
  const initialValues = useRef({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    timezone: user?.timezone || '',
    ageRange: user?.ageRange || '',
    experienceLevel: user?.experienceLevel || '',
    height: user?.height ? String(user.height) : '',
    weight: user?.weight ? String(user.weight) : '',
    sportPreferences: user?.sportPreferences || [],
    trainingFor: user?.trainingFor || [],
  });

  const hasUnsavedChanges = useMemo(() => {
    const iv = initialValues.current;
    return (
      displayName !== iv.displayName ||
      bio !== iv.bio ||
      timezone !== iv.timezone ||
      ageRange !== iv.ageRange ||
      experienceLevel !== iv.experienceLevel ||
      height !== iv.height ||
      weight !== iv.weight ||
      JSON.stringify(sportPreferences) !== JSON.stringify(iv.sportPreferences) ||
      JSON.stringify(trainingFor) !== JSON.stringify(iv.trainingFor)
    );
  }, [displayName, bio, timezone, ageRange, experienceLevel, height, weight, sportPreferences, trainingFor]);

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

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!displayName.trim() || displayName.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    setIsSavingProfile(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { getDbInstance } = await import('@/lib/firebase/config');
      const updates: Record<string, any> = {
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
        updatedAt: new Date() as any,
      } as UserType);
      // Reset initial values after save
      initialValues.current = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        timezone,
        ageRange,
        experienceLevel,
        height,
        weight,
        sportPreferences: [...sportPreferences],
        trainingFor: [...trainingFor],
      };
      toast.success('Profile updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    }
    setIsSavingProfile(false);
  };

  const [isConnectingStrava, setIsConnectingStrava] = useState(false);
  const [isDisconnectingStrava, setIsDisconnectingStrava] = useState(false);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [profilePublic, setProfilePublic] = useState(user?.profilePublic !== false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [regeneratingTagline, setRegeneratingTagline] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [stravaDuplicates, setStravaDuplicates] = useState<any[]>([]);

  // Global Strava sync store (survives navigation)
  const syncStatus = useStravaSyncStore((s) => s.status);
  const startSync = useStravaSyncStore((s) => s.startSync);
  const checkDuplicates = useStravaSyncStore((s) => s.checkDuplicates);

  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    const reason = searchParams.get('reason');
    // Only handle errors here — the StravaSyncTrigger in the layout handles ?strava=connected
    if (stravaStatus === 'error') {
      const messages: Record<string, string> = {
        denied: 'Strava authorization was denied. Please try again and click "Authorize" on the Strava page.',
        token_failed: 'Failed to exchange Strava token. Please try connecting again.',
        no_cookie: 'Session expired before Strava connected. Please try again.',
        exception: 'Something went wrong connecting to Strava. Please try again.',
      };
      toast.error(reason && messages[reason] ? messages[reason] : 'Failed to connect Strava. Please try again.');
      router.replace('/settings');
    }
  }, [searchParams, router]);

  const handleConnectStrava = () => { setIsConnectingStrava(true); window.location.href = `/api/auth/strava/authorize?userId=${user?.uid}`; };

  const handleDisconnectStrava = async () => {
    if (!user) return;
    setIsDisconnectingStrava(true);
    try {
      const response = await fetch('/api/auth/strava/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.username }) });
      if (!response.ok) throw new Error('Failed to disconnect');
      setUser({ ...user, stravaId: undefined, stravaAccessToken: undefined, stravaRefreshToken: undefined, stravaConnectedAt: undefined });
      toast.success('Strava disconnected');
    } catch (error: any) { toast.error(error.message || 'Failed to disconnect'); }
    setIsDisconnectingStrava(false);
  };

  const handleSyncStrava = async (decisions?: Record<string, { action: 'merge' | 'new'; workoutId?: string }>) => {
    if (!user) return;

    // With decisions (from duplicate dialog), go straight to sync via the global store
    if (decisions) {
      startSync(user.username, decisions);
      return;
    }

    // No decisions — check for duplicates first (local interactive flow)
    setIsSyncingStrava(true);
    try {
      const result = await checkDuplicates(user.username);
      if (result.hasDuplicates && result.duplicates?.length > 0) {
        setStravaDuplicates(result.duplicates);
        setShowDuplicateDialog(true);
        setIsSyncingStrava(false);
        return;
      }

      // No duplicates — kick off sync via the global store
      startSync(user.username);
    } catch (error: any) {
      if (error.message?.includes('reconnect')) {
        toast.error('Strava authorization expired', {
          description: 'Disconnect and reconnect your Strava account to fix this.',
        });
      } else {
        toast.error(error.message || 'Failed to sync with Strava');
      }
    }
    setIsSyncingStrava(false);
  };

  const handleDuplicateDecisions = (decisions: Record<string, { action: 'merge' | 'new'; workoutId?: string }>) => {
    setShowDuplicateDialog(false);
    handleSyncStrava(decisions);
  };

  const handleTogglePublicProfile = async (checked: boolean) => {
    if (!user) return;
    setProfilePublic(checked);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { getDbInstance } = await import('@/lib/firebase/config');
      await updateDoc(doc(getDbInstance(), 'users', user.username), { profilePublic: checked });
      setUser({ ...user, profilePublic: checked });
      toast.success(checked ? 'Profile is now public' : 'Profile is now private');
    } catch {
      setProfilePublic(!checked);
      toast.error('Failed to update profile visibility');
    }
  };

  const handleCopyProfileUrl = () => {
    if (!user) return;
    const url = `${window.location.origin}/athlete/${user.username}`;
    navigator.clipboard.writeText(url);
    setProfileCopied(true);
    toast.success('Profile link copied!');
    setTimeout(() => setProfileCopied(false), 2000);
  };

  const handleRegenerateTagline = async () => {
    if (!user) return;
    setRegeneratingTagline(true);
    try {
      const res = await fetch('/api/ai/profile-tagline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, force: true }),
      });
      const data = await res.json();
      if (data.tagline) {
        setUser({ ...user, profileTagline: data.tagline });
        toast.success('New tagline generated!');
      }
    } catch {
      toast.error('Failed to generate tagline');
    }
    setRegeneratingTagline(false);
  };

  const handleLogout = async () => { await signOut(); router.push('/login'); };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={cn("space-y-6 max-w-2xl mx-auto", hasUnsavedChanges ? "pb-24" : "pb-8")}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
          <Settings className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>
      </div>

      {/* ═══════════════════ Edit Profile ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" />Edit Profile</CardTitle>
          <CardDescription>Update your personal information and training preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Section 1: Profile Header ── */}
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            {user && <PhotoUpload user={user} size={80} />}
            <div className="flex-1 w-full space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs">Display Name</Label>
                  <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Username</Label>
                  <Input value={`@${user?.username || ''}`} disabled className="opacity-60 font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio" className="text-xs">Bio</Label>
                  <span className={cn(
                    "text-xs",
                    300 - bio.length < 30 ? "text-orange-500" : "text-muted-foreground"
                  )}>
                    {300 - bio.length} remaining
                  </span>
                </div>
                <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value.slice(0, 300))} placeholder="Tell us about yourself..." rows={2} />
              </div>
            </div>
          </div>

          {/* ── Section 2: Personal Details ── */}
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

          {/* ── Section 3: Sports & Goals ── */}
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

          {/* ── Role + Save ── */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Role</p>
              <Badge variant="secondary" className="capitalize text-xs">{user?.role === 'student' ? 'athlete' : user?.role}</Badge>
            </div>
            <Button size="sm" onClick={handleSaveProfile} disabled={isSavingProfile || !hasUnsavedChanges}>
              {isSavingProfile ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {isSavingProfile ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════ Profile Preview ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />Profile Preview</CardTitle>
          <CardDescription>This is how your profile appears to others</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <Avatar className="w-14 h-14 border-2 border-background shadow-md">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={displayName} />}
              <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-primary/20 to-orange-500/20">
                {displayName ? getInitials(displayName) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold truncate">{displayName || 'Your Name'}</p>
              <p className="text-sm text-muted-foreground font-mono">@{user?.username}</p>
            </div>
          </div>
          {bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{bio}</p>}
          {sportPreferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {sportPreferences.map(sport => (
                <Badge key={sport} variant="secondary" className="text-xs">{sport}</Badge>
              ))}
              {experienceLevel && (
                <Badge variant="outline" className="text-xs">{experienceLevel}</Badge>
              )}
            </div>
          )}
          {trainingFor.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {trainingFor.map(t => (
                <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile"><ExternalLink className="h-4 w-4 mr-1.5" />View Full Profile</Link>
          </Button>
        </CardContent>
      </Card>

      {/* ═══════════════════ Strava ═══════════════════ */}
      {(user?.role === 'athlete' || user?.role === 'student' || user?.role === 'coach') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="h-4 w-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" /></svg>
              Strava Integration
            </CardTitle>
            <CardDescription>New activities sync automatically. Sync pulls last year.</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.stravaId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#FC4C02]" />
                    <div>
                      <p className="font-medium">Connected</p>
                      <p className="text-sm text-muted-foreground">Connected {user.stravaConnectedAt?.toDate?.()?.toLocaleDateString() || ''}</p>
                    </div>
                  </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSyncStrava()} disabled={isSyncingStrava || syncStatus === 'syncing'}>
                    {syncStatus === 'syncing' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</> : isSyncingStrava ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</> : 'Sync'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDisconnectStrava} disabled={isDisconnectingStrava} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                    {isDisconnectingStrava ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-sm text-muted-foreground">Auto-sync is active. New Strava activities will appear automatically.</p>
              </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={handleConnectStrava} disabled={isConnectingStrava} className="bg-[#FC4C02] hover:bg-[#E34402] text-white">
                  {isConnectingStrava ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" /></svg>}
                  Connect Strava
                </Button>
                <a href="https://support.strava.com/hc/en-us/articles/216917697-Connect-Garmin-to-Strava" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  How to connect Garmin to Strava <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ Public Profile ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Public Profile</CardTitle>
          <CardDescription>Share your training stats at /athlete/{user?.username}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Profile visibility</p>
              <p className="text-xs text-muted-foreground">When enabled, anyone can view your profile</p>
            </div>
            <Switch checked={profilePublic} onCheckedChange={handleTogglePublicProfile} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyProfileUrl}>
              {profileCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {profileCopied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerateTagline} disabled={regeneratingTagline}>
              {regeneratingTagline ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {regeneratingTagline ? 'Generating...' : 'New Tagline'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/athlete/${user?.username}`} target="_blank"><ExternalLink className="h-4 w-4 mr-2" />View Profile</Link>
            </Button>
          </div>
          {user?.profileTagline && (
            <p className="text-sm text-muted-foreground italic">&ldquo;{user.profileTagline}&rdquo;</p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ Account ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4 text-primary" />Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/reset-password"><Key className="h-4 w-4 mr-2" />Change Password</Link></Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-500/10"><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════ Sticky Save Bar ═══════════════════ */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Unsaved changes
            </p>
            <Button size="sm" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {/* Strava Duplicate Dialog */}
      <StravaDuplicateDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        duplicates={stravaDuplicates}
        onConfirm={handleDuplicateDecisions}
        isLoading={syncStatus === 'syncing'}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}

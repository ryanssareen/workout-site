'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  Unlink,
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
  Sun,
  Moon,
  Monitor,
  User,
  Mail,
  Shield,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';
import { EditProfileDialog } from '@/components/profile/EditProfileDialog';
import { useStravaSyncStore } from '@/lib/stores/stravaSyncStore';
import Image from 'next/image';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isConnectingStrava, setIsConnectingStrava] = useState(false);
  const [isDisconnectingStrava, setIsDisconnectingStrava] = useState(false);
  const [profilePublic, setProfilePublic] = useState(user?.profilePublic !== false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [regeneratingTagline, setRegeneratingTagline] = useState(false);
  const { theme, setTheme } = useTheme();

  const syncStatus = useStravaSyncStore((s) => s.status);
  const startSync = useStravaSyncStore((s) => s.startSync);

  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    if (stravaStatus === 'error') {
      const messages: Record<string, string> = {
        denied: 'Strava authorization was denied. Please try again and click "Authorize" on the Strava page.',
        token_failed: 'Failed to exchange Strava token. Please try connecting again.',
        no_state: 'Session data was lost during Strava redirect. Please try again.',
        no_user: detail || 'Could not find your user account. Please log out and log back in.',
        exception: detail ? `Strava connection error: ${detail}` : 'Something went wrong connecting to Strava. Please try again.',
      };
      toast.error(reason && messages[reason] ? messages[reason] : 'Failed to connect Strava. Please try again.');
      router.replace('/settings');
    }
  }, [searchParams, router]);

  const handleConnectStrava = () => { setIsConnectingStrava(true); window.location.href = `/api/auth/strava/authorize?userId=${user?.uid}&username=${user?.username}`; };

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

  const getStravaTokens = () => {
    if (!user?.stravaAccessToken) return undefined;
    return {
      stravaAccessToken: user.stravaAccessToken,
      stravaRefreshToken: user.stravaRefreshToken,
      stravaTokenExpiresAt: user.stravaTokenExpiresAt,
      userTimezone: user.timezone,
    };
  };

  const handleSyncStrava = () => {
    if (!user) return;
    startSync(user.username, getStravaTokens());
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

  const initials = user?.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Profile Summary Header */}
      <div className="flex items-start gap-4">
        {user?.photoURL ? (
          <Image
            src={user.photoURL}
            alt={user.displayName}
            width={56}
            height={56}
            className="rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{user?.displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">@{user?.username}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Mail className="h-3 w-3" />{user?.email}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  theme === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strava */}
      {(user?.role === 'athlete' || user?.role === 'student') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="h-4 w-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" /></svg>
              Strava Integration
            </CardTitle>
            <CardDescription>New activities sync automatically. Manual sync pulls last year.</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.stravaId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#FC4C02]" />
                    <div>
                      <p className="font-medium text-sm">Connected</p>
                      <p className="text-xs text-muted-foreground">
                        Since {user.stravaConnectedAt?.toDate?.()?.toLocaleDateString() || 'unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSyncStrava} disabled={syncStatus === 'syncing'}>
                      {syncStatus === 'syncing' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Syncing</> : 'Sync Now'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDisconnectStrava} disabled={isDisconnectingStrava} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                      {isDisconnectingStrava ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">Auto-sync is active. New Strava activities appear automatically.</p>
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

      {/* Public Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Public Profile</CardTitle>
          <CardDescription>Share your training stats at /athlete/{user?.username}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="font-medium text-sm">Profile visibility</p>
              <p className="text-xs text-muted-foreground">Anyone can view your public profile</p>
            </div>
            <Switch checked={profilePublic} onCheckedChange={handleTogglePublicProfile} />
          </div>
          {user?.profileTagline && (
            <p className="text-sm text-muted-foreground italic px-1">&ldquo;{user.profileTagline}&rdquo;</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyProfileUrl}>
              {profileCopied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {profileCopied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerateTagline} disabled={regeneratingTagline}>
              {regeneratingTagline ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              {regeneratingTagline ? 'Generating...' : 'New Tagline'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/athlete/${user?.username}`} target="_blank"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />View</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account & Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Account & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Email</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Role</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link href="/reset-password"><Key className="h-3.5 w-3.5 mr-1.5" />Change Password</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
              <LogOut className="h-3.5 w-3.5 mr-1.5" />Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditProfileDialog open={editProfileOpen} onOpenChange={setEditProfileOpen} />
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

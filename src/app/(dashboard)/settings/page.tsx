'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
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
  Settings,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';
import { EditProfileDialog } from '@/components/profile/EditProfileDialog';
import { useStravaSyncStore } from '@/lib/stores/stravaSyncStore';
import Image from 'next/image';

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-1">{title}</h2>
  );
}

function Divider() {
  return <div className="border-t border-border" />;
}

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
    navigator.clipboard.writeText(`${window.location.origin}/athlete/${user.username}`);
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
    <div className="max-w-3xl mx-auto pb-12">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
          <Settings className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* ── Profile ── */}
        <div className="p-6">
          <SectionHeader title="Profile" />
          <div className="flex items-center gap-5 py-4">
            {user?.photoURL ? (
              <Image src={user.photoURL} alt={user.displayName} width={64} height={64} className="rounded-xl object-cover shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{user?.displayName}</p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setEditProfileOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Edit Profile
              </Button>
              <Button variant="outline" asChild>
                <Link href="/profile"><ExternalLink className="h-4 w-4 mr-2" />View</Link>
              </Button>
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Appearance ── */}
        <div className="p-6">
          <SectionHeader title="Appearance" />
          <SettingRow label="Theme" description="Choose how the app looks">
            <div className="flex gap-1.5 bg-muted/50 p-1 rounded-lg">
              {([
                { value: 'light', icon: Sun },
                { value: 'dark', icon: Moon },
                { value: 'system', icon: Monitor },
              ] as const).map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    theme === value
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize">{value}</span>
                </button>
              ))}
            </div>
          </SettingRow>
        </div>

        {/* ── Strava ── */}
        {(user?.role === 'athlete' || user?.role === 'student') && (
          <>
            <Divider />
            <div className="p-6">
              <SectionHeader title="Integrations" />
              <SettingRow
                label="Strava"
                description={user?.stravaId
                  ? `Connected since ${user.stravaConnectedAt?.toDate?.()?.toLocaleDateString() || 'unknown'} — auto-sync active`
                  : 'Sync your runs, rides, and swims automatically'
                }
              >
                {user?.stravaId ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#FC4C02]" />
                    <Button variant="outline" onClick={handleSyncStrava} disabled={syncStatus === 'syncing'}>
                      {syncStatus === 'syncing' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing</> : 'Sync Now'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDisconnectStrava} disabled={isDisconnectingStrava} className="text-muted-foreground hover:text-red-500">
                      {isDisconnectingStrava ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleConnectStrava} disabled={isConnectingStrava} className="bg-[#FC4C02] hover:bg-[#E34402] text-white">
                    {isConnectingStrava ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" /></svg>}
                    Connect Strava
                  </Button>
                )}
              </SettingRow>
            </div>
          </>
        )}

        <Divider />

        {/* ── Public Profile ── */}
        <div className="p-6">
          <SectionHeader title="Public Profile" />
          <SettingRow
            label="Profile visibility"
            description={`Share your training stats at /athlete/${user?.username}`}
          >
            <Switch checked={profilePublic} onCheckedChange={handleTogglePublicProfile} />
          </SettingRow>

          {user?.profileTagline && (
            <p className="text-sm text-muted-foreground italic pb-2">&ldquo;{user.profileTagline}&rdquo;</p>
          )}

          <div className="flex gap-2 pb-2">
            <Button variant="outline" onClick={handleCopyProfileUrl}>
              {profileCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {profileCopied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" onClick={handleRegenerateTagline} disabled={regeneratingTagline}>
              {regeneratingTagline ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {regeneratingTagline ? 'Generating...' : 'New Tagline'}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/athlete/${user?.username}`} target="_blank"><ExternalLink className="h-4 w-4 mr-2" />View Profile</Link>
            </Button>
          </div>
        </div>

        <Divider />

        {/* ── Account ── */}
        <div className="p-6">
          <SectionHeader title="Account" />
          <SettingRow label="Password" description="Update your login credentials">
            <Button variant="outline" asChild>
              <Link href="/reset-password"><Key className="h-4 w-4 mr-2" />Change Password</Link>
            </Button>
          </SettingRow>
          <Divider />
          <SettingRow label="Sign out" description="Log out of your account on this device">
            <Button variant="outline" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-2" />Sign Out
            </Button>
          </SettingRow>
        </div>
      </div>

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

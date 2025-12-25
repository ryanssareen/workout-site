'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { findCoachByCode } from '@/lib/firebase/auth';
import { connectToCoach, disconnectFromCoach, getCoachInfo } from '@/lib/firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User, Users, Link2, Unlink, Settings, LogOut, Key,
  CheckCircle2, XCircle, Loader2, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [coachCode, setCoachCode] = useState('');
  const [coachName, setCoachName] = useState<string | null>(null);
  const [isConnectingCoach, setIsConnectingCoach] = useState(false);
  const [isDisconnectingCoach, setIsDisconnectingCoach] = useState(false);
  const [isConnectingStrava, setIsConnectingStrava] = useState(false);
  const [isDisconnectingStrava, setIsDisconnectingStrava] = useState(false);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [loadingCoachInfo, setLoadingCoachInfo] = useState(false);

  // Check for Strava connection status from URL params
  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    if (stravaStatus === 'connected') {
      toast.success('Strava connected successfully!');
      router.replace('/settings');
    } else if (stravaStatus === 'error') {
      toast.error('Failed to connect Strava. Please try again.');
      router.replace('/settings');
    }
  }, [searchParams, router]);

  // Load coach info if student is connected
  useEffect(() => {
    async function loadCoachInfo() {
      if (user?.role === 'student' && user.coachId) {
        setLoadingCoachInfo(true);
        try {
          const coach = await getCoachInfo(user.coachId);
          setCoachName(coach?.displayName || 'Unknown Coach');
        } catch (error) {
          console.error('Error loading coach info:', error);
        }
        setLoadingCoachInfo(false);
      }
    }
    loadCoachInfo();
  }, [user]);

  const handleConnectCoach = async () => {
    if (!coachCode.trim() || !user) return;

    setIsConnectingCoach(true);
    try {
      const coach = await findCoachByCode(coachCode.toUpperCase());
      if (!coach) {
        toast.error('Invalid coach code. Please check and try again.');
        setIsConnectingCoach(false);
        return;
      }

      await connectToCoach(user.uid, coach.uid);
      setUser({ ...user, coachId: coach.uid });
      setCoachName(coach.displayName);
      setCoachCode('');
      toast.success(`Connected to coach ${coach.displayName}!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to coach');
    }
    setIsConnectingCoach(false);
  };

  const handleDisconnectCoach = async () => {
    if (!user) return;

    setIsDisconnectingCoach(true);
    try {
      await disconnectFromCoach(user.uid);
      setUser({ ...user, coachId: undefined });
      setCoachName(null);
      toast.success('Disconnected from coach');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect from coach');
    }
    setIsDisconnectingCoach(false);
  };

  const handleConnectStrava = async () => {
    setIsConnectingStrava(true);
    // Redirect to Strava OAuth
    window.location.href = `/api/auth/strava/authorize?userId=${user?.uid}`;
  };

  const handleDisconnectStrava = async () => {
    if (!user) return;

    setIsDisconnectingStrava(true);
    try {
      const response = await fetch('/api/auth/strava/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!response.ok) throw new Error('Failed to disconnect');

      setUser({
        ...user,
        stravaId: undefined,
        stravaAccessToken: undefined,
        stravaRefreshToken: undefined,
        stravaConnectedAt: undefined,
      });
      toast.success('Strava disconnected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Strava');
    }
    setIsDisconnectingStrava(false);
  };

  const handleSyncStrava = async () => {
    if (!user) return;

    setIsSyncingStrava(true);
    try {
      const response = await fetch(`/api/strava/sync?userId=${user.uid}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync Strava');
      }

      const data = await response.json();
      
      if (data.newWorkouts > 0) {
        const message = `Synced ${data.newWorkouts} new workout${data.newWorkouts > 1 ? 's' : ''} from Strava!`;
        const extra = data.deletedWorkouts > 0 ? ` Deleted ${data.deletedWorkouts} old workout${data.deletedWorkouts > 1 ? 's' : ''}.` : '';
        toast.success(message + extra);
      } else {
        toast.success('All caught up! No new Strava activities found.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync Strava');
    }
    setIsSyncingStrava(false);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="space-y-8 pb-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="animate-in fade-in slide-in-from-left-4 duration-500">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account and connections</p>
      </div>

      {/* Profile Section */}
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Display Name</label>
              <p className="text-lg font-medium">{user?.displayName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Role</label>
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
          {user?.role === 'coach' && user?.coachCode && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
              <label className="text-sm font-medium text-muted-foreground">Your Coach Code</label>
              <p className="text-2xl font-mono font-bold tracking-wider mt-1">{user.coachCode}</p>
              <p className="text-xs text-muted-foreground mt-2">Share this code with your students</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coach Connection (Students Only) */}
      {user?.role === 'student' && (
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: '100ms' }}
        >
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Coach Connection
            </CardTitle>
            <CardDescription>Connect with your coach to receive workouts</CardDescription>
          </CardHeader>
          <CardContent>
            {user.coachId ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Connected to Coach</p>
                      {loadingCoachInfo ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{coachName}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectCoach}
                    disabled={isDisconnectingCoach}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    {isDisconnectingCoach ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <XCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm">You're not connected to a coach yet</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coach code (e.g., ABCXYZ)"
                    value={coachCode}
                    onChange={(e) => setCoachCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="font-mono uppercase"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleConnectCoach}
                    disabled={coachCode.length !== 6 || isConnectingCoach}
                  >
                    {isConnectingCoach ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strava Integration */}
      <Card
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: '200ms' }}
      >
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="h-5 w-5 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
            </svg>
            Strava Integration
          </CardTitle>
          <CardDescription>Connect Strava to sync workouts from Garmin and other devices</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.stravaId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#FC4C02]/10 border border-[#FC4C02]/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#FC4C02]" />
                  <div>
                    <p className="font-medium">Strava Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connected on {user.stravaConnectedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncStrava}
                    disabled={isSyncingStrava}
                  >
                    {isSyncingStrava ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      'Sync Now'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectStrava}
                    disabled={isDisconnectingStrava}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    {isDisconnectingStrava ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your Strava account to automatically import workouts. If you use Garmin,
                  make sure your Garmin Connect is synced with Strava first.
                </p>
                <Button
                  onClick={handleConnectStrava}
                  disabled={isConnectingStrava}
                  className="bg-[#FC4C02] hover:bg-[#E34402] text-white"
                >
                  {isConnectingStrava ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                    </svg>
                  )}
                  Connect with Strava
                </Button>
              </div>
              <a
                href="https://support.strava.com/hc/en-us/articles/216917697-Connect-Garmin-to-Strava"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                How to connect Garmin to Strava
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: '300ms' }}
      >
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Account
          </CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" asChild>
              <Link href="/reset-password">
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

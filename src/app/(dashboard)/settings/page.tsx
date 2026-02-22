'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
// Backend coach functions preserved for future use
// import { findCoachByCode } from '@/lib/firebase/auth';
// import { connectToCoach, disconnectFromCoach, getCoachInfo } from '@/lib/firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Unlink, Settings, LogOut, Key, CheckCircle2, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';
import { StravaDuplicateDialog } from '@/components/strava/DuplicateDialog';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [isConnectingStrava, setIsConnectingStrava] = useState(false);
  const [isDisconnectingStrava, setIsDisconnectingStrava] = useState(false);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [stravaDuplicates, setStravaDuplicates] = useState<any[]>([]);

  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    const reason = searchParams.get('reason');
    if (stravaStatus === 'connected') {
      toast.success('Strava account connected successfully');
      router.replace('/settings');
    } else if (stravaStatus === 'error') {
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
      const response = await fetch('/api/auth/strava/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.uid }) });
      if (!response.ok) throw new Error('Failed to disconnect');
      setUser({ ...user, stravaId: undefined, stravaAccessToken: undefined, stravaRefreshToken: undefined, stravaConnectedAt: undefined });
      toast.success('Strava disconnected');
    } catch (error: any) { toast.error(error.message || 'Failed to disconnect'); }
    setIsDisconnectingStrava(false);
  };

  const handleSyncStrava = async (decisions?: Record<string, { action: 'merge' | 'new'; workoutId?: string }>) => {
    if (!user) return;
    setIsSyncingStrava(true);
    try {
      // First, check for duplicates (unless we already have decisions)
      if (!decisions) {
        const checkResponse = await fetch(
          `/api/strava/sync?userId=${user.uid}&checkDuplicates=true`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (!checkResponse.ok) {
          const errorData = await checkResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Duplicate check failed:', errorData);

          // Handle authorization errors that need reconnection
          if (errorData.needsReconnect) {
            throw new Error(errorData.error || 'Please reconnect your Strava account');
          }

          // Provide more helpful error messages
          if (errorData.hint) {
            throw new Error(`${errorData.error}: ${errorData.hint}`);
          } else if (errorData.details) {
            throw new Error(`${errorData.error}: ${errorData.details}`);
          } else {
            throw new Error(errorData.error || 'Failed to check for duplicates');
          }
        }

        const checkData = await checkResponse.json();

        if (checkData.hasDuplicates && checkData.duplicates?.length > 0) {
          // Show duplicate dialog
          setStravaDuplicates(checkData.duplicates);
          setShowDuplicateDialog(true);
          setIsSyncingStrava(false);
          return;
        }
      }

      // Perform the actual sync with decisions
      const decisionsParam = decisions ? `&decisions=${encodeURIComponent(JSON.stringify(decisions))}` : '';
      const response = await fetch(
        `/api/strava/sync?userId=${user.uid}${decisionsParam}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Sync failed:', errorData);

        // Handle authorization errors that need reconnection
        if (errorData.needsReconnect) {
          throw new Error(errorData.error || 'Please reconnect your Strava account');
        }

        throw new Error(errorData.error || 'Failed to sync');
      }

      const data = await response.json();

      let message = '';
      if (data.mergedWorkouts > 0 && data.newWorkouts > 0) {
        message = `Merged ${data.mergedWorkouts} and created ${data.newWorkouts} workout${data.newWorkouts > 1 ? 's' : ''}!`;
      } else if (data.mergedWorkouts > 0) {
        message = `Merged ${data.mergedWorkouts} workout${data.mergedWorkouts > 1 ? 's' : ''}!`;
      } else if (data.newWorkouts > 0) {
        message = `Synced ${data.newWorkouts} workout${data.newWorkouts > 1 ? 's' : ''}!`;
      } else {
        message = 'All caught up!';
      }
      toast.success(message);
    } catch (error: any) {
      console.error('Strava sync error:', error);
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

  const handleLogout = async () => { await signOut(); router.push('/login'); };

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
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

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" />Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground mb-1">Name</p><p className="font-medium">{user?.displayName}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Email</p><p className="font-medium">{user?.email}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Role</p>
            <Badge variant="secondary" className="capitalize">{user?.role === 'student' ? 'athlete' : user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Strava */}
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
                  <Button variant="outline" size="sm" onClick={() => handleSyncStrava()} disabled={isSyncingStrava}>
                    {isSyncingStrava ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</> : 'Sync'}
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

      {/* Account */}
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

      {/* Strava Duplicate Dialog */}
      <StravaDuplicateDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        duplicates={stravaDuplicates}
        onConfirm={handleDuplicateDecisions}
        isLoading={isSyncingStrava}
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

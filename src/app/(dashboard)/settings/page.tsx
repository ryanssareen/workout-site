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
import { User, Users, Link2, Unlink, Settings, LogOut, Key, CheckCircle2, XCircle, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';
import { StravaDuplicateDialog } from '@/components/strava/DuplicateDialog';

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
  const [copied, setCopied] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [stravaDuplicates, setStravaDuplicates] = useState<any[]>([]);

  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    if (stravaStatus === 'connected') { toast.success('Strava connected!'); router.replace('/settings'); }
    else if (stravaStatus === 'error') { toast.error('Failed to connect Strava'); router.replace('/settings'); }
  }, [searchParams, router]);

  useEffect(() => {
    async function loadCoachInfo() {
      if (user?.role === 'student' && user.coachId) {
        setLoadingCoachInfo(true);
        try { const coach = await getCoachInfo(user.coachId); setCoachName(coach?.displayName || 'Unknown Coach'); } 
        catch (error) { console.error('Error loading coach info:', error); }
        setLoadingCoachInfo(false);
      }
    }
    loadCoachInfo();
  }, [user]);

  const handleCopyCode = () => {
    if (user?.coachCode) {
      navigator.clipboard.writeText(user.coachCode);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectCoach = async () => {
    if (!coachCode.trim() || !user) return;
    setIsConnectingCoach(true);
    try {
      const coach = await findCoachByCode(coachCode.toUpperCase());
      if (!coach) { toast.error('Invalid coach code'); setIsConnectingCoach(false); return; }
      await connectToCoach(user.uid, coach.uid);
      setUser({ ...user, coachId: coach.uid });
      setCoachName(coach.displayName);
      setCoachCode('');
      toast.success(`Connected to ${coach.displayName}!`);
    } catch (error: any) { toast.error(error.message || 'Failed to connect'); }
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
    } catch (error: any) { toast.error(error.message || 'Failed to disconnect'); }
    setIsDisconnectingCoach(false);
  };

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
        if (!checkResponse.ok) throw new Error('Failed to check for duplicates');
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
      if (!response.ok) throw new Error('Failed to sync');
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
    } catch (error: any) { toast.error(error.message || 'Failed to sync'); }
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
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
          {user?.role === 'coach' && user?.coachCode && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your Coach Code</p>
                <p className="text-2xl font-mono font-bold tracking-wider">{user.coachCode}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coach Connection */}
      {user?.role === 'student' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Coach Connection</CardTitle>
            <CardDescription>Connect with your coach</CardDescription>
          </CardHeader>
          <CardContent>
            {user.coachId ? (
              <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Connected</p>
                    <p className="text-sm text-muted-foreground">{loadingCoachInfo ? 'Loading...' : coachName}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnectCoach} disabled={isDisconnectingCoach} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                  {isDisconnectingCoach ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlink className="h-4 w-4 mr-2" />Disconnect</>}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <XCircle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm">Not connected to a coach</p>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Enter code (e.g., ABCXYZ)" value={coachCode} onChange={(e) => setCoachCode(e.target.value.toUpperCase().slice(0, 6))} className="font-mono uppercase" maxLength={6} />
                  <Button onClick={handleConnectCoach} disabled={coachCode.length !== 6 || isConnectingCoach}>
                    {isConnectingCoach ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 mr-2" />Connect</>}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strava */}
      {user?.role === 'student' && (
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

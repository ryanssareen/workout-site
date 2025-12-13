'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Activity, CheckCircle, XCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState<any>(null);
  const [connectingStrava, setConnectingStrava] = useState(false);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);

  useEffect(() => {
    // Check for OAuth callback messages
    const stravaStatus = searchParams?.get('strava');
    if (stravaStatus === 'success') {
      toast.success('Strava connected successfully!');
      // Remove query param
      router.replace('/settings');
      // Reload user data
      loadUserData();
    } else if (stravaStatus === 'error') {
      toast.error('Failed to connect Strava. Please try again.');
      router.replace('/settings');
    }

    loadUserData();
  }, [searchParams]);

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setStravaConnected(userData.stravaConnected || false);
        setStravaAthlete(userData.stravaAthlete || null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStrava = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login first');
        return;
      }

      setConnectingStrava(true);

      // Redirect to Strava OAuth
      window.location.href = `/api/auth/strava/authorize?userId=${user.uid}`;
    } catch (error: any) {
      console.error('Error connecting Strava:', error);
      toast.error('Failed to connect Strava');
      setConnectingStrava(false);
    }
  };

  const handleDisconnectStrava = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setDisconnectingStrava(true);

      const response = await fetch('/api/auth/strava/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setStravaConnected(false);
      setStravaAthlete(null);
      toast.success('Strava disconnected successfully');
    } catch (error: any) {
      console.error('Error disconnecting Strava:', error);
      toast.error('Failed to disconnect Strava');
    } finally {
      setDisconnectingStrava(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integrations</p>
        </div>

        {/* Strava Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle>Strava Integration</CardTitle>
                <CardDescription>
                  Connect your Strava account to automatically sync workouts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stravaConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Connected to Strava
                    </p>
                    {stravaAthlete && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {stravaAthlete.firstname} {stravaAthlete.lastname} (@{stravaAthlete.username})
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={handleDisconnectStrava}
                  disabled={disconnectingStrava}
                >
                  {disconnectingStrava ? 'Disconnecting...' : 'Disconnect Strava'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-muted border rounded-lg">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground">Not connected to Strava</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Connect your Strava account to:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Automatically sync completed workouts</li>
                    <li>Track your fitness metrics (heart rate, calories, etc.)</li>
                    <li>Get data from your Garmin, Apple Watch, or other devices</li>
                  </ul>
                </div>

                <Button
                  onClick={handleConnectStrava}
                  disabled={connectingStrava}
                  className="bg-[#FC4C02] hover:bg-[#E34402]"
                >
                  {connectingStrava ? 'Connecting...' : 'Connect with Strava'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

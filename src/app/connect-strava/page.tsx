'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, ExternalLink, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ConnectStravaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const setUser = useAuthStore((state) => state.setUser);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Check for Strava connection status from URL params
  useEffect(() => {
    const stravaStatus = searchParams.get('strava');
    if (stravaStatus === 'connected') {
      setConnectionStatus('success');
      toast.success('Strava connected successfully!');
    } else if (stravaStatus === 'error') {
      setConnectionStatus('error');
      const errorMsg = searchParams.get('message') || 'Failed to connect Strava';
      toast.error(errorMsg);
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/connect-strava');
    }
  }, [user, loading, router]);

  const handleConnectStrava = () => {
    if (!user) {
      router.push('/login?redirect=/connect-strava');
      return;
    }
    setIsConnecting(true);
    window.location.href = `/api/auth/strava/authorize?userId=${user.uid}&username=${user.username}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Already connected
  if (user?.stravaId || connectionStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Strava Connected!</CardTitle>
            <CardDescription>
              Your Strava account is now linked. Your workouts will automatically sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-[#FC4C02]/10 border border-[#FC4C02]/20">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
                <div>
                  <p className="font-medium">Connected to Strava</p>
                  <p className="text-sm text-muted-foreground">
                    Activities will auto-complete your workouts
                  </p>
                </div>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/settings">
                Manage Connection
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#FC4C02]/10 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Connect Your Strava Account</CardTitle>
          <CardDescription className="text-base mt-2">
            To track your workouts automatically, we need to connect to your Strava account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {connectionStatus === 'error' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">Connection Failed</p>
                <p className="text-sm text-muted-foreground">
                  Please try again. If the problem persists, make sure you have a Strava account.
                </p>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <h3 className="font-semibold mb-2">How does this work?</h3>
            <p className="text-sm text-muted-foreground">
              When you click the button below, you'll be taken to Strava to log in and authorize this app to read your activities.
              Once connected, whenever you complete a run, ride, or workout on Strava, we'll automatically mark your assigned workout as done.
            </p>
          </div>

          {/* What you get */}
          <div className="space-y-3">
            <h3 className="font-semibold">What you'll get:</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span><strong>Automatic completion</strong> — finish a workout on Strava, it's marked done here</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span><strong>Real stats</strong> — distance, time, pace, and heart rate from your actual activity</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span><strong>Works with any device</strong> — Garmin, Apple Watch, Wahoo, or phone</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span><strong>Coach visibility</strong> — your coach sees your real performance data</span>
              </li>
            </ul>
          </div>

          {/* Connect Button */}
          <Button
            onClick={handleConnectStrava}
            disabled={isConnecting}
            className="w-full bg-[#FC4C02] hover:bg-[#E34402] text-white h-12 text-lg"
          >
            {isConnecting ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
              </svg>
            )}
            Log in to Strava & Connect
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to Strava to log in and grant permission
          </p>

          {/* No Strava account */}
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-center mb-2">Don't have Strava yet?</h3>
            <p className="text-sm text-center text-muted-foreground mb-3">
              Strava is a free app that tracks your runs, rides, and workouts. Create a free account first, then come back here to connect.
            </p>
            <Button
              variant="outline"
              asChild
              className="w-full"
            >
              <a
                href="https://www.strava.com/register/free"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create Free Strava Account
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>

          {/* Garmin users */}
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground mb-1">
              <strong>Using a Garmin watch?</strong>
            </p>
            <a
              href="https://support.strava.com/hc/en-us/articles/216917697-Connect-Garmin-to-Strava"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              First connect Garmin to Strava, then connect here
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Skip for now */}
          <div className="text-center pt-2">
            <Button variant="ghost" asChild className="text-muted-foreground">
              <Link href="/dashboard">
                Skip for now
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectStravaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ConnectStravaContent />
    </Suspense>
  );
}

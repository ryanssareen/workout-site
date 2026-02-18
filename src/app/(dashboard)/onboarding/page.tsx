'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [name, setName] = useState(user?.displayName || '');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.onboardingCompleted !== false) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    setName(user?.displayName || '');
  }, [user?.displayName]);

  const handleSubmit = async () => {
    if (!user) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch('/api/ai/profanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!data.isClean) {
        toast.error(data.reason || 'Please choose an appropriate name');
        setChecking(false);
        return;
      }
    } catch {
      // Allow through if the checker is temporarily unavailable.
    }
    setChecking(false);

    setSaving(true);
    try {
      await updateDoc(doc(getDbInstance(), 'users', user.uid), {
        displayName: trimmed,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });

      setUser({
        ...user,
        displayName: trimmed,
        onboardingCompleted: true,
      });

      toast.success(`Welcome, ${trimmed}!`);
      router.replace('/profile?edit=1');
    } catch {
      toast.error('Failed to save name');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.onboardingCompleted !== false) {
    return null;
  }

  const isLoading = checking || saving;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to CoachTrack</CardTitle>
          <CardDescription>What&apos;s your name?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onboarding-name">Name</Label>
            <Input
              id="onboarding-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="Your name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSubmit();
                }
              }}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || name.trim().length < 2}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {checking ? 'Checking...' : 'Saving...'}
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

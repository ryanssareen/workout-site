'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function OnboardingModal() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [name, setName] = useState(user?.displayName || '');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user || user.onboardingCompleted !== false) return null;

  const handleSubmit = async () => {
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
      // If profanity check fails, allow the name through
    }
    setChecking(false);

    setSaving(true);
    try {
      const userRef = doc(getDbInstance(), 'users', user.username);
      await updateDoc(userRef, {
        displayName: trimmed,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });
      setUser({ ...user, displayName: trimmed, onboardingCompleted: true });
      toast.success(`Welcome, ${trimmed}!`);
    } catch {
      toast.error('Failed to save name');
    }
    setSaving(false);
  };

  const isLoading = checking || saving;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to CoachTrack!</DialogTitle>
          <DialogDescription>
            What should we call you? You can always change this later in your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="onboarding-name">Display Name</Label>
            <Input
              id="onboarding-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) handleSubmit();
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
              "Let's Go!"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

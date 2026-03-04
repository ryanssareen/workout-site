'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createGoogleUser } from '@/lib/firebase/auth';
import { validateUsername, isUsernameAvailable } from '@/lib/firebase/userMapping';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dumbbell, Loader2, AtSign, ArrowRight, AlertCircle } from 'lucide-react';

export default function ChooseUsernamePage() {
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const pendingGoogleUser = useAuthStore((s) => s.pendingGoogleUser);
  const needsUsername = useAuthStore((s) => s.needsUsername);
  const setUser = useAuthStore((s) => s.setUser);
  const setNeedsUsername = useAuthStore((s) => s.setNeedsUsername);

  useEffect(() => {
    if (!needsUsername || !pendingGoogleUser) {
      router.replace('/login');
    }
  }, [needsUsername, pendingGoogleUser, router]);

  const handleUsernameChange = useCallback(async (value: string) => {
    const lower = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(lower);
    setUsernameError('');

    if (!lower) return;

    const validation = validateUsername(lower);
    if (!validation.valid) {
      setUsernameError(validation.error || '');
      return;
    }

    setChecking(true);
    const available = await isUsernameAvailable(lower);
    setChecking(false);
    if (!available) {
      setUsernameError('Username is already taken');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;

    setUsernameError('');
    setLoading(true);

    const validation = validateUsername(username);
    if (!validation.valid) {
      setUsernameError(validation.error || '');
      setLoading(false);
      return;
    }

    const available = await isUsernameAvailable(username);
    if (!available) {
      setUsernameError('Username is already taken');
      setLoading(false);
      return;
    }

    try {
      const user = await createGoogleUser(
        pendingGoogleUser.uid,
        pendingGoogleUser.email,
        pendingGoogleUser.displayName,
        username,
        pendingGoogleUser.photoURL,
      );

      setUser(user);
      setNeedsUsername(false);
      toast.success('Account created!');
      router.push('/onboarding');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pendingGoogleUser) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black shadow-xl shadow-black/25 mb-4">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Choose Your Username</h1>
          <p className="text-white/40 mt-1">Welcome, {pendingGoogleUser.displayName}! Pick a unique username.</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-white/70">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  required
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                  className={`pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors ${usernameError ? 'border-red-500' : ''}`}
                />
                {checking && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
              </div>
              {usernameError && (
                <div className="flex items-center gap-1.5 text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{usernameError}</span>
                </div>
              )}
              <p className="text-xs text-white/25">Lowercase letters, numbers, underscores. 3-20 characters.</p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 border-0 transition-all"
              disabled={loading || checking || !!usernameError || !username}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
              ) : (
                <>Continue<ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

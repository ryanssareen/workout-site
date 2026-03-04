'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, signInWithGoogle } from '@/lib/firebase/auth';
import { validateUsername, isUsernameAvailable } from '@/lib/firebase/userMapping';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dumbbell, Loader2, User, Mail, Lock, ArrowRight, AlertCircle, AtSign } from 'lucide-react';
import Link from 'next/link';

export function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    username: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const router = useRouter();
  const setNeedsUsername = useAuthStore((s) => s.setNeedsUsername);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.type === 'existing') {
        toast.success('Welcome back!');
        router.push('/dashboard');
      } else {
        // New Google user needs to pick a username
        setNeedsUsername(true, result);
        router.push('/choose-username');
      }
    } catch (error: any) {
      if (error.message !== 'Sign-in cancelled') {
        toast.error(error.message);
      }
      setGoogleLoading(false);
    }
  };

  const checkName = async (name: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/ai/profanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: name }),
      });
      const data = await res.json();
      if (!data.isClean) {
        setNameError(data.reason || 'Please choose an appropriate name.');
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleUsernameChange = useCallback(async (value: string) => {
    const lower = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData((prev) => ({ ...prev, username: lower }));
    setUsernameError('');

    if (!lower) return;

    const validation = validateUsername(lower);
    if (!validation.valid) {
      setUsernameError(validation.error || '');
      return;
    }

    setUsernameChecking(true);
    const available = await isUsernameAvailable(lower);
    setUsernameChecking(false);
    if (!available) {
      setUsernameError('Username is already taken');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setUsernameError('');
    setLoading(true);

    const trimmedName = formData.displayName.trim();
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters.');
      setLoading(false);
      return;
    }

    const validation = validateUsername(formData.username);
    if (!validation.valid) {
      setUsernameError(validation.error || '');
      setLoading(false);
      return;
    }

    const available = await isUsernameAvailable(formData.username);
    if (!available) {
      setUsernameError('Username is already taken');
      setLoading(false);
      return;
    }

    const isClean = await checkName(trimmedName);
    if (!isClean) {
      setLoading(false);
      return;
    }

    try {
      await createUser(
        formData.email,
        formData.password,
        trimmedName,
        formData.username,
        'athlete'
      );

      toast.success('Account created successfully');
      router.push('/onboarding');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black shadow-xl shadow-black/25 mb-4">
          <Dumbbell className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Join The Daily Athlete</h1>
        <p className="text-white/40 mt-1">Start building your training discipline</p>
      </div>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium text-white/70">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input id="displayName" type="text" placeholder="John Doe" value={formData.displayName} onChange={(e) => { setFormData({ ...formData, displayName: e.target.value }); setNameError(''); }} required maxLength={50} className={`pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors ${nameError ? 'border-red-500' : ''}`} />
            </div>
            {nameError && (
              <div className="flex items-center gap-1.5 text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nameError}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-white/70">Username</Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input id="username" type="text" placeholder="johndoe" value={formData.username} onChange={(e) => handleUsernameChange(e.target.value)} required maxLength={20} className={`pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors ${usernameError ? 'border-red-500' : ''}`} />
              {usernameChecking && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
            </div>
            {usernameError && (
              <div className="flex items-center gap-1.5 text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{usernameError}</span>
              </div>
            )}
            <p className="text-xs text-white/25">Lowercase letters, numbers, underscores. 3-20 characters.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white/70">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input id="password" type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors" />
            </div>
          </div>

          <Button type="submit" className="w-full h-11 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 border-0 transition-all" disabled={loading || googleLoading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : <>Create Account<ArrowRight className="w-4 h-4 ml-2" /></>}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-white/30">or</span></div>
          </div>

          <Button type="button" variant="outline" className="w-full h-11 bg-white hover:bg-gray-50 text-gray-700 border-white/20 font-medium" onClick={handleGoogleSignUp} disabled={loading || googleLoading}>
            {googleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-white/30">Already have an account?{' '}<Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">Sign in</Link></p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-white/20 hover:text-white/50 transition-colors">&larr; Back to home</Link>
      </div>
    </div>
  );
}

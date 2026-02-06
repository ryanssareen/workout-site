'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, findCoachByCode, signInWithGoogle } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserRole } from '@/types';
import { Dumbbell, Loader2, User, Mail, Lock, ArrowRight, UserCheck, Target } from 'lucide-react';
import Link from 'next/link';

interface RegisterFormProps {
  initialRole?: string;
}

export function RegisterForm({ initialRole = '' }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: (initialRole || '') as UserRole | '',
    coachCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  // Keep role in sync if the initialRole prop changes (e.g., navigation updates query param)
  useEffect(() => {
    if (initialRole === 'coach' || initialRole === 'student') {
      setFormData((prev) => ({ ...prev, role: initialRole as UserRole }));
    }
  }, [initialRole]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Account created! You can update your role in Settings.');
      router.push('/dashboard');
    } catch (error: any) {
      if (error.message !== 'Sign-in cancelled') {
        toast.error(error.message);
      }
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.role) {
        throw new Error('Please select a role');
      }

      let coachId: string | undefined;

      // If student with coach code, validate and get coach ID
      if (formData.role === 'student' && formData.coachCode) {
        console.log('Looking for coach with code:', formData.coachCode);
        const coach = await findCoachByCode(formData.coachCode);
        console.log('Found coach:', coach);
        if (!coach) {
          throw new Error(`Invalid coach code: "${formData.coachCode}". Please check and try again.`);
        }
        coachId = coach.uid;
      }

      const newUser = await createUser(
        formData.email,
        formData.password,
        formData.displayName,
        formData.role,
        coachId
      );

      // Show appropriate success message based on role and coach connection
      if (formData.role === 'coach' && newUser.coachCode) {
        toast.success(
          `Account created! Your coach code is: ${newUser.coachCode}`,
          { duration: 10000 }
        );
      } else if (formData.role === 'student' && !coachId) {
        toast.success(
          'Account created! You can connect to a coach anytime in Settings.',
          { duration: 5000 }
        );
      } else {
        toast.success('Account created successfully');
      }

      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 shadow-xl shadow-red-600/25 mb-4">
          <Dumbbell className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Create Account</h1>
        <p className="text-white/40 mt-1">Start tracking your training</p>
      </div>

      {/* Form Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium text-white/70">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                id="displayName"
                type="text"
                placeholder="John Doe"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white/70">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">I am a...</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'coach' })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formData.role === 'coach'
                    ? 'border-red-500 bg-red-600/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <UserCheck className={`h-6 w-6 ${formData.role === 'coach' ? 'text-red-500' : ''}`} />
                <span className="font-bold text-sm uppercase tracking-wider">Coach</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'student' })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  formData.role === 'student'
                    ? 'border-red-500 bg-red-600/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <Target className={`h-6 w-6 ${formData.role === 'student' ? 'text-red-500' : ''}`} />
                <span className="font-bold text-sm uppercase tracking-wider">Athlete</span>
              </button>
            </div>
          </div>

          {formData.role === 'student' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="coachCode" className="text-sm font-medium text-white/70">Coach Code</Label>
                <span className="text-xs text-white/30">(Optional)</span>
              </div>
              <Input
                id="coachCode"
                type="text"
                placeholder="Enter 6-letter code"
                value={formData.coachCode}
                onChange={(e) => setFormData({ ...formData, coachCode: e.target.value.toUpperCase() })}
                maxLength={6}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500 focus:ring-red-500/20 transition-colors uppercase tracking-widest text-center font-mono text-lg"
              />
              <p className="text-xs text-white/30">
                No code? No problem - connect to a coach later in Settings.
              </p>
            </div>
          )}

          <Button type="submit" className="w-full h-11 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 border-0 transition-all" disabled={loading || googleLoading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
            ) : (
              <>Create Account<ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-white/30">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-white hover:bg-gray-50 text-gray-700 border-white/20 font-medium"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </Button>

          <p className="text-xs text-center text-white/20">
            Google sign-up creates an athlete account by default.
          </p>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-white/30">
            Already have an account?{' '}
            <Link href="/login" className="text-red-500 hover:text-red-400 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-white/20 hover:text-white/50 transition-colors">&larr; Back to home</Link>
      </div>
    </div>
  );
}

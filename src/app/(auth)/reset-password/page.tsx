'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Mail, Dumbbell } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reset email');
      setEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 -left-20 w-[300px] h-[300px] bg-red-900/8 rounded-full blur-[90px]" />
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-600 shadow-xl shadow-green-600/25 mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">Check Your Email</h1>
            <p className="text-muted-foreground mt-2">
              We&apos;ve sent a password reset link to <strong className="text-foreground/70">{email}</strong>
            </p>
          </div>
          <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl space-y-4">
            <p className="text-sm text-muted-foreground text-center">Click the link in the email to reset your password. Check your spam folder if you don&apos;t see it.</p>
            <Button asChild className="w-full h-11 bg-red-600 hover:bg-red-700 text-white border-0 font-bold">
              <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" />Back to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground shadow-xl shadow-foreground/10 mb-4">
            <Dumbbell className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">Reset Password</h1>
          <p className="text-muted-foreground mt-1">Enter your email and we&apos;ll send a reset link</p>
        </div>
        <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/70">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  className="pl-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:border-red-500 focus:ring-red-500/20 transition-colors" />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white border-0 font-bold shadow-lg shadow-red-600/25" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground/70 hover:text-foreground/50 inline-flex items-center gap-1 transition-colors">
                <ArrowLeft className="h-3 w-3" />Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

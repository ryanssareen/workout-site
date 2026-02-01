'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, findCoachByCode, signInWithGoogle } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

export function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: '' as UserRole | '',
    coachCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

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
        console.log('🔍 Looking for coach with code:', formData.coachCode);
        const coach = await findCoachByCode(formData.coachCode);
        console.log('🔍 Found coach:', coach);
        if (!coach) {
          throw new Error(`Invalid coach code: "${formData.coachCode}". Please check and try again.`);
        }
        coachId = coach.uid;
        console.log('✅ Coach ID:', coachId);
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Sign up to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Full Name</Label>
            <Input 
              id="displayName" 
              type="text" 
              placeholder="John Doe" 
              value={formData.displayName} 
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} 
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@example.com" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={formData.password} 
              onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
              required 
              minLength={6} 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">I am a...</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.role === 'student' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="coachCode">Coach Code</Label>
                <span className="text-xs text-muted-foreground">(Optional)</span>
              </div>
              <Input
                id="coachCode"
                type="text"
                placeholder="Enter 6-letter code from your coach"
                value={formData.coachCode}
                onChange={(e) => setFormData({ ...formData, coachCode: e.target.value.toUpperCase() })}
                maxLength={6}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Don't have a code? No problem! You can connect to your coach later in Settings.
              </p>
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={loading || googleLoading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-medium"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-3">
            Google sign-up creates an athlete account by default.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

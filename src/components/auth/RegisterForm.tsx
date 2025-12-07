'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserRole } from '@/types';

export function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '', password: '', displayName: '', role: '' as UserRole | '', coachId: '',
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.role) throw new Error('Please select a role');
      await createUser(formData.email, formData.password, formData.displayName, formData.role, formData.role === 'student' ? formData.coachId : undefined);
      toast.success('Account created successfully');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Create Account</CardTitle><CardDescription>Sign up to get started</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="displayName">Full Name</Label><Input id="displayName" type="text" placeholder="John Doe" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} /></div>
          <div className="space-y-2"><Label htmlFor="role">I am a...</Label>
            <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent><SelectItem value="coach">Coach</SelectItem><SelectItem value="student">Student</SelectItem></SelectContent>
            </Select>
          </div>
          {formData.role === 'student' && (
            <div className="space-y-2"><Label htmlFor="coachId">Coach ID (optional)</Label><Input id="coachId" type="text" placeholder="Enter your coach's ID" value={formData.coachId} onChange={(e) => setFormData({ ...formData, coachId: e.target.value })} /></div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating account...' : 'Sign Up'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { RegisterForm } from '@/components/auth/RegisterForm';
import Link from 'next/link';

/**
 * Registration page
 * 
 * Layout structure:
 * - Centered card with registration form
 * - Link to login for existing users
 * - Minimal branding (logo + title)
 * 
 * Registration handled by RegisterForm component
 * Redirects to /dashboard on successful account creation
 */
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-muted-foreground mt-2">
            Sign up to start tracking workouts
          </p>
        </div>
        
        <RegisterForm />
        
        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

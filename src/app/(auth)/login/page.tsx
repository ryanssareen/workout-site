import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

/**
 * Login page
 * 
 * Layout structure:
 * - Centered card with login form
 * - Link to registration for new users
 * - Minimal branding (logo + title)
 * 
 * Authentication handled by LoginForm component
 * Redirects to /dashboard on successful login
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your Workout Tracker account
          </p>
        </div>
        
        <LoginForm />
        
        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { RegisterForm } from '@/components/auth/RegisterForm';

interface RegisterPageProps {
  searchParams?: { role?: string | string[] };
}

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const preselectedRole = Array.isArray(searchParams?.role) ? searchParams?.role[0] : searchParams?.role;

  // Map 'athlete' to 'student' (internal role name)
  const initialRole = preselectedRole === 'coach' ? 'coach' : preselectedRole === 'athlete' ? 'student' : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/15 rounded-full blur-[100px]" />
      </div>
      <RegisterForm initialRole={initialRole} />
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, UserPlus, LogIn } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center relative overflow-hidden">
      {/* Decorative gradient blur orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* 404 display */}
        <h1 className="text-[10rem] font-extrabold leading-none tracking-tighter bg-gradient-to-r from-red-500 via-red-600 to-red-400 bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Heading */}
        <h2 className="text-2xl font-semibold mt-2 mb-3">Page not found</h2>

        {/* Subtitle */}
        <p className="text-muted-foreground mb-8 text-base leading-relaxed">
          Not what you were looking for? Register or sign in — it&apos;s free
          and you can delete your account anytime.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 w-full sm:w-auto"
          >
            <Link href="/register">
              <UserPlus className="mr-2 h-4 w-4" />
              Get Started
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-border w-full sm:w-auto">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Link>
          </Button>
        </div>

        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  );
}

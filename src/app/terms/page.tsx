import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, ScrollText } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export const metadata = {
  title: 'Terms of Service | The Daily Athlete',
  description: 'Terms of Service for The Daily Athlete — rules and guidelines for using our platform.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'March 26, 2026';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-lg">The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Home</Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Privacy</Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Contact</Link>
            <ThemeToggle />
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 ml-2">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-600/8 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-red-600/10 mb-6">
                <ScrollText className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
                Terms of <span className="bg-gradient-to-r from-red-400 to-red-200 bg-clip-text text-transparent">Service</span>
              </h1>
              <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using The Daily Athlete (&quot;the Service&quot;), operated by Ryan Sareen, you agree
                  to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not
                  use the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. Changes take effect when posted on this page.
                  Continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Daily Athlete is a multi-sport workout tracking platform that allows you to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Log and track workouts across multiple sports (running, cycling, swimming, walking, strength training)</li>
                  <li>Sync workout data from third-party services including Strava</li>
                  <li>View training analytics, progress reports, and AI-generated insights</li>
                  <li>Set goals, track personal records, and monitor training trends</li>
                  <li>Share training summaries (weekly wraps, monthly reviews, yearly wrapped)</li>
                  <li>Import workout history from CSV/XLSX files</li>
                  <li>Receive AI-powered workout suggestions and coaching</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">3. Account Registration</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To use the Service, you must create an account. You agree to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Provide accurate and complete information during registration</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                  <li>Accept responsibility for all activity under your account</li>
                  <li>Not create multiple accounts or impersonate others</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Usernames must be 3–20 characters, lowercase letters, numbers, and underscores only. We reserve the
                  right to reject or reclaim usernames that are offensive, misleading, or conflict with reserved words.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">4. Third-Party Integrations</h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">4.1 Strava</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you connect your Strava account, you authorize us to access your Strava activity data via the
                  Strava API. Your use of Strava is governed by <a href="https://www.strava.com/legal/terms" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Strava&apos;s Terms of Service</a>.
                  You may disconnect Strava at any time from your Settings page.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">4.2 General</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We are not responsible for the availability, accuracy, or functionality of third-party services.
                  Third-party services may change their APIs, rate limits, or terms at any time, which may affect
                  the Service&apos;s functionality.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">5. Acceptable Use</h2>
                <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Use the Service for any unlawful purpose</li>
                  <li>Attempt to gain unauthorized access to the Service or other accounts</li>
                  <li>Interfere with or disrupt the Service or its infrastructure</li>
                  <li>Upload malicious content, viruses, or harmful code</li>
                  <li>Use automated scripts, bots, or scraping tools to access the Service</li>
                  <li>Abuse API rate limits or intentionally exhaust service quotas</li>
                  <li>Misrepresent your identity or use offensive usernames or content</li>
                  <li>Use the Service to harass, bully, or harm other users</li>
                  <li>Reverse engineer, decompile, or attempt to extract source code from the Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">6. User Content</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You retain ownership of all content you create or upload to the Service (workouts, notes, photos, comments).
                  By using the Service, you grant us a limited, non-exclusive license to store, process, and display your
                  content as necessary to operate the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Content shared via public profiles or share features (weekly wraps, monthly reviews) is visible to anyone
                  with the link. You are responsible for the content you make public.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">7. AI Features</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service includes AI-powered features (workout suggestions, training reports, coaching insights)
                  powered by third-party AI models (Groq/LLaMA). You acknowledge that:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>AI-generated content is for informational purposes only and does not constitute medical, fitness, or health advice</li>
                  <li>AI suggestions may not be appropriate for your specific health conditions or fitness level</li>
                  <li>You should consult a qualified professional before starting any new exercise program</li>
                  <li>We are not liable for any injury or harm resulting from following AI-generated suggestions</li>
                  <li>AI outputs may contain errors or inaccuracies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">8. Service Availability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is provided &quot;as is&quot; and &quot;as available.&quot; We do not guarantee uninterrupted
                  or error-free operation. We may:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Modify, suspend, or discontinue features at any time</li>
                  <li>Perform maintenance that temporarily affects availability</li>
                  <li>Impose usage limits or rate limits as needed</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  The Service currently operates on a free tier with the following resource limitations:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Database:</strong> Shared daily read quota across all users (currently 50,000 reads/day). During peak usage, some features may temporarily show cached data or be unavailable.</li>
                  <li><strong>AI Features:</strong> Workout suggestions and AI reports are subject to third-party API rate limits (approximately 100,000 tokens/day). When limits are reached, AI features may be temporarily unavailable.</li>
                  <li><strong>Storage:</strong> Profile photos and backups are subject to storage quotas. Large file uploads may be restricted.</li>
                  <li><strong>Strava Sync:</strong> Subject to Strava&apos;s API rate limits (100 requests per 15 minutes, 1,000 per day per application).</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  These limits may change at our discretion. We will make reasonable efforts to notify users of significant changes. The introduction of paid tiers in the future will not remove or degrade features currently available on the free tier without notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">9. Account Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to suspend or terminate your account if you violate these Terms, abuse the Service,
                  or engage in activity that threatens other users or our infrastructure. You may delete your account at
                  any time by contacting us. Upon deletion:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Your profile and workout data will be permanently deleted within 30 days</li>
                  <li>Third-party service connections will be revoked</li>
                  <li>This action cannot be undone</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">10. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless The Daily Athlete, its operator, and affiliates from
                  any claims, damages, losses, liabilities, costs, or expenses (including reasonable attorney&apos;s fees)
                  arising from:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Your use of the Service or violation of these Terms</li>
                  <li>Content you create, upload, or make publicly available through the Service</li>
                  <li>Your violation of any rights of a third party</li>
                  <li>Misuse of your account credentials or unauthorized sharing of your account</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">11. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by applicable law (including the Consumer Protection Act, 2019 and the
                  Indian Contract Act, 1872), The Daily Athlete and its operator shall not be liable for any indirect,
                  incidental, special, consequential, or punitive damages arising from your use of the Service, including
                  but not limited to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Loss of data, workouts, or training history</li>
                  <li>Inability to access the Service or third-party integrations</li>
                  <li>Injuries resulting from following workout suggestions or AI-generated content</li>
                  <li>Inaccuracies in synced data from third-party services</li>
                  <li>Unauthorized access to your account due to credential compromise</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  In no event shall our total liability exceed the amount paid by you to us (if any) in the 12 months
                  preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">12. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
                  express or implied, including but not limited to warranties of merchantability, fitness for a particular
                  purpose, or non-infringement. We do not warrant that the Service will be available, secure, or error-free.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">13. Dispute Resolution</h2>
                <p className="text-muted-foreground leading-relaxed">
                  In the event of any dispute arising from or relating to these Terms or your use of the Service, the
                  parties agree to the following resolution process:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Step 1 — Informal Resolution:</strong> You agree to first contact us at{' '}
                    <a href="mailto:ryanssareen@gmail.com" className="text-red-400 hover:text-red-300 underline">ryanssareen@gmail.com</a>{' '}
                    and attempt to resolve the dispute informally within 30 days.</li>
                  <li><strong>Step 2 — Mediation:</strong> If informal resolution fails, the parties agree to attempt
                    mediation through a mutually agreed mediator before pursuing litigation.</li>
                  <li><strong>Step 3 — Arbitration:</strong> If mediation fails, the dispute shall be referred to and
                    resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996, as amended.
                    The arbitration shall be conducted by a sole arbitrator mutually appointed by both parties. The
                    seat of arbitration shall be New Delhi, India. The language of arbitration shall be English.
                    The arbitral award shall be final and binding.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Nothing in this section prevents either party from seeking interim or injunctive relief from a court
                  of competent jurisdiction where necessary.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">14. Governing Law &amp; Jurisdiction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of India, including the
                  Information Technology Act, 2000, the Indian Contract Act, 1872, and the Consumer Protection Act, 2019,
                  without regard to conflict of law principles. Subject to the dispute resolution process above, any legal
                  proceedings shall be brought exclusively in the courts of New Delhi, India.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">15. Contact</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about these Terms, contact us at:
                </p>
                <div className="mt-3 p-4 rounded-xl bg-foreground/5 border border-border/30">
                  <p className="text-foreground font-medium">Ryan Sareen</p>
                  <p className="text-muted-foreground text-sm">The Daily Athlete</p>
                  <p className="text-muted-foreground text-sm">
                    Email: <a href="mailto:ryanssareen@gmail.com" className="text-red-400 hover:text-red-300 underline">ryanssareen@gmail.com</a>
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-3 text-sm">
                  We review these Terms at least annually. Existing users will be notified via email of any material changes.
                </p>
              </section>

            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">Contact</Link>
            <p className="text-sm text-muted-foreground/70">&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

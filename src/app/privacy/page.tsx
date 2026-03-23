import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export const metadata = {
  title: 'Privacy Policy | The Daily Athlete',
  description: 'Privacy Policy for The Daily Athlete — how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'March 23, 2026';

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
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Terms</Link>
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
                <Shield className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
                Privacy <span className="bg-gradient-to-r from-red-400 to-red-200 bg-clip-text text-transparent">Policy</span>
              </h1>
              <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Daily Athlete (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a workout tracking platform operated by Ryan Sareen.
                  This Privacy Policy explains how we collect, use, store, and protect your personal information when you
                  use our website and services at <strong>thedailyathlete.in</strong> (the &quot;Service&quot;).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  By using the Service, you agree to the collection and use of information in accordance with this policy.
                  If you do not agree, please do not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">2. Information We Collect</h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.1 Account Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you create an account, we collect your email address, display name, and username. If you sign in
                  with Google, we receive your name, email, and profile photo from Google.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.2 Profile Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may optionally provide additional profile data such as age range, experience level, height, weight,
                  sport preferences, training goals, bio, and profile photo.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.3 Workout Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We store workout data you create manually, import via CSV/XLSX, or sync from third-party services.
                  This includes workout type, date, duration, distance, pace, heart rate, elevation, calories,
                  laps/splits, and any notes or descriptions you add.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.4 Third-Party Service Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you connect third-party fitness services, we access and store data from those platforms:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>
                    <strong>Strava:</strong> Activity summaries, detailed activity data (distance, duration, pace, heart rate,
                    elevation, laps, splits, photos), and activity metadata. We access this data via the Strava API using
                    OAuth 2.0 authorization that you explicitly grant.
                  </li>
                  <li>
                    <strong>Garmin Connect:</strong> Activity summaries, detailed activity data (distance, duration, heart rate,
                    elevation, steps, calories, stress, Body Battery, sleep data, and training metrics). We access this data
                    via the Garmin Health API and/or Garmin Connect API using OAuth authorization that you explicitly grant.
                    Garmin data is used solely to display your workouts and training insights within the Service.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You can disconnect any third-party service at any time from your Settings page, which revokes our access
                  to new data from that service.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.5 Usage Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We collect anonymized product analytics via PostHog to understand how the Service is used and to improve it.
                  This may include pages visited, features used, and general interaction patterns. We do not sell or share
                  this data with third parties for advertising purposes.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2.6 Push Notification Tokens</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If you opt in to push notifications, we store your device&apos;s push subscription endpoint to send
                  you workout reminders, sync completion alerts, and weekly summaries. You can opt out at any time.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed">We use your data to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Provide, maintain, and improve the Service</li>
                  <li>Display your workout history, stats, progress, and training insights</li>
                  <li>Generate AI-powered workout suggestions, reports, and coaching insights</li>
                  <li>Sync and merge workout data from connected third-party services (Strava, Garmin)</li>
                  <li>Send you email summaries, weekly wraps, and push notifications (with your consent)</li>
                  <li>Detect and prevent abuse, fraud, or unauthorized access</li>
                  <li>Generate anonymized aggregate statistics about platform usage</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">4. Data Storage and Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your data is stored in Google Cloud Firestore (Firebase) and Vercel infrastructure. We use industry-standard
                  security measures including:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>Firebase Authentication with secure session management</li>
                  <li>HTTPS encryption for all data in transit</li>
                  <li>Firestore Security Rules restricting data access to authenticated users</li>
                  <li>OAuth 2.0 for all third-party service connections (no passwords stored)</li>
                  <li>Regular automated backups with integrity verification</li>
                  <li>HttpOnly, SameSite cookies for admin session management</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  While we take reasonable measures to protect your data, no method of electronic transmission or storage
                  is 100% secure. We cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">5. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service integrates with the following third-party services. Each has its own privacy policy:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Firebase (Google):</strong> Authentication, database, and storage — <a href="https://firebase.google.com/support/privacy" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>Vercel:</strong> Hosting and deployment — <a href="https://vercel.com/legal/privacy-policy" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>Strava:</strong> Workout sync — <a href="https://www.strava.com/legal/privacy" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>Garmin:</strong> Workout sync — <a href="https://www.garmin.com/en-US/privacy/connect/" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>Groq:</strong> AI-powered insights and suggestions — <a href="https://groq.com/privacy-policy/" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>PostHog:</strong> Product analytics — <a href="https://posthog.com/privacy" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                  <li><strong>Brevo:</strong> Email delivery — <a href="https://www.brevo.com/legal/privacypolicy/" className="text-red-400 hover:text-red-300 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  When you use AI features (workout suggestions, reports, coaching), your workout data may be sent to
                  Groq for processing. We do not send personally identifiable information (name, email) to AI providers —
                  only anonymized workout metrics.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">6. Garmin Data Usage</h2>
                <p className="text-muted-foreground leading-relaxed">
                  When you connect your Garmin account, the following specific terms apply:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li>We access Garmin data only after you explicitly authorize via Garmin&apos;s OAuth flow</li>
                  <li>Garmin data is used exclusively to display your workouts, compute training analytics, and provide personalized insights within The Daily Athlete</li>
                  <li>We do not sell, rent, or share your Garmin data with any third parties</li>
                  <li>We do not use Garmin data for advertising or marketing purposes</li>
                  <li>Garmin data is stored securely in our database and is accessible only to you (and administrators for support purposes)</li>
                  <li>You may disconnect Garmin and request deletion of all Garmin-sourced data at any time</li>
                  <li>We comply with all Garmin API Terms of Use and data handling requirements</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">7. Data Sharing</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do <strong>not</strong> sell, rent, or trade your personal data. We may share data only in these limited cases:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Public profiles:</strong> If you enable your public profile, your display name, username, bio, workout stats, and profile photo are visible to anyone with your profile link.</li>
                  <li><strong>Service providers:</strong> We use third-party services (listed above) to operate the platform. They process data on our behalf under their respective privacy policies.</li>
                  <li><strong>Legal requirements:</strong> We may disclose data if required by law, legal process, or government request.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">8. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed">You have the right to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Access:</strong> View all data we hold about you through your profile and settings pages</li>
                  <li><strong>Export:</strong> Request a full export of your data in JSON format</li>
                  <li><strong>Correction:</strong> Update your profile information at any time through Settings</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and all associated data by contacting us</li>
                  <li><strong>Disconnect:</strong> Revoke access to any connected third-party service at any time</li>
                  <li><strong>Opt out:</strong> Disable push notifications, email summaries, and analytics tracking</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  To exercise any of these rights, contact us at <a href="mailto:ryanssareen@gmail.com" className="text-red-400 hover:text-red-300 underline">ryanssareen@gmail.com</a>.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">9. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your data for as long as your account is active. If you delete your account, we will delete
                  your personal data within 30 days, except where we are required to retain it for legal or legitimate
                  business purposes (e.g., backup integrity, fraud prevention). Automated backups containing your data
                  are pruned on a regular schedule (daily backups kept for 7 days, weekly for 4 weeks, monthly for 12 months).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">10. Children&apos;s Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is not intended for children under 13 years of age. We do not knowingly collect personal
                  information from children under 13. If you believe we have collected data from a child under 13,
                  please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">11. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by
                  posting the new policy on this page and updating the &quot;Last updated&quot; date. Continued use of
                  the Service after changes constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-3">12. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about this Privacy Policy or our data practices, contact us at:
                </p>
                <div className="mt-3 p-4 rounded-xl bg-foreground/5 border border-border/30">
                  <p className="text-foreground font-medium">Ryan Sareen</p>
                  <p className="text-muted-foreground text-sm">The Daily Athlete</p>
                  <p className="text-muted-foreground text-sm">
                    Email: <a href="mailto:ryanssareen@gmail.com" className="text-red-400 hover:text-red-300 underline">ryanssareen@gmail.com</a>
                  </p>
                </div>
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
            <Link href="/terms" className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">Terms of Service</Link>
            <Link href="/contact" className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">Contact</Link>
            <p className="text-sm text-muted-foreground/70">&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

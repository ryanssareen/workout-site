import 'package:flutter/cupertino.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Privacy Policy'),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Privacy Policy',
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 28),
            ),
            const SizedBox(height: 4),
            Text(
              'Last updated: April 2026',
              style: TextStyle(
                fontSize: 13,
                color: CupertinoColors.systemGrey.resolveFrom(context),
              ),
            ),
            const SizedBox(height: 24),
            _section('Account Data',
                'We collect your email address and display name when you create an account. This information is used solely for authentication and personalization within the app.'),
            _section('Workout Data',
                'All workout data you enter (type, duration, distance, notes) is stored securely in Firebase Firestore. Your data is associated with your account and is not shared with third parties.'),
            _section('Third-Party Integrations',
                'If you connect Strava, we access your activity data (workouts, heart rate, routes) via their API. We never post to your Strava account. You can disconnect at any time from Settings.'),
            _section('AI Features',
                'Workout suggestions and reports are generated using Groq AI (LLaMA models). Your workout data is sent to generate personalized insights. No personal identifying information is included.'),
            _section('Analytics',
                'We use PostHog for product analytics to understand how features are used. This data is anonymized and used to improve the app experience.'),
            _section('Data Storage',
                'Your data is stored in Google Firebase (Firestore) with server-side security rules. Backups are stored in Vercel Blob storage. All data is encrypted in transit via HTTPS.'),
            _section('Your Rights',
                'You can export your data, request deletion of your account and all associated data, or modify your profile information at any time through the app settings.'),
            _section('Data Retention',
                'Your data is retained for as long as your account is active. If you delete your account, all associated data is permanently removed within 30 days.'),
            _section('Contact',
                'For privacy-related questions, contact us through the app or visit thedailyathlete.in/contact.'),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: const TextStyle(fontSize: 15, height: 1.5),
          ),
        ],
      ),
    );
  }
}

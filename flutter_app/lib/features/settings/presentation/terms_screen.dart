import 'package:flutter/cupertino.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Terms of Service'),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Terms of Service',
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
            _section('Acceptance',
                'By using The Daily Athlete, you agree to these terms. If you do not agree, please do not use the service.'),
            _section('Account',
                'You are responsible for maintaining the security of your account credentials. You must provide accurate information when creating an account.'),
            _section('Acceptable Use',
                'You agree to use the service for personal workout tracking only. You may not use the service for any illegal or unauthorized purpose, attempt to gain unauthorized access, or interfere with other users.'),
            _section('Workout Data',
                'You retain ownership of all workout data you create. By using the service, you grant us permission to store and process this data to provide the service.'),
            _section('Third-Party Integrations',
                'Strava and Garmin integrations are subject to their respective terms of service. We are not responsible for third-party service availability or data accuracy.'),
            _section('AI Features',
                'Workout suggestions and AI-generated reports are for informational purposes only. They should not replace professional coaching or medical advice. Use AI recommendations at your own risk.'),
            _section('Service Availability',
                'We aim to provide reliable service but do not guarantee 100% uptime. We may modify or discontinue features with reasonable notice.'),
            _section('Account Termination',
                'We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through Settings.'),
            _section('Limitation of Liability',
                'The Daily Athlete is provided "as is" without warranty. We are not liable for any injuries, losses, or damages resulting from use of the service or reliance on AI-generated content.'),
            _section('Changes',
                'We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.'),
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

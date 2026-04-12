import 'package:flutter/cupertino.dart';


class StravaScreen extends StatelessWidget {
  const StravaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Strava'),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 20),

            // Strava logo area
            Center(
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFFC4C02).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Center(
                  child: Text(
                    '\u{1F3C3}',
                    style: TextStyle(fontSize: 40),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            const Center(
              child: Text(
                'Connect Strava',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text(
                'Sync your activities automatically',
                style: TextStyle(
                  fontSize: 15,
                  color: CupertinoColors.systemGrey.resolveFrom(context),
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Benefits
            _BenefitRow(
              icon: CupertinoIcons.arrow_2_circlepath,
              title: 'Auto-sync workouts',
              subtitle: 'Activities appear automatically after upload',
            ),
            const SizedBox(height: 16),
            _BenefitRow(
              icon: CupertinoIcons.heart_fill,
              title: 'Heart rate & stats',
              subtitle: 'Import HR, pace, power, and elevation data',
            ),
            const SizedBox(height: 16),
            _BenefitRow(
              icon: CupertinoIcons.map_fill,
              title: 'Route maps',
              subtitle: 'See your workout routes on a map',
            ),
            const SizedBox(height: 16),
            _BenefitRow(
              icon: CupertinoIcons.photo_fill,
              title: 'Photos',
              subtitle: 'Activity photos sync with your workouts',
            ),

            const SizedBox(height: 40),

            // Connect button
            CupertinoButton(
              color: const Color(0xFFFC4C02),
              borderRadius: BorderRadius.circular(14),
              onPressed: () {
                showCupertinoDialog<void>(
                  context: context,
                  builder: (ctx) => CupertinoAlertDialog(
                    title: const Text('Strava Connect'),
                    content: const Text(
                      'Strava OAuth requires opening a browser. This will be available in the next update with deep linking support.',
                    ),
                    actions: [
                      CupertinoDialogAction(
                        child: const Text('OK'),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                );
              },
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Connect with Strava',
                    style: TextStyle(
                      color: CupertinoColors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 17,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            Center(
              child: Text(
                'We only read your activity data.\nWe never post to your Strava account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: CupertinoColors.systemGrey2.resolveFrom(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _BenefitRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFFC4C02).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: const Color(0xFFFC4C02), size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style:
                      const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 13,
                  color: CupertinoColors.systemGrey.resolveFrom(context),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

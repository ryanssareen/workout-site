import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final brightness = CupertinoTheme.of(context).brightness;
    final isDark = brightness == Brightness.dark;
    final textColor = isDark ? CupertinoColors.white : CupertinoColors.black;
    final mutedColor = CupertinoColors.systemGrey.resolveFrom(context);

    return CupertinoPageScaffold(
      child: Stack(
        children: [
          // Ambient gradient blobs
          Positioned(
            top: -60,
            right: -40,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.primaryRed.withValues(alpha: 0.12),
                    AppTheme.primaryRed.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 500,
            left: -80,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFF6B00).withValues(alpha: 0.08),
                    const Color(0xFFFF6B00).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),

          // Scrollable content
          SafeArea(
            child: Column(
              children: [
                // Fixed top bar
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: textColor,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          CupertinoIcons.sportscourt,
                          color: isDark
                              ? CupertinoColors.black
                              : CupertinoColors.white,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'The Daily Athlete',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: textColor,
                        ),
                      ),
                    ],
                  ),
                ),

                // Scrollable body
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      const SizedBox(height: 40),

                      // ── Hero section ──
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color:
                                    AppTheme.primaryRed.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppTheme.primaryRed
                                      .withValues(alpha: 0.2),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(CupertinoIcons.flame_fill,
                                      color: AppTheme.primaryRed, size: 14),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Free during early access',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: isDark
                                          ? const Color(0xFFF87171)
                                          : const Color(0xFFEF4444),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),

                            // Headline
                            Text(
                              'Your training,',
                              style: TextStyle(
                                fontSize: 36,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -1,
                                height: 1.1,
                                color: textColor,
                              ),
                            ),
                            ShaderMask(
                              shaderCallback: (bounds) =>
                                  const LinearGradient(
                                colors: [
                                  Color(0xFFEF4444),
                                  Color(0xFFDC2626),
                                  Color(0xFFF87171),
                                ],
                              ).createShader(bounds),
                              child: const Text(
                                'all in one place.',
                                style: TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -1,
                                  height: 1.1,
                                  color: CupertinoColors.white,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            Text(
                              'Track workouts across every sport, sync with Strava, and stay on top of your training.',
                              style: TextStyle(
                                fontSize: 17,
                                height: 1.5,
                                color: mutedColor,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 28),

                      // Sport pills
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: const [
                            _SportPill(
                                emoji: '\u{1F3CA}', label: 'Swimming'),
                            _SportPill(
                                emoji: '\u{1F3C3}', label: 'Running'),
                            _SportPill(
                                emoji: '\u{1F6B4}', label: 'Cycling'),
                            _SportPill(
                                emoji: '\u{1F3CB}', label: 'Strength'),
                            _SportPill(
                                emoji: '\u{1F3C5}', label: 'Triathlon'),
                          ],
                        ),
                      ),

                      const SizedBox(height: 40),

                      // CTA buttons
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Column(
                          children: [
                            SizedBox(
                              width: double.infinity,
                              height: 52,
                              child: CupertinoButton(
                                color: AppTheme.primaryRed,
                                borderRadius: BorderRadius.circular(14),
                                onPressed: () => context.go('/register'),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'Start for free',
                                      style: TextStyle(
                                        color: CupertinoColors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 17,
                                      ),
                                    ),
                                    SizedBox(width: 8),
                                    Icon(CupertinoIcons.arrow_right,
                                        color: CupertinoColors.white,
                                        size: 18),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              height: 52,
                              child: CupertinoButton(
                                borderRadius: BorderRadius.circular(14),
                                color: isDark
                                    ? CupertinoColors.systemGrey5.darkColor
                                    : CupertinoColors.systemGrey6,
                                onPressed: () => context.go('/login'),
                                child: Text(
                                  'I have an account',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 17,
                                    color: textColor,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 48),

                      // ── How it Works ──
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        decoration: BoxDecoration(
                          color: CupertinoColors.systemGrey6
                              .resolveFrom(context)
                              .withValues(alpha: 0.5),
                          border: Border.symmetric(
                            horizontal: BorderSide(
                              color: CupertinoColors.separator
                                  .resolveFrom(context),
                              width: 0.5,
                            ),
                          ),
                        ),
                        child: Column(
                          children: [
                            Text(
                              'Get started in minutes',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: textColor,
                              ),
                            ),
                            const SizedBox(height: 32),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 28),
                              child: Column(
                                children: [
                                  _StepItem(
                                    number: '1',
                                    title: 'Create your account',
                                    description:
                                        'Sign up free and set your sports and goals.',
                                  ),
                                  const SizedBox(height: 24),
                                  _StepItem(
                                    number: '2',
                                    title: 'Connect Strava',
                                    description:
                                        'Link your watch so workouts sync automatically.',
                                  ),
                                  const SizedBox(height: 24),
                                  _StepItem(
                                    number: '3',
                                    title: 'Train & improve',
                                    description:
                                        'Log sessions, track PRs, and build consistency.',
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 40),

                      // ── Features ──
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Column(
                          children: [
                            Text(
                              'Everything you need to train smarter',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: textColor,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Simple tools that help you stay consistent and see progress.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                color: mutedColor,
                              ),
                            ),
                            const SizedBox(height: 24),
                            _FeatureCard(
                              icon: CupertinoIcons.arrow_2_circlepath,
                              title: 'Strava Sync',
                              description:
                                  'Workouts auto-complete when you train. Garmin, Apple Watch, or any Strava device.',
                            ),
                            const SizedBox(height: 12),
                            _FeatureCard(
                              icon: CupertinoIcons.calendar,
                              title: 'Visual Calendar',
                              description:
                                  'See your whole week at a glance. Plan ahead and never miss a session.',
                            ),
                            const SizedBox(height: 12),
                            _FeatureCard(
                              icon: CupertinoIcons.graph_circle,
                              title: 'Progress Tracking',
                              description:
                                  'Track personal records, view trends, and watch your fitness build over time.',
                            ),
                            const SizedBox(height: 12),
                            _FeatureCard(
                              icon: CupertinoIcons.lightbulb,
                              title: 'AI Coach',
                              description:
                                  'Get personalized workout suggestions based on your history and goals.',
                            ),
                            const SizedBox(height: 12),
                            _FeatureCard(
                              icon: CupertinoIcons.sportscourt,
                              title: 'Multi-Sport',
                              description:
                                  'Running, swimming, cycling, strength \u2014 all your training in one app.',
                            ),
                            const SizedBox(height: 12),
                            _FeatureCard(
                              icon: CupertinoIcons.bell,
                              title: 'Email Reminders',
                              description:
                                  'Get notified about upcoming workouts so you stay on track.',
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 48),

                      // ── Final CTA ──
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        decoration: BoxDecoration(
                          color: CupertinoColors.systemGrey6
                              .resolveFrom(context)
                              .withValues(alpha: 0.5),
                          border: Border(
                            top: BorderSide(
                              color: CupertinoColors.separator
                                  .resolveFrom(context),
                              width: 0.5,
                            ),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 28),
                          child: Column(
                            children: [
                              Text(
                                'Ready to start training?',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: textColor,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Join athletes who track every session. Free to use, no credit card.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 16,
                                  color: mutedColor,
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 24),
                              SizedBox(
                                width: double.infinity,
                                height: 52,
                                child: CupertinoButton(
                                  color: AppTheme.primaryRed,
                                  borderRadius: BorderRadius.circular(14),
                                  onPressed: () => context.go('/register'),
                                  child: const Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'Get started free',
                                        style: TextStyle(
                                          color: CupertinoColors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 17,
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Icon(CupertinoIcons.arrow_right,
                                          color: CupertinoColors.white,
                                          size: 18),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // ── Footer ──
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 28, vertical: 24),
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: CupertinoColors.separator
                                  .resolveFrom(context),
                              width: 0.5,
                            ),
                          ),
                        ),
                        child: Column(
                          children: [
                            // Logo
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: textColor,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    CupertinoIcons.sportscourt,
                                    color: isDark
                                        ? CupertinoColors.black
                                        : CupertinoColors.white,
                                    size: 14,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'The Daily Athlete',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: mutedColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            // Links
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _FooterLink(
                                  label: 'Features',
                                  onTap: () => _openUrl(
                                      'https://www.thedailyathlete.in/features'),
                                ),
                                _FooterDot(),
                                _FooterLink(
                                  label: 'Privacy',
                                  onTap: () => _openUrl(
                                      'https://www.thedailyathlete.in/privacy'),
                                ),
                                _FooterDot(),
                                _FooterLink(
                                  label: 'Terms',
                                  onTap: () => _openUrl(
                                      'https://www.thedailyathlete.in/terms'),
                                ),
                                _FooterDot(),
                                _FooterLink(
                                  label: 'Contact',
                                  onTap: () => _openUrl(
                                      'https://www.thedailyathlete.in/contact'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              '\u00A9 2026 The Daily Athlete',
                              style: TextStyle(
                                fontSize: 12,
                                color: mutedColor.withValues(alpha: 0.6),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ---------------------------------------------------------------------------
// Sport pill
// ---------------------------------------------------------------------------

class _SportPill extends StatelessWidget {
  final String emoji;
  final String label;

  const _SportPill({required this.emoji, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: CupertinoColors.separator.resolveFrom(context),
          width: 0.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: CupertinoColors.systemGrey.resolveFrom(context),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// How it Works step
// ---------------------------------------------------------------------------

class _StepItem extends StatelessWidget {
  final String number;
  final String title;
  final String description;

  const _StepItem({
    required this.number,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppTheme.primaryRed.withValues(alpha: 0.1),
            border: Border.all(
              color: AppTheme.primaryRed.withValues(alpha: 0.25),
            ),
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryRed,
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(
                  fontSize: 14,
                  color: CupertinoColors.systemGrey.resolveFrom(context),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

class _FeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: CupertinoColors.systemBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: CupertinoColors.separator.resolveFrom(context),
          width: 0.5,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.primaryRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppTheme.primaryRed, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 14,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Footer widgets
// ---------------------------------------------------------------------------

class _FooterLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _FooterLink({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      minSize: 0,
      onPressed: onTap,
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          color: CupertinoColors.systemGrey.resolveFrom(context),
        ),
      ),
    );
  }
}

class _FooterDot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Text(
        '\u2022',
        style: TextStyle(
          fontSize: 8,
          color: CupertinoColors.systemGrey3.resolveFrom(context),
        ),
      ),
    );
  }
}

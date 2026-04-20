import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/workouts/data/workout_repository.dart';
import '../../../models/stats.dart';
import '../../../models/workout.dart';
import '../../../models/personal_record.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _reportsRepoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final _statsProvider = FutureProvider<UserStats>((ref) {
  return ref.watch(_reportsRepoProvider).getStats();
});

final _workoutsProvider = FutureProvider<List<Workout>>((ref) {
  return ref.watch(_reportsRepoProvider).getWorkouts(limit: 50);
});

final _prsProvider = FutureProvider<List<PersonalRecord>>((ref) {
  return ref.watch(_reportsRepoProvider).getPersonalRecords();
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    if (hour < 22) return 'Good evening';
    return 'Good night';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(_statsProvider);
    final workoutsAsync = ref.watch(_workoutsProvider);
    final userAsync = ref.watch(currentUserProvider);

    final userName = userAsync.valueOrNull?.displayName ?? 'Athlete';
    final firstName = userName.split(' ').first;

    return CupertinoPageScaffold(
      // No navigationBar — custom inline header like DashboardScreen
      child: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            CupertinoSliverRefreshControl(
              onRefresh: () async {
                ref.invalidate(_statsProvider);
                ref.invalidate(_workoutsProvider);
                ref.invalidate(_prsProvider);
              },
            ),

            // ── Header ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          CupertinoIcons.sparkles,
                          color: Color(0xFFF97316), // orange-500
                          size: 28,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Your Reports',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_greeting()}, $firstName',
                      style: TextStyle(
                        fontSize: 15,
                        color: CupertinoColors.systemGrey.resolveFrom(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── Zone 1: AI Insight Card ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: _AIInsightCard(
                  firstName: firstName,
                  statsAsync: statsAsync,
                  workoutsAsync: workoutsAsync,
                ),
              ),
            ),

            // ── Zone 2: Your Reports ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                child: Text(
                  'YOUR REPORTS',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 84,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    _ReportLink(
                      icon: CupertinoIcons.calendar,
                      gradientStart: const Color(0xFF3B82F6).withValues(alpha: 0.10),
                      gradientEnd: const Color(0xFF6366F1).withValues(alpha: 0.10),
                      borderColor: const Color(0xFF3B82F6).withValues(alpha: 0.20),
                      iconBg: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                      iconColor: const Color(0xFF3B82F6),
                      title: 'Weekly Wrap',
                      subtitle: 'Your weekly capsule',
                      reportType: 'wrap',
                    ),
                    const SizedBox(width: 10),
                    _ReportLink(
                      icon: CupertinoIcons.chart_bar_alt_fill,
                      gradientStart: const Color(0xFF10B981).withValues(alpha: 0.10),
                      gradientEnd: const Color(0xFF14B8A6).withValues(alpha: 0.10),
                      borderColor: const Color(0xFF10B981).withValues(alpha: 0.20),
                      iconBg: const Color(0xFF10B981).withValues(alpha: 0.15),
                      iconColor: const Color(0xFF10B981),
                      title: 'Monthly Review',
                      subtitle: statsAsync.whenOrNull(
                            data: (s) =>
                                '${s.thisWeek > 0 ? s.thisWeek : s.completed} workouts',
                          ) ??
                          'This month',
                      reportType: 'review',
                    ),
                    const SizedBox(width: 10),
                    _ReportLink(
                      icon: CupertinoIcons.star_fill,
                      gradientStart: const Color(0xFFA855F7).withValues(alpha: 0.10),
                      gradientEnd: const Color(0xFFEC4899).withValues(alpha: 0.10),
                      borderColor: const Color(0xFFA855F7).withValues(alpha: 0.20),
                      iconBg: const Color(0xFFA855F7).withValues(alpha: 0.15),
                      iconColor: const Color(0xFFA855F7),
                      title: 'Year in Review',
                      subtitle: '2025 Wrapped',
                      reportType: 'wrapped',
                    ),
                  ],
                ),
              ),
            ),

            // ── Zone 3: Explore Your Data ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                child: Text(
                  'EXPLORE YOUR DATA',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _ExploreGrid(
                  statsAsync: statsAsync,
                  workoutsAsync: workoutsAsync,
                ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Zone 1: AI Insight Card — orange gradient (matches web AIInsightCard.tsx)
// ---------------------------------------------------------------------------

class _AIInsightCard extends StatelessWidget {
  final String firstName;
  final AsyncValue<UserStats> statsAsync;
  final AsyncValue<List<Workout>> workoutsAsync;

  const _AIInsightCard({
    required this.firstName,
    required this.statsAsync,
    required this.workoutsAsync,
  });

  String _buildInsight() {
    final stats = statsAsync.valueOrNull;
    final workouts = workoutsAsync.valueOrNull;

    if (stats == null || workouts == null) {
      return 'Loading your training insights...';
    }

    final recentCount = workouts
        .where((w) =>
            w.completed &&
            w.date.isAfter(DateTime.now().subtract(const Duration(days: 7))))
        .length;

    if (recentCount >= 5) {
      return "You've been crushing it with $recentCount workouts this week! Keep the momentum going.";
    } else if (recentCount >= 3) {
      return 'Solid week so far with $recentCount sessions. You\'re building great consistency.';
    } else if (recentCount >= 1) {
      return 'You\'ve got $recentCount workout${recentCount == 1 ? '' : 's'} in this week. A few more sessions would build your streak.';
    } else {
      return 'Log a few more workouts and I\'ll start finding patterns in your training. Check back soon!';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFFF97316).withValues(alpha: 0.10), // orange-500/10
            const Color(0xFFF59E0B).withValues(alpha: 0.10), // amber-500/10
            const Color(0xFFEAB308).withValues(alpha: 0.06), // yellow-500/6
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFF97316).withValues(alpha: 0.20), // orange-500/20
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon box
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF97316).withValues(alpha: 0.20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Icon(
                CupertinoIcons.sparkles,
                color: Color(0xFFF97316),
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Today's Insight",
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _buildInsight(),
                  style: TextStyle(
                    fontSize: 14,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    height: 1.5,
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
// Zone 2: Report Link Cards — gradient + border per type
// ---------------------------------------------------------------------------

class _ReportLink extends StatelessWidget {
  final IconData icon;
  final Color gradientStart;
  final Color gradientEnd;
  final Color borderColor;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String reportType;

  const _ReportLink({
    required this.icon,
    required this.gradientStart,
    required this.gradientEnd,
    required this.borderColor,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.reportType,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/report/$reportType'),
      child: Container(
        width: 180,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [gradientStart, gradientEnd],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor, width: 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Icon box (36x36 = web's h-9 w-9)
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Icon(icon, color: iconColor, size: 18),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Zone 3: Explore Grid — single-column horizontal row cards
// ---------------------------------------------------------------------------

class _ExploreGrid extends StatelessWidget {
  final AsyncValue<UserStats> statsAsync;
  final AsyncValue<List<Workout>> workoutsAsync;

  const _ExploreGrid({
    required this.statsAsync,
    required this.workoutsAsync,
  });

  @override
  Widget build(BuildContext context) {
    final stats = statsAsync.valueOrNull;
    final workouts = workoutsAsync.valueOrNull;

    // Compute dynamic subtitles from real data
    String sportSubtitle = 'Dive into your top sport';
    String trendSubtitle = 'Compare your training volume';
    String goalSubtitle = 'Track your readiness and buildup';
    String recoverySubtitle = 'Check your training load';
    String prSubtitle = 'Track and visualize your PRs';
    String analysisSubtitle = 'Charts, breakdowns, and more';

    if (workouts != null && workouts.isNotEmpty) {
      final recent30 = workouts
          .where((w) => w.date
              .isAfter(DateTime.now().subtract(const Duration(days: 30))))
          .toList();
      final sportCounts = <WorkoutType, int>{};
      for (final w in recent30) {
        sportCounts[w.workoutType] = (sportCounts[w.workoutType] ?? 0) + 1;
      }
      if (sportCounts.isNotEmpty) {
        final topSport = sportCounts.entries
            .reduce((a, b) => a.value >= b.value ? a : b);
        sportSubtitle = '${topSport.value} sessions in the last 30 days';
      }

      final recent14 = workouts
          .where((w) => w.date
              .isAfter(DateTime.now().subtract(const Duration(days: 14))))
          .length;
      if (recent14 > 0) {
        recoverySubtitle = '$recent14 workouts in 14 days';
      }

      final now = DateTime.now();
      final thisMonthName = DateFormat('MMMM').format(now);
      final lastMonthName =
          DateFormat('MMMM').format(DateTime(now.year, now.month - 1));
      trendSubtitle = '$thisMonthName vs $lastMonthName';
    }

    if (stats != null && stats.total > 0) {
      analysisSubtitle = '${stats.total} workouts tracked';
    }

    return Column(
      children: [
        _ExploreCard(
          emoji: '\u{1F4AA}',
          title: 'Sport Deep Dive',
          subtitle: sportSubtitle,
          reportType: 'sport-deep-dive',
        ),
        const SizedBox(height: 8),
        _ExploreCard(
          emoji: '\u{1F4CA}',
          title: 'Trend Report',
          subtitle: trendSubtitle,
          reportType: 'trend-report',
        ),
        const SizedBox(height: 8),
        _ExploreCard(
          emoji: '\u{1F3AF}',
          title: 'Goal Tracker',
          subtitle: goalSubtitle,
          reportType: 'goal-tracker',
        ),
        const SizedBox(height: 8),
        _ExploreCard(
          emoji: '\u{2705}',
          title: 'Recovery Check',
          subtitle: recoverySubtitle,
          reportType: 'recovery-report',
        ),
        const SizedBox(height: 8),
        _ExploreCard(
          emoji: '\u{1F3C6}',
          title: 'Personal Records',
          subtitle: prSubtitle,
          reportType: 'pr-timeline',
        ),
        const SizedBox(height: 8),
        _ExploreCard(
          emoji: '\u{1F4C8}',
          title: 'Training Analysis',
          subtitle: analysisSubtitle,
          reportType: 'training-analysis',
        ),
      ],
    );
  }
}

class _ExploreCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final String reportType;

  const _ExploreCard({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.reportType,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/report/$reportType'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: CupertinoColors.systemBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: CupertinoColors.separator.resolveFrom(context),
            width: 0.5,
          ),
        ),
        child: Row(
          children: [
            // Emoji
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            // Title + subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Arrow
            Icon(
              CupertinoIcons.chevron_right,
              size: 14,
              color: CupertinoColors.systemGrey3.resolveFrom(context),
            ),
          ],
        ),
      ),
    );
  }
}

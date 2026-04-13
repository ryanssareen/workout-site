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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(_statsProvider);
    final workoutsAsync = ref.watch(_workoutsProvider);
    final userAsync = ref.watch(currentUserProvider);

    final userName = userAsync.valueOrNull?.displayName ?? 'Athlete';
    final firstName = userName.split(' ').first;

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Your Reports'),
      ),
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

            // Zone 1: AI Insight Card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: _AIInsightCard(
                  firstName: firstName,
                  statsAsync: statsAsync,
                  workoutsAsync: workoutsAsync,
                ),
              ),
            ),

            // Zone 2: Your Reports row
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
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
                height: 100,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    _ReportLink(
                      icon: CupertinoIcons.calendar,
                      color: const Color(0xFF6366F1),
                      title: 'Weekly Wrap',
                      subtitle: 'Your weekly capsule',
                      reportType: 'wrap',
                    ),
                    const SizedBox(width: 10),
                    _ReportLink(
                      icon: CupertinoIcons.chart_bar_alt_fill,
                      color: const Color(0xFF10B981),
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
                      color: const Color(0xFFF59E0B),
                      title: 'Year in Review',
                      subtitle: '2025 Wrapped',
                      reportType: 'wrapped',
                    ),
                  ],
                ),
              ),
            ),

            // Zone 3: Explore Your Data
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
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
                padding: const EdgeInsets.symmetric(horizontal: 16),
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
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Zone 1: AI Insight Card
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
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
            child: const Center(
              child: Text('\u{1F3CB}', style: TextStyle(fontSize: 22)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hey $firstName',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _buildInsight(),
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
// Zone 2: Report Link Cards
// ---------------------------------------------------------------------------

class _ReportLink extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String reportType;

  const _ReportLink({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.reportType,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/report/$reportType'),
      child: Container(
        width: 160,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: CupertinoColors.white, size: 24),
            const Spacer(),
            Text(
              title,
              style: const TextStyle(
                color: CupertinoColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                color: CupertinoColors.white.withValues(alpha: 0.8),
                fontSize: 12,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Zone 3: Explore Grid
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
    String goalSubtitle = 'Track your readiness and buildup...';
    String recoverySubtitle = 'Check your training load...';
    String prSubtitle = 'Track and visualize your PRs...';
    String analysisSubtitle = 'Charts, breakdowns, and more...';

    if (workouts != null && workouts.isNotEmpty) {
      // Sport deep dive — find dominant sport in last 30 days
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
        sportSubtitle =
            '${topSport.value} sessions in the last 30 days';
      }

      // Recovery — count recent days
      final recent14 = workouts
          .where((w) => w.date
              .isAfter(DateTime.now().subtract(const Duration(days: 14))))
          .length;
      if (recent14 > 0) {
        recoverySubtitle =
            '$recent14 workouts in 14 days — check load...';
      }

      // Trend
      final now = DateTime.now();
      final thisMonthName = DateFormat('MMMM').format(now);
      final lastMonthName =
          DateFormat('MMMM').format(DateTime(now.year, now.month - 1));
      trendSubtitle = '$thisMonthName vs $lastMonthName';
    }

    if (stats != null && stats.total > 0) {
      analysisSubtitle =
          '${stats.total} workouts tracked — charts, breakdowns...';
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _ExploreCard(
                emoji: '\u{1F4AA}',
                emojiColor: const Color(0xFFF59E0B),
                title: 'Sport Deep Dive',
                subtitle: sportSubtitle,
                reportType: 'sport-deep-dive',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ExploreCard(
                emoji: '\u{1F4CA}',
                emojiColor: const Color(0xFFEC4899),
                title: 'Trend Report',
                subtitle: trendSubtitle,
                reportType: 'trend-report',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ExploreCard(
                emoji: '\u{1F3AF}',
                emojiColor: const Color(0xFFEF4444),
                title: 'Goal Tracker',
                subtitle: goalSubtitle,
                reportType: 'goal-tracker',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ExploreCard(
                emoji: '\u{2705}',
                emojiColor: const Color(0xFF22C55E),
                title: 'Recovery Check',
                subtitle: recoverySubtitle,
                reportType: 'recovery-report',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ExploreCard(
                emoji: '\u{1F3C6}',
                emojiColor: const Color(0xFFF97316),
                title: 'Personal Records',
                subtitle: prSubtitle,
                reportType: 'pr-timeline',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ExploreCard(
                emoji: '\u{1F4C8}',
                emojiColor: const Color(0xFF6366F1),
                title: 'Training Analysis',
                subtitle: analysisSubtitle,
                reportType: 'training-analysis',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ExploreCard extends StatelessWidget {
  final String emoji;
  final Color emojiColor;
  final String title;
  final String subtitle;
  final String reportType;

  const _ExploreCard({
    required this.emoji,
    required this.emojiColor,
    required this.title,
    required this.subtitle,
    required this.reportType,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/report/$reportType'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: CupertinoColors.systemBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: CupertinoColors.separator.resolveFrom(context),
            width: 0.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 20)),
                const Spacer(),
                Icon(
                  CupertinoIcons.chevron_right,
                  size: 14,
                  color: CupertinoColors.systemGrey3.resolveFrom(context),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: CupertinoColors.systemGrey.resolveFrom(context),
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

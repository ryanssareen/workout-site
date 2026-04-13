import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/workouts/data/workout_repository.dart';
import '../../../models/stats.dart';
import '../../../models/workout.dart';
import '../../../models/personal_record.dart';

final _reportRepoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final _reportWorkoutsProvider = FutureProvider<List<Workout>>((ref) {
  return ref.watch(_reportRepoProvider).getWorkouts(limit: 50);
});

final _reportStatsProvider = FutureProvider<UserStats>((ref) {
  return ref.watch(_reportRepoProvider).getStats();
});

final _reportPRsProvider = FutureProvider<List<PersonalRecord>>((ref) {
  return ref.watch(_reportRepoProvider).getPersonalRecords();
});

class ReportDetailScreen extends ConsumerWidget {
  final String reportType;

  const ReportDetailScreen({super.key, required this.reportType});

  String get _title => switch (reportType) {
        'wrap' => 'Weekly Wrap',
        'review' => 'Monthly Review',
        'wrapped' => 'Year in Review',
        'sport-deep-dive' => 'Sport Deep Dive',
        'trend-report' => 'Trend Report',
        'goal-tracker' => 'Goal Tracker',
        'recovery-report' => 'Recovery Check',
        'pr-timeline' => 'Personal Records',
        _ => 'Training Analysis',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workoutsAsync = ref.watch(_reportWorkoutsProvider);
    final statsAsync = ref.watch(_reportStatsProvider);
    final prsAsync = ref.watch(_reportPRsProvider);

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(_title),
      ),
      child: SafeArea(
        child: workoutsAsync.when(
          loading: () => const Center(child: CupertinoActivityIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (workouts) => _buildReport(
            context,
            workouts,
            statsAsync.valueOrNull,
            prsAsync.valueOrNull ?? [],
          ),
        ),
      ),
    );
  }

  Widget _buildReport(
    BuildContext context,
    List<Workout> workouts,
    UserStats? stats,
    List<PersonalRecord> prs,
  ) {
    return switch (reportType) {
      'wrap' => _WeeklyWrap(workouts: workouts, stats: stats),
      'review' => _MonthlyReview(workouts: workouts, stats: stats),
      'wrapped' => _YearInReview(workouts: workouts, stats: stats),
      'pr-timeline' => _PRTimeline(prs: prs),
      'recovery-report' => _RecoveryCheck(workouts: workouts),
      _ => _GenericReport(
          reportType: reportType,
          workouts: workouts,
          stats: stats,
        ),
    };
  }
}

// ---------------------------------------------------------------------------
// Weekly Wrap
// ---------------------------------------------------------------------------

class _WeeklyWrap extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _WeeklyWrap({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final weekStart = now.subtract(Duration(days: now.weekday - 1));
    final thisWeek = workouts.where((w) =>
        w.date.isAfter(weekStart.subtract(const Duration(days: 1)))).toList();
    final completed = thisWeek.where((w) => w.completed).toList();

    final byType = <String, List<Workout>>{};
    for (final w in thisWeek) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    final totalMinutes =
        completed.fold<int>(0, (sum, w) => sum + (w.duration ?? 0));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero stats
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Text(
                  '${DateFormat('MMM d').format(weekStart)} – ${DateFormat('MMM d').format(now)}',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.8),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${completed.length}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 48,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'workouts completed',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _MiniStat(
                        label: 'Total',
                        value: '${thisWeek.length}'),
                    _MiniStat(
                        label: 'Minutes',
                        value: '$totalMinutes'),
                    _MiniStat(
                        label: 'Sports',
                        value: '${byType.length}'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // By sport
          _SectionHeader(title: 'BY SPORT'),
          const SizedBox(height: 8),
          ...byType.entries.map((e) => _SportRow(
                type: e.key,
                count: e.value.length,
                completed: e.value.where((w) => w.completed).length,
              )),

          const SizedBox(height: 20),

          // Day by day
          _SectionHeader(title: 'DAY BY DAY'),
          const SizedBox(height: 8),
          ...List.generate(7, (i) {
            final day = weekStart.add(Duration(days: i));
            final dayWorkouts = thisWeek
                .where((w) =>
                    w.date.year == day.year &&
                    w.date.month == day.month &&
                    w.date.day == day.day)
                .toList();
            return _DayRow(date: day, workouts: dayWorkouts);
          }),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Monthly Review
// ---------------------------------------------------------------------------

class _MonthlyReview extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _MonthlyReview({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    final thisMonth = workouts
        .where((w) => w.date.isAfter(monthStart.subtract(const Duration(days: 1))))
        .toList();
    final completed = thisMonth.where((w) => w.completed).toList();
    final totalMinutes =
        completed.fold<int>(0, (sum, w) => sum + (w.duration ?? 0));

    final byType = <String, int>{};
    for (final w in thisMonth) {
      byType[w.type] = (byType[w.type] ?? 0) + 1;
    }

    final activeDays = thisMonth
        .map((w) => '${w.date.year}-${w.date.month}-${w.date.day}')
        .toSet()
        .length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF059669)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Text(
                  DateFormat('MMMM yyyy').format(now),
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.8),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${completed.length}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 48,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'workouts this month',
                  style: TextStyle(color: CupertinoColors.white, fontSize: 16),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _MiniStat(label: 'Active Days', value: '$activeDays'),
                    _MiniStat(label: 'Minutes', value: '$totalMinutes'),
                    _MiniStat(label: 'Sports', value: '${byType.length}'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Breakdown
          _SectionHeader(title: 'BREAKDOWN'),
          const SizedBox(height: 8),
          ...byType.entries.map((e) => _SportRow(
                type: e.key,
                count: e.value,
                completed: thisMonth
                    .where((w) => w.type == e.key && w.completed)
                    .length,
              )),

          if (stats != null) ...[
            const SizedBox(height: 20),
            _SectionHeader(title: 'ALL TIME'),
            const SizedBox(height: 8),
            _StatCard(label: 'Total Workouts', value: '${stats!.total}'),
            _StatCard(label: 'Completed', value: '${stats!.completed}'),
            _StatCard(label: 'Completion Rate', value: stats!.completionRate),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Year in Review
// ---------------------------------------------------------------------------

class _YearInReview extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _YearInReview({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final total = stats?.total ?? workouts.length;
    final completed = stats?.completed ?? workouts.where((w) => w.completed).length;

    final byType = <String, int>{};
    for (final w in workouts) {
      byType[w.type] = (byType[w.type] ?? 0) + 1;
    }

    final topSport = byType.entries.isEmpty
        ? null
        : byType.entries.reduce((a, b) => a.value >= b.value ? a : b);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFEF4444)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                const Text(
                  '2025 WRAPPED',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '$total',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 56,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'total workouts',
                  style: TextStyle(color: CupertinoColors.white, fontSize: 16),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _MiniStat(label: 'Completed', value: '$completed'),
                    _MiniStat(
                        label: 'Top Sport',
                        value: topSport?.key ?? '-'),
                    _MiniStat(
                        label: 'Sports', value: '${byType.length}'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'SPORT BREAKDOWN'),
          const SizedBox(height: 8),
          ...byType.entries.map((e) => _SportRow(
                type: e.key,
                count: e.value,
                completed: workouts
                    .where((w) => w.type == e.key && w.completed)
                    .length,
              )),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PR Timeline
// ---------------------------------------------------------------------------

class _PRTimeline extends StatelessWidget {
  final List<PersonalRecord> prs;

  const _PRTimeline({required this.prs});

  @override
  Widget build(BuildContext context) {
    if (prs.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'No personal records yet.\nComplete workouts to start tracking PRs!',
            textAlign: TextAlign.center,
            style: TextStyle(color: CupertinoColors.systemGrey, fontSize: 16),
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: prs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final pr = prs[index];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: CupertinoColors.systemBackground.resolveFrom(context),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: CupertinoColors.separator.resolveFrom(context),
              width: 0.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF97316).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text('\u{1F3C6}', style: TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pr.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${pr.category} • ${pr.displayValue}',
                      style: TextStyle(
                        color: CupertinoColors.systemGrey.resolveFrom(context),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              if (pr.date != null)
                Text(
                  DateFormat('MMM d').format(pr.date!),
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Recovery Check
// ---------------------------------------------------------------------------

class _RecoveryCheck extends StatelessWidget {
  final List<Workout> workouts;

  const _RecoveryCheck({required this.workouts});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final last14 = workouts
        .where((w) =>
            w.completed &&
            w.date.isAfter(now.subtract(const Duration(days: 14))))
        .toList();
    final last7 = last14
        .where((w) => w.date.isAfter(now.subtract(const Duration(days: 7))))
        .toList();
    final prev7 = last14
        .where((w) => w.date.isBefore(now.subtract(const Duration(days: 7))))
        .toList();

    final consecutiveDays = _getConsecutiveDays(workouts);

    String loadStatus;
    Color loadColor;
    if (consecutiveDays >= 5) {
      loadStatus = 'High — consider a rest day';
      loadColor = const Color(0xFFEF4444);
    } else if (consecutiveDays >= 3) {
      loadStatus = 'Moderate — you\'re in a good rhythm';
      loadColor = const Color(0xFFF59E0B);
    } else {
      loadStatus = 'Light — you\'re well recovered';
      loadColor = const Color(0xFF22C55E);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Load indicator
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: loadColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: loadColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Icon(CupertinoIcons.heart_fill, color: loadColor, size: 32),
                const SizedBox(height: 8),
                Text(
                  loadStatus,
                  style: TextStyle(
                    color: loadColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  '$consecutiveDays consecutive training days',
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'LAST 14 DAYS'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                    label: 'This Week', value: '${last7.length} workouts'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                    label: 'Last Week', value: '${prev7.length} workouts'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _StatCard(
            label: 'Week-over-Week',
            value: prev7.isEmpty
                ? 'No data'
                : '${(((last7.length - prev7.length) / prev7.length) * 100).round()}% change',
          ),
        ],
      ),
    );
  }

  int _getConsecutiveDays(List<Workout> workouts) {
    final now = DateTime.now();
    int count = 0;
    for (int i = 0; i < 30; i++) {
      final day = now.subtract(Duration(days: i));
      final hasWorkout = workouts.any((w) =>
          w.completed &&
          w.date.year == day.year &&
          w.date.month == day.month &&
          w.date.day == day.day);
      if (hasWorkout) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// Generic Report (Sport Deep Dive, Trend, Goal Tracker, Training Analysis)
// ---------------------------------------------------------------------------

class _GenericReport extends StatelessWidget {
  final String reportType;
  final List<Workout> workouts;
  final UserStats? stats;

  const _GenericReport({
    required this.reportType,
    required this.workouts,
    this.stats,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final byType = <String, List<Workout>>{};
    for (final w in workouts) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    final topSport = byType.entries.isEmpty
        ? null
        : byType.entries.reduce((a, b) => a.value.length >= b.value.length ? a : b);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (stats != null) ...[
            // Overview stats
            Row(
              children: [
                Expanded(
                    child: _StatCard(
                        label: 'Total', value: '${stats!.total}')),
                const SizedBox(width: 10),
                Expanded(
                    child: _StatCard(
                        label: 'Completed', value: '${stats!.completed}')),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: _StatCard(
                        label: 'Completion', value: stats!.completionRate)),
                const SizedBox(width: 10),
                Expanded(
                    child: _StatCard(
                        label: 'Streak', value: '${stats!.streak} days')),
              ],
            ),
            const SizedBox(height: 20),
          ],

          _SectionHeader(title: 'BY SPORT'),
          const SizedBox(height: 8),
          ...byType.entries.map((e) => _SportRow(
                type: e.key,
                count: e.value.length,
                completed: e.value.where((w) => w.completed).length,
              )),

          if (topSport != null) ...[
            const SizedBox(height: 20),
            _SectionHeader(title: 'TOP SPORT: ${topSport.key.toUpperCase()}'),
            const SizedBox(height: 8),
            ...topSport.value.take(5).map((w) => _WorkoutRow(workout: w)),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared widgets
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: CupertinoColors.systemGrey.resolveFrom(context),
        letterSpacing: 0.5,
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: CupertinoColors.white,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: CupertinoColors.white.withValues(alpha: 0.7),
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _SportRow extends StatelessWidget {
  final String type;
  final int count;
  final int completed;

  const _SportRow({
    required this.type,
    required this.count,
    required this.completed,
  });

  String get _emoji => switch (type) {
        'swim' => '\u{1F3CA}',
        'run' => '\u{1F3C3}',
        'bike' => '\u{1F6B4}',
        'walk' => '\u{1F6B6}',
        'strength' => '\u{1F4AA}',
        _ => '\u{1F3CB}',
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Text(_emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            Text(
              type[0].toUpperCase() + type.substring(1),
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const Spacer(),
            Text(
              '$completed/$count',
              style: TextStyle(
                color: CupertinoColors.systemGrey.resolveFrom(context),
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: CupertinoColors.systemGrey.resolveFrom(context),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  final DateTime date;
  final List<Workout> workouts;

  const _DayRow({required this.date, required this.workouts});

  @override
  Widget build(BuildContext context) {
    final isToday = date.day == DateTime.now().day &&
        date.month == DateTime.now().month;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isToday
              ? AppTheme.primaryRed.withValues(alpha: 0.05)
              : CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
          border: isToday
              ? Border.all(color: AppTheme.primaryRed.withValues(alpha: 0.2))
              : null,
        ),
        child: Row(
          children: [
            SizedBox(
              width: 36,
              child: Text(
                DateFormat('EEE').format(date),
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: isToday
                      ? AppTheme.primaryRed
                      : CupertinoColors.systemGrey.resolveFrom(context),
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (workouts.isEmpty)
              Text(
                'Rest day',
                style: TextStyle(
                  color: CupertinoColors.systemGrey3.resolveFrom(context),
                  fontSize: 14,
                ),
              )
            else
              Expanded(
                child: Wrap(
                  spacing: 6,
                  children: workouts.map((w) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: w.completed
                            ? const Color(0xFF22C55E).withValues(alpha: 0.15)
                            : CupertinoColors.systemGrey5
                                .resolveFrom(context),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        w.name,
                        style: TextStyle(
                          fontSize: 12,
                          color: w.completed
                              ? const Color(0xFF16A34A)
                              : CupertinoColors.systemGrey
                                  .resolveFrom(context),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _WorkoutRow extends StatelessWidget {
  final Workout workout;
  const _WorkoutRow({required this.workout});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              workout.completed
                  ? CupertinoIcons.check_mark_circled_solid
                  : CupertinoIcons.circle,
              size: 18,
              color: workout.completed
                  ? const Color(0xFF22C55E)
                  : CupertinoColors.systemGrey3.resolveFrom(context),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                workout.name,
                style: const TextStyle(fontSize: 14),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              DateFormat('MMM d').format(workout.date),
              style: TextStyle(
                color: CupertinoColors.systemGrey.resolveFrom(context),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

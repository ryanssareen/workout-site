import 'dart:math';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

double _getDistance(Workout w) {
  final typeData = switch (w.type) {
    'run' => w.run,
    'bike' => w.bike,
    'swim' => w.swim,
    'walk' => w.walk,
    _ => null,
  };
  final d = typeData?['distance'];
  if (d is num) return d.toDouble();
  return 0;
}

String _sportEmoji(String type) => switch (type) {
      'swim' => '\u{1F3CA}',
      'run' => '\u{1F3C3}',
      'bike' => '\u{1F6B4}',
      'walk' => '\u{1F6B6}',
      'strength' => '\u{1F4AA}',
      _ => '\u{1F3CB}',
    };

Color _sportColor(String type) => switch (type) {
      'run' => const Color(0xFF22C55E),
      'bike' => const Color(0xFFF97316),
      'swim' => const Color(0xFF3B82F6),
      'walk' => const Color(0xFF10B981),
      'strength' => const Color(0xFF8B5CF6),
      _ => const Color(0xFF6B7280),
    };

String _formatDuration(int minutes) {
  if (minutes < 60) return '${minutes}min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m > 0 ? '${h}h ${m}m' : '${h}h';
}

String _formatDistance(double meters) {
  final km = meters / 1000;
  if (km >= 10) return '${km.round()} km';
  if (km >= 1) return '${km.toStringAsFixed(1)} km';
  return '${meters.round()} m';
}

String _pctChange(num current, num previous) {
  if (previous == 0) return current > 0 ? 'new' : '=';
  final pct = ((current - previous) / previous * 100).round();
  if (pct == 0) return '=';
  return pct > 0 ? '+$pct%' : '$pct%';
}

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

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
        'training-analysis' => 'Training Analysis',
        _ => 'Report',
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
      'recovery-report' => _RecoveryCheck(workouts: workouts, stats: stats),
      'sport-deep-dive' => _SportDeepDive(workouts: workouts),
      'trend-report' => _TrendReport(workouts: workouts, stats: stats),
      'goal-tracker' => _GoalTracker(workouts: workouts, stats: stats),
      'training-analysis' => _TrainingAnalysis(workouts: workouts, stats: stats),
      _ => _TrainingAnalysis(workouts: workouts, stats: stats),
    };
  }
}

// ===========================================================================
// WEEKLY WRAP — matches desktop: verdict, numbers, day-by-day, by sport
// ===========================================================================

class _WeeklyWrap extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _WeeklyWrap({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final weekStart = now.subtract(Duration(days: now.weekday - 1));
    final weekEnd = weekStart.add(const Duration(days: 6));

    final thisWeek = workouts.where((w) =>
        !w.date.isBefore(weekStart) &&
        w.date.isBefore(weekEnd.add(const Duration(days: 1)))).toList();
    final completed = thisWeek.where((w) => w.completed).toList();

    // Previous 7 weeks average for verdict
    final prev7WeekStart = weekStart.subtract(const Duration(days: 49));
    final prev7Weeks = workouts.where((w) =>
        !w.date.isBefore(prev7WeekStart) && w.date.isBefore(weekStart)).toList();
    final avgPrevWeek = prev7Weeks.isEmpty ? 0.0 : prev7Weeks.length / 7.0;

    final ratio = avgPrevWeek > 0 ? completed.length / avgPrevWeek : 0.0;
    final (verdictEmoji, verdictText) = _getVerdict(completed.length, ratio);

    // Stats
    final totalMinutes = completed.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final totalDistance = completed.fold<double>(0, (s, w) => s + _getDistance(w));

    // By sport
    final byType = <String, List<Workout>>{};
    for (final w in completed) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    // Highlight of the week
    final withDistance = completed.where((w) => _getDistance(w) > 0).toList();
    Workout? highlight;
    String highlightLabel = '';
    if (withDistance.isNotEmpty) {
      withDistance.sort((a, b) => _getDistance(b).compareTo(_getDistance(a)));
      highlight = withDistance.first;
      highlightLabel = 'Furthest';
    } else if (completed.isNotEmpty) {
      final sorted = [...completed]..sort(
          (a, b) => (b.duration ?? 0).compareTo(a.duration ?? 0));
      highlight = sorted.first;
      highlightLabel = 'Longest';
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Verdict hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(verdictEmoji, style: const TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                Text(
                  'Your week was $verdictText',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  '${DateFormat('MMM d').format(weekStart)} – ${DateFormat('MMM d').format(weekEnd)}',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Key numbers
          _SectionHeader(title: 'THE NUMBERS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${completed.length}',
                label: 'Workouts',
                color: const Color(0xFF6366F1),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: totalDistance > 0
                    ? '${(totalDistance / 1000).toStringAsFixed(1)}'
                    : '-',
                label: 'Distance (km)',
                color: const Color(0xFF22C55E),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: _formatDuration(totalMinutes),
                label: 'Time',
                color: const Color(0xFFF59E0B),
              )),
            ],
          ),
          const SizedBox(height: 24),

          // Day by day
          _SectionHeader(title: 'DAY BY DAY'),
          const SizedBox(height: 10),
          _DayByDayChart(weekStart: weekStart, workouts: thisWeek),
          const SizedBox(height: 10),
          ...List.generate(7, (i) {
            final day = weekStart.add(Duration(days: i));
            final dayWorkouts = thisWeek
                .where((w) => _isSameDay(w.date, day))
                .toList();
            return _DayRow(date: day, workouts: dayWorkouts);
          }),

          // Highlight
          if (highlight != null) ...[
            const SizedBox(height: 20),
            _HighlightCard(
              workout: highlight,
              label: highlightLabel,
            ),
          ],

          const SizedBox(height: 24),

          // By sport
          _SectionHeader(title: 'BY SPORT'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            return _SportCard(
              type: e.key,
              count: e.value.length,
              distance: dist,
              duration: dur,
            );
          }),
        ],
      ),
    );
  }

  (String, String) _getVerdict(int count, double ratio) {
    if (count == 0) return ('\u{1F634}', 'quiet');
    if (ratio >= 1.3) return ('\u{1F525}', 'incredible');
    if (ratio >= 1.1) return ('\u{1F4AA}', 'solid');
    if (ratio >= 0.9) return ('\u{2705}', 'consistent');
    if (ratio > 0) return ('\u{1F9D8}', 'a recovery week');
    return ('\u{1F680}', 'a great start');
  }
}

// ===========================================================================
// MONTHLY REVIEW — matches desktop: headline, stats, vs last month, calendar, breakdown
// ===========================================================================

class _MonthlyReview extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _MonthlyReview({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    final prevMonthStart = DateTime(now.year, now.month - 1, 1);

    final thisMonth = workouts.where((w) =>
        !w.date.isBefore(monthStart) && w.completed).toList();
    final prevMonth = workouts.where((w) =>
        !w.date.isBefore(prevMonthStart) &&
        w.date.isBefore(monthStart) &&
        w.completed).toList();

    final totalMinutes = thisMonth.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final totalDistance = thisMonth.fold<double>(0, (s, w) => s + _getDistance(w));
    final prevMinutes = prevMonth.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final prevDistance = prevMonth.fold<double>(0, (s, w) => s + _getDistance(w));

    final activeDays = thisMonth
        .map((w) => '${w.date.year}-${w.date.month}-${w.date.day}')
        .toSet()
        .length;

    final byType = <String, List<Workout>>{};
    for (final w in thisMonth) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    // Verdict
    final ratio = prevMonth.isEmpty ? 0.0 : thisMonth.length / prevMonth.length;
    final emoji = thisMonth.isEmpty
        ? '\u{1F634}'
        : ratio >= 1.2
            ? '\u{1F525}'
            : ratio >= 0.9
                ? '\u{1F4AA}'
                : '\u{1F9D8}';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF059669)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                Text(
                  DateFormat('MMMM yyyy').format(now),
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${thisMonth.length}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 56,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'workouts this month',
                  style: TextStyle(color: CupertinoColors.white, fontSize: 16),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Key stats
          _SectionHeader(title: 'KEY STATS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${thisMonth.length}',
                label: 'Workouts',
                color: const Color(0xFF10B981),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: totalDistance > 0
                    ? '${(totalDistance / 1000).toStringAsFixed(1)}'
                    : '-',
                label: 'km',
                color: const Color(0xFF3B82F6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: _formatDuration(totalMinutes),
                label: 'Time',
                color: const Color(0xFFF59E0B),
              )),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '$activeDays',
                label: 'Active Days',
                color: const Color(0xFF8B5CF6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${byType.length}',
                label: 'Sports',
                color: const Color(0xFFEC4899),
              )),
              const SizedBox(width: 10),
              const Expanded(child: SizedBox()),
            ],
          ),
          const SizedBox(height: 24),

          // Vs last month
          if (prevMonth.isNotEmpty) ...[
            _SectionHeader(title: 'VS LAST MONTH'),
            const SizedBox(height: 10),
            _TrendRow(
              label: 'Workouts',
              current: thisMonth.length,
              previous: prevMonth.length,
            ),
            _TrendRow(
              label: 'Distance',
              current: (totalDistance / 1000).round(),
              previous: (prevDistance / 1000).round(),
              suffix: ' km',
            ),
            _TrendRow(
              label: 'Time',
              current: totalMinutes,
              previous: prevMinutes,
              suffix: ' min',
            ),
            const SizedBox(height: 24),
          ],

          // Calendar grid
          _SectionHeader(title: 'ACTIVITY CALENDAR'),
          const SizedBox(height: 10),
          _MonthCalendarGrid(
            year: now.year,
            month: now.month,
            workouts: thisMonth,
          ),
          const SizedBox(height: 24),

          // Sport breakdown
          _SectionHeader(title: 'SPORT BREAKDOWN'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            final prevSport = prevMonth.where((w) => w.type == e.key).length;
            return _SportCard(
              type: e.key,
              count: e.value.length,
              distance: dist,
              duration: dur,
              changeText: prevSport > 0
                  ? _pctChange(e.value.length, prevSport)
                  : null,
            );
          }),
        ],
      ),
    );
  }
}

// ===========================================================================
// YEAR IN REVIEW — matches desktop: big stats, sport breakdown, records, monthly chart
// ===========================================================================

class _YearInReview extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _YearInReview({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final year = DateTime.now().year;
    final yearWorkouts = workouts.where((w) =>
        w.date.year == year && w.completed).toList();

    final totalDistance = yearWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
    final totalMinutes = yearWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final activeDays = yearWorkouts
        .map((w) => '${w.date.month}-${w.date.day}')
        .toSet()
        .length;

    final byType = <String, List<Workout>>{};
    for (final w in yearWorkouts) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    // Monthly breakdown
    final byMonth = <int, int>{};
    for (final w in yearWorkouts) {
      byMonth[w.date.month] = (byMonth[w.date.month] ?? 0) + 1;
    }

    // Records per sport
    final records = <String, Workout>{};
    for (final w in yearWorkouts) {
      final d = _getDistance(w);
      if (d > 0) {
        final existing = records[w.type];
        if (existing == null || d > _getDistance(existing)) {
          records[w.type] = w;
        }
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFEF4444)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(
                  '$year',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${yearWorkouts.length}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 64,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'workouts completed',
                  style: TextStyle(color: CupertinoColors.white, fontSize: 16),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Stats grid
          _SectionHeader(title: 'YOUR YEAR IN NUMBERS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${yearWorkouts.length}',
                label: 'Workouts',
                color: const Color(0xFFEF4444),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: totalDistance > 0
                    ? '${(totalDistance / 1000).round()}'
                    : '-',
                label: 'km',
                color: const Color(0xFF3B82F6),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: _formatDuration(totalMinutes),
                label: 'Training Time',
                color: const Color(0xFF10B981),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '$activeDays',
                label: 'Active Days',
                color: const Color(0xFFF59E0B),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${stats?.streak ?? 0}',
                label: 'Best Streak',
                color: const Color(0xFF8B5CF6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${byType.length}',
                label: 'Sports',
                color: const Color(0xFFEC4899),
              )),
            ],
          ),
          const SizedBox(height: 24),

          // Monthly chart
          _SectionHeader(title: 'MONTH BY MONTH'),
          const SizedBox(height: 10),
          _MonthlyBarChart(byMonth: byMonth, year: year),
          const SizedBox(height: 24),

          // Sport breakdown
          _SectionHeader(title: 'SPORT BREAKDOWN'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            final pct = (e.value.length / yearWorkouts.length * 100).round();
            return _SportCard(
              type: e.key,
              count: e.value.length,
              distance: dist,
              duration: dur,
              changeText: '$pct%',
            );
          }),

          // Records
          if (records.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionHeader(title: 'RECORDS'),
            const SizedBox(height: 10),
            ...records.entries.map((e) => _RecordCard(
                  type: e.key,
                  workout: e.value,
                )),
          ],
        ],
      ),
    );
  }
}

// ===========================================================================
// PR TIMELINE
// ===========================================================================

class _PRTimeline extends StatelessWidget {
  final List<PersonalRecord> prs;

  const _PRTimeline({required this.prs});

  @override
  Widget build(BuildContext context) {
    if (prs.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('\u{1F3C6}', style: TextStyle(fontSize: 48)),
              SizedBox(height: 12),
              Text(
                'No personal records yet',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              SizedBox(height: 4),
              Text(
                'Complete workouts to start tracking PRs!',
                style: TextStyle(color: CupertinoColors.systemGrey, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    // Group PRs by category
    final byCategory = <String, List<PersonalRecord>>{};
    for (final pr in prs) {
      byCategory.putIfAbsent(pr.category, () => []).add(pr);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF97316), Color(0xFFEF4444)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _HeroStat(value: '${prs.length}', label: 'Total PRs'),
                _HeroStat(
                    value: '${byCategory.length}', label: 'Categories'),
              ],
            ),
          ),
          const SizedBox(height: 20),

          ...byCategory.entries.expand((entry) => [
                _SectionHeader(title: entry.key.toUpperCase()),
                const SizedBox(height: 8),
                ...entry.value.map((pr) => _PRCard(pr: pr)),
                const SizedBox(height: 16),
              ]),
        ],
      ),
    );
  }
}

// ===========================================================================
// RECOVERY CHECK
// ===========================================================================

class _RecoveryCheck extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _RecoveryCheck({required this.workouts, this.stats});

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
        .where((w) => !w.date.isAfter(now.subtract(const Duration(days: 7))))
        .toList();

    final consecutiveDays = _getConsecutiveDays(workouts);
    final last7Minutes = last7.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final prev7Minutes = prev7.fold<int>(0, (s, w) => s + (w.duration ?? 0));

    String loadStatus;
    String loadEmoji;
    Color loadColor;
    if (consecutiveDays >= 5) {
      loadStatus = 'High Load';
      loadEmoji = '\u{1F534}';
      loadColor = const Color(0xFFEF4444);
    } else if (consecutiveDays >= 3) {
      loadStatus = 'Moderate Load';
      loadEmoji = '\u{1F7E1}';
      loadColor = const Color(0xFFF59E0B);
    } else {
      loadStatus = 'Well Recovered';
      loadEmoji = '\u{1F7E2}';
      loadColor = const Color(0xFF22C55E);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Load status hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: loadColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: loadColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Text(loadEmoji, style: const TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                Text(
                  loadStatus,
                  style: TextStyle(
                    color: loadColor,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$consecutiveDays consecutive training day${consecutiveDays == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 14,
                  ),
                ),
                if (consecutiveDays >= 3) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Consider a rest day',
                    style: TextStyle(color: loadColor, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          _SectionHeader(title: 'LAST 14 DAYS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${last7.length}',
                label: 'This Week',
                color: const Color(0xFF3B82F6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${prev7.length}',
                label: 'Last Week',
                color: const Color(0xFF6B7280),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: _formatDuration(last7Minutes),
                label: 'Time This Week',
                color: const Color(0xFF10B981),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: _formatDuration(prev7Minutes),
                label: 'Time Last Week',
                color: const Color(0xFF6B7280),
              )),
            ],
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'WEEK-OVER-WEEK'),
          const SizedBox(height: 10),
          _TrendRow(
            label: 'Workouts',
            current: last7.length,
            previous: prev7.length,
          ),
          _TrendRow(
            label: 'Training Time',
            current: last7Minutes,
            previous: prev7Minutes,
            suffix: ' min',
          ),

          const SizedBox(height: 24),
          _SectionHeader(title: 'DAILY ACTIVITY'),
          const SizedBox(height: 10),
          _Last14DaysChart(workouts: workouts),
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
          w.completed && _isSameDay(w.date, day));
      if (hasWorkout) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

// ===========================================================================
// SPORT DEEP DIVE
// ===========================================================================

class _SportDeepDive extends StatelessWidget {
  final List<Workout> workouts;

  const _SportDeepDive({required this.workouts});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final last30 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();
    final prev30 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 60))) &&
        !w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();

    // Find top sport
    final byType = <String, List<Workout>>{};
    for (final w in last30) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }
    if (byType.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Complete some workouts to see your sport analysis!',
            textAlign: TextAlign.center,
            style: TextStyle(color: CupertinoColors.systemGrey, fontSize: 16),
          ),
        ),
      );
    }

    final topEntry = byType.entries.reduce(
        (a, b) => a.value.length >= b.value.length ? a : b);
    final sport = topEntry.key;
    final sportWorkouts = topEntry.value;
    final prevSportWorkouts = prev30.where((w) => w.type == sport).toList();

    final totalDist = sportWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
    final totalDur = sportWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final prevDist = prevSportWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
    final prevDur = prevSportWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));

    final avgPace = totalDist > 0
        ? (totalDur / (totalDist / 1000)).toStringAsFixed(1)
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _sportColor(sport),
                  _sportColor(sport).withValues(alpha: 0.7),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(_sportEmoji(sport), style: const TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                Text(
                  '${sport[0].toUpperCase()}${sport.substring(1)}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Last 30 days',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'STATS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${sportWorkouts.length}',
                label: 'Sessions',
                color: _sportColor(sport),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: totalDist > 0
                    ? '${(totalDist / 1000).toStringAsFixed(1)}'
                    : '-',
                label: 'km',
                color: const Color(0xFF3B82F6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: _formatDuration(totalDur),
                label: 'Time',
                color: const Color(0xFFF59E0B),
              )),
            ],
          ),
          if (avgPace != null) ...[
            const SizedBox(height: 8),
            _NumberCard(
              value: '$avgPace min/km',
              label: 'Average Pace',
              color: const Color(0xFF10B981),
            ),
          ],

          if (prevSportWorkouts.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionHeader(title: 'VS PREVIOUS 30 DAYS'),
            const SizedBox(height: 10),
            _TrendRow(
              label: 'Sessions',
              current: sportWorkouts.length,
              previous: prevSportWorkouts.length,
            ),
            if (totalDist > 0 || prevDist > 0)
              _TrendRow(
                label: 'Distance',
                current: (totalDist / 1000).round(),
                previous: (prevDist / 1000).round(),
                suffix: ' km',
              ),
            _TrendRow(
              label: 'Time',
              current: totalDur,
              previous: prevDur,
              suffix: ' min',
            ),
          ],

          const SizedBox(height: 24),
          _SectionHeader(title: 'ALL SPORTS (30 DAYS)'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            return _SportCard(
              type: e.key,
              count: e.value.length,
              distance: dist,
              duration: dur,
              highlighted: e.key == sport,
            );
          }),

          const SizedBox(height: 24),
          _SectionHeader(title: 'RECENT ${sport.toUpperCase()} WORKOUTS'),
          const SizedBox(height: 10),
          ...sportWorkouts.take(8).map((w) => _WorkoutRow(workout: w)),
        ],
      ),
    );
  }
}

// ===========================================================================
// TREND REPORT
// ===========================================================================

class _TrendReport extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _TrendReport({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    // Build 6-month history
    final months = <_MonthData>[];
    for (int i = 0; i < 6; i++) {
      final mStart = DateTime(now.year, now.month - i, 1);
      final mEnd = DateTime(now.year, now.month - i + 1, 0);
      final mWorkouts = workouts.where((w) =>
          w.completed &&
          !w.date.isBefore(mStart) &&
          w.date.isBefore(mEnd.add(const Duration(days: 1)))).toList();
      final dist = mWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
      final dur = mWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));
      months.add(_MonthData(
        label: DateFormat('MMM').format(mStart),
        count: mWorkouts.length,
        distance: dist,
        duration: dur,
      ));
    }
    final reversed = months.reversed.toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEC4899), Color(0xFF8B5CF6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                const Text('\u{1F4CA}', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                const Text(
                  '6-Month Trend',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${reversed.first.label} – ${reversed.last.label}',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'WORKOUTS PER MONTH'),
          const SizedBox(height: 10),
          _TrendBarChart(
            months: reversed,
            valueGetter: (m) => m.count.toDouble(),
            color: const Color(0xFFEC4899),
          ),
          const SizedBox(height: 24),

          _SectionHeader(title: 'MONTH BY MONTH'),
          const SizedBox(height: 10),
          ...List.generate(reversed.length, (i) {
            final m = reversed[i];
            final prev = i > 0 ? reversed[i - 1] : null;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: CupertinoColors.systemGrey6.resolveFrom(context),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 40,
                      child: Text(
                        m.label,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${m.count} workouts  •  ${_formatDuration(m.duration)}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    if (prev != null && prev.count > 0)
                      _ChangeBadge(
                        text: _pctChange(m.count, prev.count),
                      ),
                  ],
                ),
              ),
            );
          }),

          if (months.length >= 2) ...[
            const SizedBox(height: 24),
            _SectionHeader(title: 'CURRENT VS LAST MONTH'),
            const SizedBox(height: 10),
            _TrendRow(
              label: 'Workouts',
              current: months[0].count,
              previous: months[1].count,
            ),
            _TrendRow(
              label: 'Time',
              current: months[0].duration,
              previous: months[1].duration,
              suffix: ' min',
            ),
          ],
        ],
      ),
    );
  }
}

// ===========================================================================
// GOAL TRACKER
// ===========================================================================

class _GoalTracker extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _GoalTracker({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final last30 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();
    final last7 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 7)))).toList();

    final avgPerWeek = last30.isEmpty
        ? 0.0
        : last30.length / 4.3;
    final consistency = last30.isEmpty
        ? 0
        : (last30.map((w) => '${w.date.year}-${w.date.month}-${w.date.day}')
                .toSet()
                .length /
            30 *
            100)
        .round();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEF4444), Color(0xFFF97316)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                const Text('\u{1F3AF}', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                const Text(
                  'Goal Tracker',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'Last 30 days',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'TRAINING CONSISTENCY'),
          const SizedBox(height: 10),
          _ConsistencyBar(percentage: consistency),
          const SizedBox(height: 6),
          Text(
            '$consistency% of days active in the last 30 days',
            style: TextStyle(
              color: CupertinoColors.systemGrey.resolveFrom(context),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'KEY METRICS'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: avgPerWeek.toStringAsFixed(1),
                label: 'Avg/Week',
                color: const Color(0xFFEF4444),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${last7.length}',
                label: 'This Week',
                color: const Color(0xFF3B82F6),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${stats?.streak ?? 0}',
                label: 'Current Streak',
                color: const Color(0xFFF59E0B),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${last30.length}',
                label: 'Last 30 Days',
                color: const Color(0xFF10B981),
              )),
            ],
          ),

          const SizedBox(height: 24),
          _SectionHeader(title: 'RECENT ACTIVITY'),
          const SizedBox(height: 10),
          ...last7.take(7).map((w) => _WorkoutRow(workout: w)),
          if (last7.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Text(
                  'No workouts this week yet',
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 14,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ===========================================================================
// TRAINING ANALYSIS
// ===========================================================================

class _TrainingAnalysis extends StatelessWidget {
  final List<Workout> workouts;
  final UserStats? stats;

  const _TrainingAnalysis({required this.workouts, this.stats});

  @override
  Widget build(BuildContext context) {
    final completed = workouts.where((w) => w.completed).toList();
    final totalDist = completed.fold<double>(0, (s, w) => s + _getDistance(w));
    final totalDur = completed.fold<int>(0, (s, w) => s + (w.duration ?? 0));

    final byType = <String, List<Workout>>{};
    for (final w in completed) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    // Weekly volume for last 8 weeks
    final now = DateTime.now();
    final weeklyVolume = <String, int>{};
    for (int i = 0; i < 8; i++) {
      final wStart = now.subtract(Duration(days: now.weekday - 1 + i * 7));
      final wEnd = wStart.add(const Duration(days: 6));
      final label = DateFormat('M/d').format(wStart);
      weeklyVolume[label] = completed
          .where((w) =>
              !w.date.isBefore(wStart) &&
              w.date.isBefore(wEnd.add(const Duration(days: 1))))
          .length;
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF3B82F6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                const Text('\u{1F4C8}', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                const Text(
                  'Training Analysis',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _SectionHeader(title: 'OVERVIEW'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: '${stats?.total ?? completed.length}',
                label: 'Total',
                color: const Color(0xFF6366F1),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${stats?.completed ?? completed.length}',
                label: 'Completed',
                color: const Color(0xFF22C55E),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: stats?.completionRate ?? '-',
                label: 'Completion',
                color: const Color(0xFF3B82F6),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: '${stats?.streak ?? 0} days',
                label: 'Streak',
                color: const Color(0xFFF59E0B),
              )),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _NumberCard(
                value: totalDist > 0
                    ? '${(totalDist / 1000).round()} km'
                    : '-',
                label: 'Distance',
                color: const Color(0xFF10B981),
              )),
              const SizedBox(width: 10),
              Expanded(child: _NumberCard(
                value: _formatDuration(totalDur),
                label: 'Total Time',
                color: const Color(0xFF8B5CF6),
              )),
            ],
          ),
          const SizedBox(height: 24),

          _SectionHeader(title: 'BY SPORT'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            final pct = completed.isEmpty
                ? 0
                : (e.value.length / completed.length * 100).round();
            return _SportCard(
              type: e.key,
              count: e.value.length,
              distance: dist,
              duration: dur,
              changeText: '$pct%',
            );
          }),

          const SizedBox(height: 24),
          _SectionHeader(title: 'WEEKLY VOLUME (8 WEEKS)'),
          const SizedBox(height: 10),
          _WeeklyVolumeChart(data: weeklyVolume),
        ],
      ),
    );
  }
}

// ===========================================================================
// SHARED WIDGETS
// ===========================================================================

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: CupertinoColors.systemGrey.resolveFrom(context),
        letterSpacing: 1,
      ),
    );
  }
}

class _NumberCard extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _NumberCard({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: CupertinoColors.systemGrey.resolveFrom(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String value;
  final String label;
  const _HeroStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: CupertinoColors.white,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: CupertinoColors.white.withValues(alpha: 0.7),
            fontSize: 13,
          ),
        ),
      ],
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

class _SportCard extends StatelessWidget {
  final String type;
  final int count;
  final double distance;
  final int duration;
  final String? changeText;
  final bool highlighted;

  const _SportCard({
    required this.type,
    required this.count,
    required this.distance,
    required this.duration,
    this.changeText,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = _sportColor(type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: highlighted
              ? color.withValues(alpha: 0.08)
              : CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
          border: highlighted
              ? Border.all(color: color.withValues(alpha: 0.3))
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(_sportEmoji(type),
                    style: const TextStyle(fontSize: 18)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${type[0].toUpperCase()}${type.substring(1)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      '$count session${count == 1 ? '' : 's'}',
                      if (distance > 0) _formatDistance(distance),
                      if (duration > 0) _formatDuration(duration),
                    ].join('  •  '),
                    style: TextStyle(
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (changeText != null)
              _ChangeBadge(text: changeText!),
          ],
        ),
      ),
    );
  }
}

class _ChangeBadge extends StatelessWidget {
  final String text;
  const _ChangeBadge({required this.text});

  @override
  Widget build(BuildContext context) {
    final isPositive = text.startsWith('+') || text == 'new';
    final isNeutral = text == '=' || text == '-';
    final color = isNeutral
        ? CupertinoColors.systemGrey
        : isPositive
            ? const Color(0xFF22C55E)
            : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _TrendRow extends StatelessWidget {
  final String label;
  final num current;
  final num previous;
  final String suffix;

  const _TrendRow({
    required this.label,
    required this.current,
    required this.previous,
    this.suffix = '',
  });

  @override
  Widget build(BuildContext context) {
    final change = _pctChange(current, previous);
    final isPositive = change.startsWith('+') || change == 'new';
    final isNeutral = change == '=';
    final arrow = isNeutral
        ? '–'
        : isPositive
            ? '\u{2191}'
            : '\u{2193}';
    final color = isNeutral
        ? CupertinoColors.systemGrey
        : isPositive
            ? const Color(0xFF22C55E)
            : const Color(0xFFEF4444);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
            ),
            const Spacer(),
            Text(
              '$previous$suffix',
              style: TextStyle(
                color: CupertinoColors.systemGrey.resolveFrom(context),
                fontSize: 13,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(arrow,
                  style: TextStyle(color: color, fontWeight: FontWeight.w700)),
            ),
            Text(
              '$current$suffix',
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(width: 8),
            _ChangeBadge(text: change),
          ],
        ),
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
    final isToday = _isSameDay(date, DateTime.now());
    final isFuture = date.isAfter(DateTime.now());

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
                isFuture ? '—' : 'Rest day',
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
                            ? _sportColor(w.type).withValues(alpha: 0.12)
                            : CupertinoColors.systemGrey5
                                .resolveFrom(context),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${_sportEmoji(w.type)} ${w.name}',
                        style: TextStyle(
                          fontSize: 12,
                          color: w.completed
                              ? _sportColor(w.type)
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

class _HighlightCard extends StatelessWidget {
  final Workout workout;
  final String label;

  const _HighlightCard({required this.workout, required this.label});

  @override
  Widget build(BuildContext context) {
    final dist = _getDistance(workout);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFFF59E0B).withValues(alpha: 0.1),
            const Color(0xFFF97316).withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Text('\u{1F3C6}', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$label of the Week',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFF59E0B),
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  workout.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 15),
                ),
                Text(
                  [
                    if (dist > 0) _formatDistance(dist),
                    if (workout.duration != null)
                      _formatDuration(workout.duration!),
                    DateFormat('EEEE').format(workout.date),
                  ].join('  •  '),
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 12,
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

class _WorkoutRow extends StatelessWidget {
  final Workout workout;
  const _WorkoutRow({required this.workout});

  @override
  Widget build(BuildContext context) {
    final dist = _getDistance(workout);
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
            Text(_sportEmoji(workout.type),
                style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    workout.name,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    [
                      if (dist > 0) _formatDistance(dist),
                      if (workout.duration != null)
                        _formatDuration(workout.duration!),
                    ].join('  •  '),
                    style: TextStyle(
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                      fontSize: 12,
                    ),
                  ),
                ],
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

class _PRCard extends StatelessWidget {
  final PersonalRecord pr;
  const _PRCard({required this.pr});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF97316).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                child: Text('\u{1F3C6}', style: TextStyle(fontSize: 18)),
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
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    pr.displayValue,
                    style: TextStyle(
                      color: const Color(0xFFF97316),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
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
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  final String type;
  final Workout workout;

  const _RecordCard({required this.type, required this.workout});

  @override
  Widget build(BuildContext context) {
    final dist = _getDistance(workout);
    final color = _sportColor(type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Row(
          children: [
            Text(_sportEmoji(type), style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${type[0].toUpperCase()}${type.substring(1)} Record',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  Text(
                    '${workout.name} — ${_formatDistance(dist)}',
                    style: TextStyle(
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                      fontSize: 12,
                    ),
                  ),
                ],
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

// ---------------------------------------------------------------------------
// Chart widgets
// ---------------------------------------------------------------------------

class _DayByDayChart extends StatelessWidget {
  final DateTime weekStart;
  final List<Workout> workouts;

  const _DayByDayChart({required this.weekStart, required this.workouts});

  @override
  Widget build(BuildContext context) {
    final days = List.generate(7, (i) {
      final day = weekStart.add(Duration(days: i));
      return workouts.where((w) => _isSameDay(w.date, day)).toList();
    });
    final maxCount = days.map((d) => d.length).reduce(max).clamp(1, 100);

    return Container(
      height: 120,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(7, (i) {
          final count = days[i].length;
          final barHeight = count > 0 ? (count / maxCount * 80).clamp(8.0, 80.0) : 4.0;
          final color = count > 0
              ? (days[i].length == 1
                  ? _sportColor(days[i].first.type)
                  : const Color(0xFF6366F1))
              : CupertinoColors.systemGrey4.resolveFrom(context);

          return Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (count > 0)
                  Text(
                    '$count',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: color),
                  ),
                const SizedBox(height: 4),
                Container(
                  width: 24,
                  height: barHeight,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormat('E').format(weekStart.add(Duration(days: i)))[0],
                  style: TextStyle(
                    fontSize: 11,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _MonthCalendarGrid extends StatelessWidget {
  final int year;
  final int month;
  final List<Workout> workouts;

  const _MonthCalendarGrid({
    required this.year,
    required this.month,
    required this.workouts,
  });

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;
    // Monday = 0
    final startWeekday = (firstDay.weekday - 1) % 7;
    final today = DateTime.now();

    final workoutDays = <int, int>{};
    for (final w in workouts) {
      if (w.date.month == month && w.date.year == year) {
        workoutDays[w.date.day] = (workoutDays[w.date.day] ?? 0) + 1;
      }
    }

    final dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          // Header
          Row(
            children: dayLabels
                .map((d) => Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: CupertinoColors.systemGrey
                                .resolveFrom(context),
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          // Days grid
          ...List.generate(((startWeekday + daysInMonth) / 7).ceil(), (week) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: List.generate(7, (dow) {
                  final dayNum = week * 7 + dow - startWeekday + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) {
                    return const Expanded(child: SizedBox(height: 32));
                  }
                  final count = workoutDays[dayNum] ?? 0;
                  final isToday = _isSameDay(
                      DateTime(year, month, dayNum), today);

                  return Expanded(
                    child: Container(
                      height: 32,
                      margin: const EdgeInsets.all(1),
                      decoration: BoxDecoration(
                        color: count > 0
                            ? const Color(0xFF22C55E)
                                .withValues(alpha: min(0.2 + count * 0.15, 0.8))
                            : null,
                        borderRadius: BorderRadius.circular(6),
                        border: isToday
                            ? Border.all(
                                color: AppTheme.primaryRed, width: 1.5)
                            : null,
                      ),
                      child: Center(
                        child: Text(
                          '$dayNum',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight:
                                count > 0 ? FontWeight.w600 : FontWeight.w400,
                            color: count > 0
                                ? const Color(0xFF166534)
                                : CupertinoColors.systemGrey
                                    .resolveFrom(context),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _MonthlyBarChart extends StatelessWidget {
  final Map<int, int> byMonth;
  final int year;

  const _MonthlyBarChart({required this.byMonth, required this.year});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final maxVal = byMonth.values.isEmpty
        ? 1
        : byMonth.values.reduce(max).clamp(1, 1000);

    return Container(
      height: 140,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(12, (i) {
          final m = i + 1;
          final count = byMonth[m] ?? 0;
          final isFuture = year == now.year && m > now.month;
          final barHeight =
              count > 0 ? (count / maxVal * 90).clamp(6.0, 90.0) : 3.0;

          return Expanded(
            child: Opacity(
              opacity: isFuture ? 0.3 : 1.0,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (count > 0)
                    Text(
                      '$count',
                      style: const TextStyle(
                          fontSize: 9, fontWeight: FontWeight.w600),
                    ),
                  const SizedBox(height: 2),
                  Container(
                    width: 18,
                    height: barHeight,
                    decoration: BoxDecoration(
                      gradient: count > 0
                          ? const LinearGradient(
                              colors: [Color(0xFFF59E0B), Color(0xFFEF4444)],
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                            )
                          : null,
                      color: count == 0
                          ? CupertinoColors.systemGrey4.resolveFrom(context)
                          : null,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('MMM')
                        .format(DateTime(year, m))
                        .substring(0, 1),
                    style: TextStyle(
                      fontSize: 10,
                      color:
                          CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _Last14DaysChart extends StatelessWidget {
  final List<Workout> workouts;

  const _Last14DaysChart({required this.workouts});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final days = List.generate(14, (i) {
      final day = now.subtract(Duration(days: 13 - i));
      return workouts
          .where((w) => w.completed && _isSameDay(w.date, day))
          .length;
    });
    final maxVal = days.reduce(max).clamp(1, 100);

    return Container(
      height: 100,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(14, (i) {
          final count = days[i];
          final barHeight =
              count > 0 ? (count / maxVal * 60).clamp(6.0, 60.0) : 3.0;
          final day = now.subtract(Duration(days: 13 - i));

          return Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Container(
                  width: 14,
                  height: barHeight,
                  decoration: BoxDecoration(
                    color: count > 0
                        ? const Color(0xFF22C55E)
                        : CupertinoColors.systemGrey4.resolveFrom(context),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${day.day}',
                  style: TextStyle(
                    fontSize: 8,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _TrendBarChart extends StatelessWidget {
  final List<_MonthData> months;
  final double Function(_MonthData) valueGetter;
  final Color color;

  const _TrendBarChart({
    required this.months,
    required this.valueGetter,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final values = months.map(valueGetter).toList();
    final maxVal = values.reduce(max).clamp(1.0, double.infinity);

    return Container(
      height: 120,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(months.length, (i) {
          final val = values[i];
          final barHeight = val > 0 ? (val / maxVal * 80).clamp(6.0, 80.0) : 3.0;

          return Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (val > 0)
                  Text(
                    '${val.round()}',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: color),
                  ),
                const SizedBox(height: 3),
                Container(
                  width: 28,
                  height: barHeight,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  months[i].label,
                  style: TextStyle(
                    fontSize: 10,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _WeeklyVolumeChart extends StatelessWidget {
  final Map<String, int> data;

  const _WeeklyVolumeChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final entries = data.entries.toList().reversed.toList();
    final maxVal = entries.map((e) => e.value).reduce(max).clamp(1, 100);

    return Container(
      height: 120,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: entries.map((e) {
          final barHeight =
              e.value > 0 ? (e.value / maxVal * 80).clamp(6.0, 80.0) : 3.0;
          return Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (e.value > 0)
                  Text(
                    '${e.value}',
                    style: const TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w600),
                  ),
                const SizedBox(height: 3),
                Container(
                  width: 20,
                  height: barHeight,
                  decoration: BoxDecoration(
                    color: const Color(0xFF6366F1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  e.key,
                  style: TextStyle(
                    fontSize: 8,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ConsistencyBar extends StatelessWidget {
  final int percentage;
  const _ConsistencyBar({required this.percentage});

  @override
  Widget build(BuildContext context) {
    final color = percentage >= 60
        ? const Color(0xFF22C55E)
        : percentage >= 30
            ? const Color(0xFFF59E0B)
            : const Color(0xFFEF4444);

    return Container(
      height: 12,
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey5.resolveFrom(context),
        borderRadius: BorderRadius.circular(6),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: (percentage / 100).clamp(0.0, 1.0),
        child: Container(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Data classes
// ---------------------------------------------------------------------------

class _MonthData {
  final String label;
  final int count;
  final double distance;
  final int duration;

  const _MonthData({
    required this.label,
    required this.count,
    required this.distance,
    required this.duration,
  });
}

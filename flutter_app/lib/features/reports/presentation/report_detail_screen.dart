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
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Error: $e', textAlign: TextAlign.center),
            ),
          ),
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
// SLIDE SCAFFOLD — shared swipeable slide container with dots + back/next
// ===========================================================================

class _SlideScaffold extends StatefulWidget {
  final int slideCount;
  final IndexedWidgetBuilder slideBuilder;
  final Color activeColor;

  const _SlideScaffold({
    required this.slideCount,
    required this.slideBuilder,
    this.activeColor = const Color(0xFF6366F1),
  });

  @override
  State<_SlideScaffold> createState() => _SlideScaffoldState();
}

class _SlideScaffoldState extends State<_SlideScaffold> {
  late final PageController _controller;
  int _current = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Progress bar
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          height: 3,
          decoration: BoxDecoration(
            color: CupertinoColors.systemGrey5.resolveFrom(context),
            borderRadius: BorderRadius.circular(2),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: (_current + 1) / widget.slideCount,
            child: Container(
              decoration: BoxDecoration(
                color: widget.activeColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ),

        // Slides
        Expanded(
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.slideCount,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: widget.slideBuilder,
          ),
        ),

        // Bottom bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              // Back button
              CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _current > 0 ? () => _goTo(_current - 1) : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.chevron_left,
                      size: 16,
                      color: _current > 0
                          ? CupertinoColors.label.resolveFrom(context)
                          : CupertinoColors.systemGrey3.resolveFrom(context),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Back',
                      style: TextStyle(
                        fontSize: 14,
                        color: _current > 0
                            ? CupertinoColors.label.resolveFrom(context)
                            : CupertinoColors.systemGrey3.resolveFrom(context),
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // Dots
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(widget.slideCount, (i) {
                  return GestureDetector(
                    onTap: () => _goTo(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: i == _current ? 20 : 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        color: i == _current
                            ? widget.activeColor
                            : CupertinoColors.systemGrey4
                                .resolveFrom(context),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  );
                }),
              ),

              const Spacer(),

              // Next button
              CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _current < widget.slideCount - 1
                    ? () => _goTo(_current + 1)
                    : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Next',
                      style: TextStyle(
                        fontSize: 14,
                        color: _current < widget.slideCount - 1
                            ? CupertinoColors.label.resolveFrom(context)
                            : CupertinoColors.systemGrey3
                                .resolveFrom(context),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      CupertinoIcons.chevron_right,
                      size: 16,
                      color: _current < widget.slideCount - 1
                          ? CupertinoColors.label.resolveFrom(context)
                          : CupertinoColors.systemGrey3.resolveFrom(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ===========================================================================
// WEEKLY WRAP — 4 slides: Verdict, Numbers, Day by Day, By Sport
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

    // Previous 7 weeks average
    final prev7WeekStart = weekStart.subtract(const Duration(days: 49));
    final prev7Weeks = workouts.where((w) =>
        !w.date.isBefore(prev7WeekStart) && w.date.isBefore(weekStart)).toList();
    final avgPrevWeek = prev7Weeks.isEmpty ? 0.0 : prev7Weeks.length / 7.0;
    final ratio = avgPrevWeek > 0 ? completed.length / avgPrevWeek : 0.0;

    final totalMinutes = completed.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final totalDistance = completed.fold<double>(0, (s, w) => s + _getDistance(w));

    final byType = <String, List<Workout>>{};
    for (final w in completed) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }

    // Highlight
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

    final (verdictEmoji, verdictText) = _getVerdict(completed.length, ratio);
    final dateRange =
        '${DateFormat('MMM d').format(weekStart)} – ${DateFormat('MMM d').format(weekEnd)}';

    return _SlideScaffold(
      slideCount: 4,
      activeColor: const Color(0xFF6366F1),
      slideBuilder: (context, index) {
        return switch (index) {
          // Slide 0: The Verdict
          0 => _CenteredSlide(
              gradient: const [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              children: [
                Text(verdictEmoji, style: const TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                const Text(
                  "YOUR WEEK'S CAPSULE",
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(children: [
                    const TextSpan(
                      text: 'This week was ',
                      style: TextStyle(color: CupertinoColors.white, fontSize: 24),
                    ),
                    TextSpan(
                      text: verdictText,
                      style: const TextStyle(
                        color: CupertinoColors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  dateRange,
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.6),
                    fontSize: 14,
                  ),
                ),
              ],
            ),

          // Slide 1: The Numbers
          1 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  const _SlideLabel(text: 'THE NUMBERS'),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F4AA}',
                        value: '${completed.length}',
                        label: 'workouts',
                        color: const Color(0xFF6366F1),
                      )),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (totalDistance > 0) ...[
                        Expanded(child: _BigStatCard(
                          emoji: '\u{1F30D}',
                          value: '${(totalDistance / 1000).toStringAsFixed(1)}',
                          unit: 'km',
                          label: 'distance',
                          color: const Color(0xFF22C55E),
                        )),
                        const SizedBox(width: 12),
                      ],
                      Expanded(child: _BigStatCard(
                        emoji: '\u{23F1}',
                        value: totalMinutes >= 60
                            ? '${(totalMinutes / 60).toStringAsFixed(1)}'
                            : '$totalMinutes',
                        unit: totalMinutes >= 60 ? 'hrs' : 'min',
                        label: 'training',
                        color: const Color(0xFFF59E0B),
                      )),
                    ],
                  ),
                ],
              ),
            ),

          // Slide 2: Day by Day
          2 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const _SlideLabel(text: 'DAY BY DAY'),
                  const SizedBox(height: 16),
                  _DayByDayChart(weekStart: weekStart, workouts: thisWeek),
                  const SizedBox(height: 16),
                  ...List.generate(7, (i) {
                    final day = weekStart.add(Duration(days: i));
                    final dayWorkouts = thisWeek
                        .where((w) => _isSameDay(w.date, day))
                        .toList();
                    return _DayRow(date: day, workouts: dayWorkouts);
                  }),
                  if (highlight != null) ...[
                    const SizedBox(height: 16),
                    _HighlightCard(workout: highlight, label: highlightLabel),
                  ],
                ],
              ),
            ),

          // Slide 3: By Sport
          _ => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SlideLabel(text: 'BY SPORT'),
                  const SizedBox(height: 16),
                  if (byType.isNotEmpty) ...[
                    // Pie chart
                    _SimplePieChart(data: byType.map(
                        (k, v) => MapEntry(k, v.length))),
                    const SizedBox(height: 20),
                  ],
                  ...byType.entries.map((e) {
                    final dist = e.value.fold<double>(
                        0, (s, w) => s + _getDistance(w));
                    final dur = e.value.fold<int>(
                        0, (s, w) => s + (w.duration ?? 0));
                    return _SportCard(
                      type: e.key,
                      count: e.value.length,
                      distance: dist,
                      duration: dur,
                    );
                  }),
                ],
              ),
            ),
        };
      },
    );
  }

  (String, String) _getVerdict(int count, double ratio) {
    if (count == 0) return ('\u{1F634}', 'quiet');
    if (ratio == 0) return ('\u{1F680}', 'a great start');
    if (ratio >= 1.3) return ('\u{1F525}', 'incredible');
    if (ratio >= 1.1) return ('\u{1F4AA}', 'solid');
    if (ratio >= 0.9) return ('\u{2705}', 'consistent');
    return ('\u{1F9D8}', 'a recovery week');
  }
}

// ===========================================================================
// MONTHLY REVIEW — 5 slides: Verdict, Numbers, vs Last Month, Calendar, Breakdown
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
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;

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
    final (verdictEmoji, verdictText) = _getMonthVerdict(
        thisMonth.length, ratio, prevMonth.isEmpty);

    return _SlideScaffold(
      slideCount: 5,
      activeColor: const Color(0xFF10B981),
      slideBuilder: (context, index) {
        return switch (index) {
          // Slide 0: The Verdict
          0 => _CenteredSlide(
              gradient: const [Color(0xFF10B981), Color(0xFF059669)],
              children: [
                Text(verdictEmoji, style: const TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                const Text(
                  'MONTH IN REVIEW',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: '${DateFormat('MMMM').format(now)} was ',
                      style: const TextStyle(
                          color: CupertinoColors.white, fontSize: 24),
                    ),
                    TextSpan(
                      text: verdictText,
                      style: const TextStyle(
                        color: CupertinoColors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  DateFormat('MMMM yyyy').format(now),
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.6),
                    fontSize: 14,
                  ),
                ),
              ],
            ),

          // Slide 1: By The Numbers
          1 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  const _SlideLabel(text: 'BY THE NUMBERS'),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F4AA}',
                        value: '${thisMonth.length}',
                        label: 'workouts',
                        color: const Color(0xFF10B981),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F4C5}',
                        value: '$activeDays',
                        unit: '/$daysInMonth',
                        label: 'active days',
                        color: const Color(0xFF3B82F6),
                      )),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (totalDistance > 0) ...[
                        Expanded(child: _BigStatCard(
                          emoji: '\u{1F30D}',
                          value: '${(totalDistance / 1000).toStringAsFixed(1)}',
                          unit: 'km',
                          label: 'distance',
                          color: const Color(0xFF22C55E),
                        )),
                        const SizedBox(width: 12),
                      ],
                      Expanded(child: _BigStatCard(
                        emoji: '\u{23F1}',
                        value: totalMinutes >= 60
                            ? '${(totalMinutes / 60).toStringAsFixed(1)}'
                            : '$totalMinutes',
                        unit: totalMinutes >= 60 ? 'hrs' : 'min',
                        label: 'training',
                        color: const Color(0xFFF59E0B),
                      )),
                    ],
                  ),
                ],
              ),
            ),

          // Slide 2: vs Last Month
          2 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  Text(
                    prevMonth.isEmpty
                        ? 'FIRST MONTH TRACKED'
                        : 'VS LAST MONTH',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (prevMonth.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(
                        'This is your first month!\nComparison will show up next month.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: CupertinoColors.systemGrey.resolveFrom(context),
                          fontSize: 16,
                        ),
                      ),
                    )
                  else ...[
                    _ComparisonCard(
                      label: 'Workouts',
                      current: thisMonth.length,
                      previous: prevMonth.length,
                    ),
                    const SizedBox(height: 12),
                    if (totalDistance > 0 || prevDistance > 0)
                      _ComparisonCard(
                        label: 'Distance',
                        current: (totalDistance / 1000).round(),
                        previous: (prevDistance / 1000).round(),
                        suffix: ' km',
                      ),
                    if (totalDistance > 0 || prevDistance > 0)
                      const SizedBox(height: 12),
                    _ComparisonCard(
                      label: 'Training Time',
                      current: totalMinutes,
                      previous: prevMinutes,
                      suffix: ' min',
                    ),
                  ],
                ],
              ),
            ),

          // Slide 3: Calendar
          3 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const _SlideLabel(text: 'YOUR CALENDAR'),
                  const SizedBox(height: 16),
                  _MonthCalendarGrid(
                    year: now.year,
                    month: now.month,
                    workouts: thisMonth,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '$activeDays active days',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                  const SizedBox(height: 20),
                  _DailyBarChart(
                    year: now.year,
                    month: now.month,
                    workouts: thisMonth,
                  ),
                ],
              ),
            ),

          // Slide 4: Sport Breakdown
          _ => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SlideLabel(text: 'SPORT BREAKDOWN'),
                  const SizedBox(height: 16),
                  if (byType.isNotEmpty) ...[
                    _SimplePieChart(data: byType.map(
                        (k, v) => MapEntry(k, v.length))),
                    const SizedBox(height: 20),
                  ],
                  ...byType.entries.map((e) {
                    final dist = e.value.fold<double>(
                        0, (s, w) => s + _getDistance(w));
                    final dur = e.value.fold<int>(
                        0, (s, w) => s + (w.duration ?? 0));
                    final prevSport =
                        prevMonth.where((w) => w.type == e.key).length;
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
            ),
        };
      },
    );
  }

  (String, String) _getMonthVerdict(int count, double ratio, bool isFirst) {
    if (count == 0) return ('\u{1F634}', 'quiet');
    if (isFirst) return ('\u{1F680}', 'a great start');
    if (ratio >= 1.3) return ('\u{1F525}', 'incredible');
    if (ratio >= 1.1) return ('\u{1F4AA}', 'productive');
    if (ratio >= 0.9) return ('\u{2705}', 'consistent');
    return ('\u{1F9D8}', 'a recovery month');
  }
}

// ===========================================================================
// YEAR IN REVIEW — 5 slides: Hero, Stats, Breakdown, Records, Heatmap
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

    final byMonth = <int, int>{};
    for (final w in yearWorkouts) {
      byMonth[w.date.month] = (byMonth[w.date.month] ?? 0) + 1;
    }

    // Records
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

    // Longest by duration
    final longestByType = <String, Workout>{};
    for (final w in yearWorkouts) {
      if ((w.duration ?? 0) > 30) {
        final existing = longestByType[w.type];
        if (existing == null || (w.duration ?? 0) > (existing.duration ?? 0)) {
          longestByType[w.type] = w;
        }
      }
    }

    return _SlideScaffold(
      slideCount: 5,
      activeColor: const Color(0xFFEF4444),
      slideBuilder: (context, index) {
        return switch (index) {
          // Slide 0: Hero reveal
          0 => _CenteredSlide(
              gradient: const [Color(0xFFF59E0B), Color(0xFFEF4444)],
              children: [
                Text(
                  '$year',
                  style: TextStyle(
                    color: CupertinoColors.white.withValues(alpha: 0.6),
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 3,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '${yearWorkouts.length}',
                  style: const TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 80,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'workouts completed',
                  style: TextStyle(
                    color: CupertinoColors.white,
                    fontSize: 18,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),

          // Slide 1: Stats
          1 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const _SlideLabel(text: 'YOUR YEAR IN NUMBERS'),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F30D}',
                        value: totalDistance > 0
                            ? '${(totalDistance / 1000).round()}'
                            : '-',
                        unit: 'km',
                        label: 'distance',
                        color: const Color(0xFF3B82F6),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _BigStatCard(
                        emoji: '\u{23F1}',
                        value: totalMinutes >= 60
                            ? '${(totalMinutes / 60).round()}'
                            : '$totalMinutes',
                        unit: totalMinutes >= 60 ? 'hrs' : 'min',
                        label: 'training',
                        color: const Color(0xFF10B981),
                      )),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F4C5}',
                        value: '$activeDays',
                        label: 'active days',
                        color: const Color(0xFFF59E0B),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _BigStatCard(
                        emoji: '\u{1F525}',
                        value: '${stats?.streak ?? 0}',
                        label: 'best streak',
                        color: const Color(0xFFEF4444),
                      )),
                    ],
                  ),
                ],
              ),
            ),

          // Slide 2: Breakdown
          2 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SlideLabel(text: 'WORKOUT BREAKDOWN'),
                  const SizedBox(height: 16),
                  if (byType.isNotEmpty) ...[
                    _SimplePieChart(data: byType.map(
                        (k, v) => MapEntry(k, v.length))),
                    const SizedBox(height: 20),
                  ],
                  ...byType.entries.map((e) {
                    final dist = e.value.fold<double>(
                        0, (s, w) => s + _getDistance(w));
                    final dur = e.value.fold<int>(
                        0, (s, w) => s + (w.duration ?? 0));
                    final pct = yearWorkouts.isEmpty
                        ? 0
                        : (e.value.length / yearWorkouts.length * 100).round();
                    return _SportCard(
                      type: e.key,
                      count: e.value.length,
                      distance: dist,
                      duration: dur,
                      changeText: '$pct%',
                    );
                  }),
                ],
              ),
            ),

          // Slide 3: Records
          3 => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SlideLabel(text: 'YOUR RECORDS'),
                  const SizedBox(height: 16),
                  if (longestByType.isNotEmpty) ...[
                    ...longestByType.entries.take(4).map((e) => _RecordCard(
                          type: e.key,
                          workout: e.value,
                          label: 'Longest ${e.key[0].toUpperCase()}${e.key.substring(1)}',
                          metric: _formatDuration(e.value.duration ?? 0),
                        )),
                  ],
                  if (records.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    ...records.entries.take(3).map((e) => _RecordCard(
                          type: e.key,
                          workout: e.value,
                          label: 'Furthest ${e.key[0].toUpperCase()}${e.key.substring(1)}',
                          metric: _formatDistance(_getDistance(e.value)),
                        )),
                  ],
                  if (records.isEmpty && longestByType.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Center(
                        child: Text(
                          'Complete more workouts to earn records!',
                          style: TextStyle(
                            color: CupertinoColors.systemGrey
                                .resolveFrom(context),
                            fontSize: 15,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
            ),

          // Slide 4: Monthly chart
          _ => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const _SlideLabel(text: 'MONTH BY MONTH'),
                  const SizedBox(height: 20),
                  _MonthlyBarChart(byMonth: byMonth, year: year),
                  const SizedBox(height: 24),
                  // Summary
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFFF59E0B).withValues(alpha: 0.1),
                          const Color(0xFFEF4444).withValues(alpha: 0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        const Text('\u{1F3C6}',
                            style: TextStyle(fontSize: 36)),
                        const SizedBox(height: 8),
                        Text(
                          'That\'s a wrap!',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            '${yearWorkouts.length} workouts',
                            if (totalDistance > 0)
                              '${(totalDistance / 1000).round()}km',
                            if (totalMinutes >= 60)
                              '${(totalMinutes / 60).round()}hrs',
                          ].join(' \u{00B7} '),
                          style: TextStyle(
                            color: CupertinoColors.systemGrey
                                .resolveFrom(context),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        };
      },
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
              Text('No personal records yet',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              SizedBox(height: 4),
              Text('Complete workouts to start tracking PRs!',
                  style: TextStyle(color: CupertinoColors.systemGrey, fontSize: 14),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      );
    }

    final byCategory = <String, List<PersonalRecord>>{};
    for (final pr in prs) {
      byCategory.putIfAbsent(pr.category, () => []).add(pr);
    }

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
                colors: [Color(0xFFF97316), Color(0xFFEF4444)],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _HeroStat(value: '${prs.length}', label: 'Total PRs'),
                _HeroStat(value: '${byCategory.length}', label: 'Categories'),
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
    final last14 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 14)))).toList();
    final last7 = last14
        .where((w) => w.date.isAfter(now.subtract(const Duration(days: 7))))
        .toList();
    final prev7 = last14
        .where((w) => !w.date.isAfter(now.subtract(const Duration(days: 7))))
        .toList();

    final consecutiveDays = _getConsecutiveDays(workouts);
    final last7Min = last7.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final prev7Min = prev7.fold<int>(0, (s, w) => s + (w.duration ?? 0));

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
                Text(loadStatus, style: TextStyle(
                    color: loadColor, fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('$consecutiveDays consecutive training day${consecutiveDays == 1 ? '' : 's'}',
                    style: TextStyle(
                        color: CupertinoColors.systemGrey.resolveFrom(context),
                        fontSize: 14)),
                if (consecutiveDays >= 3) ...[
                  const SizedBox(height: 8),
                  Text('Consider a rest day',
                      style: TextStyle(color: loadColor, fontSize: 13)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          _SectionHeader(title: 'LAST 14 DAYS'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _NumberCard(value: '${last7.length}', label: 'This Week', color: const Color(0xFF3B82F6))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: '${prev7.length}', label: 'Last Week', color: const Color(0xFF6B7280))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _NumberCard(value: _formatDuration(last7Min), label: 'Time This Week', color: const Color(0xFF10B981))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: _formatDuration(prev7Min), label: 'Time Last Week', color: const Color(0xFF6B7280))),
          ]),
          const SizedBox(height: 20),
          _SectionHeader(title: 'WEEK-OVER-WEEK'),
          const SizedBox(height: 10),
          _TrendRow(label: 'Workouts', current: last7.length, previous: prev7.length),
          _TrendRow(label: 'Training Time', current: last7Min, previous: prev7Min, suffix: ' min'),
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
      if (workouts.any((w) => w.completed && _isSameDay(w.date, day))) {
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
        w.completed && w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();
    final prev30 = workouts.where((w) =>
        w.completed &&
        w.date.isAfter(now.subtract(const Duration(days: 60))) &&
        !w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();

    final byType = <String, List<Workout>>{};
    for (final w in last30) {
      byType.putIfAbsent(w.type, () => []).add(w);
    }
    if (byType.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(32),
          child: Text('Complete some workouts to see your sport analysis!',
              textAlign: TextAlign.center,
              style: TextStyle(color: CupertinoColors.systemGrey, fontSize: 16))));
    }

    final topEntry = byType.entries.reduce((a, b) => a.value.length >= b.value.length ? a : b);
    final sport = topEntry.key;
    final sportWorkouts = topEntry.value;
    final prevSport = prev30.where((w) => w.type == sport).toList();

    final totalDist = sportWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
    final totalDur = sportWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final prevDist = prevSport.fold<double>(0, (s, w) => s + _getDistance(w));
    final prevDur = prevSport.fold<int>(0, (s, w) => s + (w.duration ?? 0));
    final avgPace = totalDist > 0 ? (totalDur / (totalDist / 1000)).toStringAsFixed(1) : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [_sportColor(sport), _sportColor(sport).withValues(alpha: 0.7)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(children: [
              Text(_sportEmoji(sport), style: const TextStyle(fontSize: 48)),
              const SizedBox(height: 8),
              Text('${sport[0].toUpperCase()}${sport.substring(1)}',
                  style: const TextStyle(color: CupertinoColors.white, fontSize: 24, fontWeight: FontWeight.w700)),
              Text('Last 30 days', style: TextStyle(color: CupertinoColors.white.withValues(alpha: 0.7), fontSize: 14)),
            ]),
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: 'STATS'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _NumberCard(value: '${sportWorkouts.length}', label: 'Sessions', color: _sportColor(sport))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: totalDist > 0 ? '${(totalDist / 1000).toStringAsFixed(1)}' : '-', label: 'km', color: const Color(0xFF3B82F6))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: _formatDuration(totalDur), label: 'Time', color: const Color(0xFFF59E0B))),
          ]),
          if (avgPace != null) ...[
            const SizedBox(height: 8),
            _NumberCard(value: '$avgPace min/km', label: 'Average Pace', color: const Color(0xFF10B981)),
          ],
          if (prevSport.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionHeader(title: 'VS PREVIOUS 30 DAYS'),
            const SizedBox(height: 10),
            _TrendRow(label: 'Sessions', current: sportWorkouts.length, previous: prevSport.length),
            if (totalDist > 0 || prevDist > 0)
              _TrendRow(label: 'Distance', current: (totalDist / 1000).round(), previous: (prevDist / 1000).round(), suffix: ' km'),
            _TrendRow(label: 'Time', current: totalDur, previous: prevDur, suffix: ' min'),
          ],
          const SizedBox(height: 24),
          _SectionHeader(title: 'RECENT WORKOUTS'),
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
    final months = <_MonthData>[];
    for (int i = 0; i < 6; i++) {
      final mStart = DateTime(now.year, now.month - i, 1);
      final mEnd = DateTime(now.year, now.month - i + 1, 0);
      final mWorkouts = workouts.where((w) =>
          w.completed && !w.date.isBefore(mStart) &&
          w.date.isBefore(mEnd.add(const Duration(days: 1)))).toList();
      final dist = mWorkouts.fold<double>(0, (s, w) => s + _getDistance(w));
      final dur = mWorkouts.fold<int>(0, (s, w) => s + (w.duration ?? 0));
      months.add(_MonthData(label: DateFormat('MMM').format(mStart), count: mWorkouts.length, distance: dist, duration: dur));
    }
    final reversed = months.reversed.toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFFEC4899), Color(0xFF8B5CF6)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(children: [
              const Text('\u{1F4CA}', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 8),
              const Text('6-Month Trend', style: TextStyle(color: CupertinoColors.white, fontSize: 22, fontWeight: FontWeight.w700)),
              Text('${reversed.first.label} – ${reversed.last.label}',
                  style: TextStyle(color: CupertinoColors.white.withValues(alpha: 0.7), fontSize: 14)),
            ]),
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: 'WORKOUTS PER MONTH'),
          const SizedBox(height: 10),
          _TrendBarChart(months: reversed, valueGetter: (m) => m.count.toDouble(), color: const Color(0xFFEC4899)),
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
                decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  SizedBox(width: 40, child: Text(m.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                  const SizedBox(width: 10),
                  Expanded(child: Text('${m.count} workouts  \u{2022}  ${_formatDuration(m.duration)}', style: const TextStyle(fontSize: 13))),
                  if (prev != null && prev.count > 0) _ChangeBadge(text: _pctChange(m.count, prev.count)),
                ]),
              ),
            );
          }),
          if (months.length >= 2) ...[
            const SizedBox(height: 24),
            _SectionHeader(title: 'CURRENT VS LAST MONTH'),
            const SizedBox(height: 10),
            _TrendRow(label: 'Workouts', current: months[0].count, previous: months[1].count),
            _TrendRow(label: 'Time', current: months[0].duration, previous: months[1].duration, suffix: ' min'),
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
    final last30 = workouts.where((w) => w.completed && w.date.isAfter(now.subtract(const Duration(days: 30)))).toList();
    final last7 = workouts.where((w) => w.completed && w.date.isAfter(now.subtract(const Duration(days: 7)))).toList();
    final avgPerWeek = last30.isEmpty ? 0.0 : last30.length / 4.3;
    final consistency = last30.isEmpty ? 0 : (last30.map((w) => '${w.date.year}-${w.date.month}-${w.date.day}').toSet().length / 30 * 100).round();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFF97316)]), borderRadius: BorderRadius.circular(20)),
            child: const Column(children: [
              Text('\u{1F3AF}', style: TextStyle(fontSize: 48)),
              SizedBox(height: 8),
              Text('Goal Tracker', style: TextStyle(color: CupertinoColors.white, fontSize: 22, fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: 'TRAINING CONSISTENCY'),
          const SizedBox(height: 10),
          _ConsistencyBar(percentage: consistency),
          const SizedBox(height: 6),
          Text('$consistency% of days active in the last 30 days',
              style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 13)),
          const SizedBox(height: 20),
          _SectionHeader(title: 'KEY METRICS'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _NumberCard(value: avgPerWeek.toStringAsFixed(1), label: 'Avg/Week', color: const Color(0xFFEF4444))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: '${last7.length}', label: 'This Week', color: const Color(0xFF3B82F6))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _NumberCard(value: '${stats?.streak ?? 0}', label: 'Current Streak', color: const Color(0xFFF59E0B))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: '${last30.length}', label: 'Last 30 Days', color: const Color(0xFF10B981))),
          ]),
          const SizedBox(height: 24),
          _SectionHeader(title: 'RECENT ACTIVITY'),
          const SizedBox(height: 10),
          ...last7.take(7).map((w) => _WorkoutRow(workout: w)),
          if (last7.isEmpty) Padding(padding: const EdgeInsets.all(20),
            child: Center(child: Text('No workouts this week yet',
                style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 14)))),
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
    for (final w in completed) { byType.putIfAbsent(w.type, () => []).add(w); }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF3B82F6)]), borderRadius: BorderRadius.circular(20)),
            child: const Column(children: [
              Text('\u{1F4C8}', style: TextStyle(fontSize: 48)),
              SizedBox(height: 8),
              Text('Training Analysis', style: TextStyle(color: CupertinoColors.white, fontSize: 22, fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: 'OVERVIEW'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _NumberCard(value: '${stats?.total ?? completed.length}', label: 'Total', color: const Color(0xFF6366F1))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: '${stats?.completed ?? completed.length}', label: 'Completed', color: const Color(0xFF22C55E))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _NumberCard(value: stats?.completionRate ?? '-', label: 'Completion', color: const Color(0xFF3B82F6))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: '${stats?.streak ?? 0} days', label: 'Streak', color: const Color(0xFFF59E0B))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _NumberCard(value: totalDist > 0 ? '${(totalDist / 1000).round()} km' : '-', label: 'Distance', color: const Color(0xFF10B981))),
            const SizedBox(width: 10),
            Expanded(child: _NumberCard(value: _formatDuration(totalDur), label: 'Total Time', color: const Color(0xFF8B5CF6))),
          ]),
          const SizedBox(height: 24),
          _SectionHeader(title: 'BY SPORT'),
          const SizedBox(height: 10),
          ...byType.entries.map((e) {
            final dist = e.value.fold<double>(0, (s, w) => s + _getDistance(w));
            final dur = e.value.fold<int>(0, (s, w) => s + (w.duration ?? 0));
            final pct = completed.isEmpty ? 0 : (e.value.length / completed.length * 100).round();
            return _SportCard(type: e.key, count: e.value.length, distance: dist, duration: dur, changeText: '$pct%');
          }),
        ],
      ),
    );
  }
}

// ===========================================================================
// SHARED WIDGETS
// ===========================================================================

class _SlideLabel extends StatelessWidget {
  final String text;
  const _SlideLabel({required this.text});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 2,
        color: CupertinoColors.systemGrey.resolveFrom(context),
      ),
      textAlign: TextAlign.center,
    );
  }
}

class _CenteredSlide extends StatelessWidget {
  final List<Color> gradient;
  final List<Widget> children;

  const _CenteredSlide({required this.gradient, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: children,
          ),
        ),
      ),
    );
  }
}

class _BigStatCard extends StatelessWidget {
  final String emoji;
  final String value;
  final String? unit;
  final String label;
  final Color color;

  const _BigStatCard({
    required this.emoji,
    required this.value,
    required this.label,
    required this.color,
    this.unit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: 2),
                Text(
                  unit!,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: color.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ],
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

class _ComparisonCard extends StatelessWidget {
  final String label;
  final num current;
  final num previous;
  final String suffix;

  const _ComparisonCard({
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
    final trendColor = isNeutral
        ? CupertinoColors.systemGrey
        : isPositive
            ? const Color(0xFF22C55E)
            : const Color(0xFFEF4444);
    final trendIcon = isNeutral
        ? CupertinoIcons.minus
        : isPositive
            ? CupertinoIcons.arrow_up_right
            : CupertinoIcons.arrow_down_right;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: CupertinoColors.systemGrey6.resolveFrom(context),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: trendColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(trendIcon, color: trendColor, size: 20),
          ),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(
              color: CupertinoColors.systemGrey.resolveFrom(context),
              fontSize: 13)),
          const SizedBox(height: 4),
          Text(change, style: TextStyle(
              color: trendColor, fontSize: 28, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('$previous$suffix \u{2192} $current$suffix',
              style: TextStyle(
                  color: CupertinoColors.systemGrey.resolveFrom(context),
                  fontSize: 13)),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(title, style: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w700,
        color: CupertinoColors.systemGrey.resolveFrom(context),
        letterSpacing: 1));
  }
}

class _NumberCard extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _NumberCard({required this.value, required this.label, required this.color});

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
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12, color: CupertinoColors.systemGrey.resolveFrom(context))),
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
    return Column(children: [
      Text(value, style: const TextStyle(color: CupertinoColors.white, fontSize: 28, fontWeight: FontWeight.w800)),
      const SizedBox(height: 2),
      Text(label, style: TextStyle(color: CupertinoColors.white.withValues(alpha: 0.7), fontSize: 13)),
    ]);
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
    required this.type, required this.count, required this.distance,
    required this.duration, this.changeText, this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = _sportColor(type);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: highlighted ? color.withValues(alpha: 0.08) : CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
          border: highlighted ? Border.all(color: color.withValues(alpha: 0.3)) : null,
        ),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Center(child: Text(_sportEmoji(type), style: const TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${type[0].toUpperCase()}${type.substring(1)}',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 2),
            Text([
              '$count session${count == 1 ? '' : 's'}',
              if (distance > 0) _formatDistance(distance),
              if (duration > 0) _formatDuration(duration),
            ].join('  \u{2022}  '),
                style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
          ])),
          if (changeText != null) _ChangeBadge(text: changeText!),
        ]),
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
    final color = isNeutral ? CupertinoColors.systemGrey
        : isPositive ? const Color(0xFF22C55E) : const Color(0xFFEF4444);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
      child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _TrendRow extends StatelessWidget {
  final String label;
  final num current;
  final num previous;
  final String suffix;

  const _TrendRow({required this.label, required this.current, required this.previous, this.suffix = ''});

  @override
  Widget build(BuildContext context) {
    final change = _pctChange(current, previous);
    final isPositive = change.startsWith('+') || change == 'new';
    final isNeutral = change == '=';
    final arrow = isNeutral ? '\u{2013}' : isPositive ? '\u{2191}' : '\u{2193}';
    final color = isNeutral ? CupertinoColors.systemGrey
        : isPositive ? const Color(0xFF22C55E) : const Color(0xFFEF4444);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          const Spacer(),
          Text('$previous$suffix', style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 13)),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(arrow, style: TextStyle(color: color, fontWeight: FontWeight.w700))),
          Text('$current$suffix', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(width: 8),
          _ChangeBadge(text: change),
        ]),
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
          color: isToday ? AppTheme.primaryRed.withValues(alpha: 0.05) : CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
          border: isToday ? Border.all(color: AppTheme.primaryRed.withValues(alpha: 0.2)) : null,
        ),
        child: Row(children: [
          SizedBox(width: 36, child: Text(DateFormat('EEE').format(date),
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13,
                  color: isToday ? AppTheme.primaryRed : CupertinoColors.systemGrey.resolveFrom(context)))),
          const SizedBox(width: 8),
          if (workouts.isEmpty)
            Text(isFuture ? '\u{2014}' : 'Rest day',
                style: TextStyle(color: CupertinoColors.systemGrey3.resolveFrom(context), fontSize: 14))
          else
            Expanded(child: Wrap(spacing: 6, children: workouts.map((w) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: w.completed ? _sportColor(w.type).withValues(alpha: 0.12) : CupertinoColors.systemGrey5.resolveFrom(context),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('${_sportEmoji(w.type)} ${w.name}',
                    style: TextStyle(fontSize: 12,
                        color: w.completed ? _sportColor(w.type) : CupertinoColors.systemGrey.resolveFrom(context)),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              );
            }).toList())),
        ]),
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
      width: double.infinity, padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [const Color(0xFFF59E0B).withValues(alpha: 0.1), const Color(0xFFF97316).withValues(alpha: 0.05)]),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        const Text('\u{1F3C6}', style: TextStyle(fontSize: 28)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('$label of the Week', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFF59E0B), letterSpacing: 0.5)),
          Text(workout.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          Text([
            if (dist > 0) _formatDistance(dist),
            if (workout.duration != null) _formatDuration(workout.duration!),
            DateFormat('EEEE').format(workout.date),
          ].join('  \u{2022}  '),
              style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
        ])),
      ]),
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
        decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(10)),
        child: Row(children: [
          Text(_sportEmoji(workout.type), style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(workout.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text([
              if (dist > 0) _formatDistance(dist),
              if (workout.duration != null) _formatDuration(workout.duration!),
            ].join('  \u{2022}  '),
                style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
          ])),
          Text(DateFormat('MMM d').format(workout.date),
              style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
        ]),
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
        decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: const Color(0xFFF97316).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: const Center(child: Text('\u{1F3C6}', style: TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(pr.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 1),
            Text(pr.displayValue, style: const TextStyle(color: Color(0xFFF97316), fontSize: 13, fontWeight: FontWeight.w600)),
          ])),
          if (pr.date != null) Text(DateFormat('MMM d').format(pr.date!),
              style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
        ]),
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  final String type;
  final Workout workout;
  final String label;
  final String metric;

  const _RecordCard({required this.type, required this.workout, required this.label, required this.metric});

  @override
  Widget build(BuildContext context) {
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
        child: Row(children: [
          Text(_sportEmoji(type), style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            Text('${workout.name} \u{2014} $metric',
                style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
          ])),
          Text(DateFormat('MMM d').format(workout.date),
              style: TextStyle(color: CupertinoColors.systemGrey.resolveFrom(context), fontSize: 12)),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

class _SimplePieChart extends StatelessWidget {
  final Map<String, int> data;
  const _SimplePieChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final total = data.values.fold<int>(0, (s, v) => s + v);
    if (total == 0) return const SizedBox.shrink();

    final entries = data.entries.toList();
    double startAngle = -pi / 2;

    return Column(children: [
      SizedBox(
        width: 140, height: 140,
        child: CustomPaint(
          painter: _PiePainter(
            entries: entries.map((e) => MapEntry(e.key, e.value / total)).toList(),
          ),
        ),
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 16, runSpacing: 6, alignment: WrapAlignment.center,
          children: entries.map((e) {
        final pct = (e.value / total * 100).round();
        return Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 10, height: 10,
              decoration: BoxDecoration(color: _sportColor(e.key), borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: 4),
          Text('${e.key[0].toUpperCase()}${e.key.substring(1)} $pct%',
              style: const TextStyle(fontSize: 12)),
        ]);
      }).toList()),
    ]);
  }
}

class _PiePainter extends CustomPainter {
  final List<MapEntry<String, double>> entries;
  _PiePainter({required this.entries});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    double startAngle = -pi / 2;

    for (final entry in entries) {
      final sweepAngle = entry.value * 2 * pi;
      final paint = Paint()
        ..color = _sportColor(entry.key)
        ..style = PaintingStyle.fill;
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius),
          startAngle, sweepAngle, true, paint);
      startAngle += sweepAngle;
    }

    // Center hole
    canvas.drawCircle(center, radius * 0.55,
        Paint()..color = CupertinoColors.systemBackground);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

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
      height: 120, padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(7, (i) {
        final count = days[i].length;
        final barHeight = count > 0 ? (count / maxCount * 80).clamp(8.0, 80.0) : 4.0;
        final color = count > 0
            ? (days[i].length == 1 ? _sportColor(days[i].first.type) : const Color(0xFF6366F1))
            : CupertinoColors.systemGrey4.resolveFrom(context);
        return Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
          if (count > 0) Text(_sportEmoji(count == 1 ? days[i].first.type : 'other'),
              style: const TextStyle(fontSize: 14)),
          const SizedBox(height: 4),
          Container(width: 24, height: barHeight,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4))),
          const SizedBox(height: 4),
          Text(DateFormat('E').format(weekStart.add(Duration(days: i)))[0],
              style: TextStyle(fontSize: 11, color: CupertinoColors.systemGrey.resolveFrom(context))),
        ]));
      })),
    );
  }
}

class _MonthCalendarGrid extends StatelessWidget {
  final int year;
  final int month;
  final List<Workout> workouts;
  const _MonthCalendarGrid({required this.year, required this.month, required this.workouts});

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final startWeekday = (DateTime(year, month, 1).weekday - 1) % 7;
    final today = DateTime.now();
    final workoutDays = <int, int>{};
    for (final w in workouts) {
      if (w.date.month == month && w.date.year == year) {
        workoutDays[w.date.day] = (workoutDays[w.date.day] ?? 0) + 1;
      }
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Row(children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) =>
            Expanded(child: Center(child: Text(d, style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: CupertinoColors.systemGrey.resolveFrom(context)))))).toList()),
        const SizedBox(height: 6),
        ...List.generate(((startWeekday + daysInMonth) / 7).ceil(), (week) {
          return Padding(padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: List.generate(7, (dow) {
              final dayNum = week * 7 + dow - startWeekday + 1;
              if (dayNum < 1 || dayNum > daysInMonth) return const Expanded(child: SizedBox(height: 32));
              final count = workoutDays[dayNum] ?? 0;
              final isToday = _isSameDay(DateTime(year, month, dayNum), today);
              return Expanded(child: Container(
                height: 32, margin: const EdgeInsets.all(1),
                decoration: BoxDecoration(
                  color: count > 0 ? const Color(0xFF22C55E).withValues(alpha: min(0.2 + count * 0.15, 0.8)) : null,
                  borderRadius: BorderRadius.circular(6),
                  border: isToday ? Border.all(color: AppTheme.primaryRed, width: 1.5) : null,
                ),
                child: Center(child: Text('$dayNum', style: TextStyle(
                    fontSize: 12, fontWeight: count > 0 ? FontWeight.w600 : FontWeight.w400,
                    color: count > 0 ? const Color(0xFF166534) : CupertinoColors.systemGrey.resolveFrom(context)))),
              ));
            })));
        }),
      ]),
    );
  }
}

class _DailyBarChart extends StatelessWidget {
  final int year;
  final int month;
  final List<Workout> workouts;
  const _DailyBarChart({required this.year, required this.month, required this.workouts});

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final counts = List.generate(daysInMonth, (i) {
      final day = i + 1;
      return workouts.where((w) => w.date.day == day && w.date.month == month).length;
    });
    final maxVal = counts.reduce(max).clamp(1, 100);

    return Container(
      height: 80, padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(daysInMonth, (i) {
        final count = counts[i];
        final barHeight = count > 0 ? (count / maxVal * 55).clamp(4.0, 55.0) : 2.0;
        final primaryType = count > 0 ? workouts.firstWhere((w) => w.date.day == i + 1 && w.date.month == month).type : 'other';
        return Expanded(child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 0.5),
          height: barHeight,
          decoration: BoxDecoration(
            color: count > 0 ? _sportColor(primaryType) : CupertinoColors.systemGrey4.resolveFrom(context),
            borderRadius: BorderRadius.circular(2)),
        ));
      })),
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
    final maxVal = byMonth.values.isEmpty ? 1 : byMonth.values.reduce(max).clamp(1, 1000);
    return Container(
      height: 140, padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(12, (i) {
        final m = i + 1;
        final count = byMonth[m] ?? 0;
        final isFuture = year == now.year && m > now.month;
        final barHeight = count > 0 ? (count / maxVal * 90).clamp(6.0, 90.0) : 3.0;
        return Expanded(child: Opacity(opacity: isFuture ? 0.3 : 1.0,
            child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
          if (count > 0) Text('$count', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Container(width: 18, height: barHeight,
              decoration: BoxDecoration(
                gradient: count > 0 ? const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEF4444)], begin: Alignment.bottomCenter, end: Alignment.topCenter) : null,
                color: count == 0 ? CupertinoColors.systemGrey4.resolveFrom(context) : null,
                borderRadius: BorderRadius.circular(3))),
          const SizedBox(height: 4),
          Text(DateFormat('MMM').format(DateTime(year, m)).substring(0, 1),
              style: TextStyle(fontSize: 10, color: CupertinoColors.systemGrey.resolveFrom(context))),
        ])));
      })),
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
      return workouts.where((w) => w.completed && _isSameDay(w.date, day)).length;
    });
    final maxVal = days.reduce(max).clamp(1, 100);

    return Container(
      height: 100, padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(14, (i) {
        final count = days[i];
        final barHeight = count > 0 ? (count / maxVal * 60).clamp(6.0, 60.0) : 3.0;
        final day = now.subtract(Duration(days: 13 - i));
        return Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
          Container(width: 14, height: barHeight,
              decoration: BoxDecoration(
                color: count > 0 ? const Color(0xFF22C55E) : CupertinoColors.systemGrey4.resolveFrom(context),
                borderRadius: BorderRadius.circular(3))),
          const SizedBox(height: 3),
          Text('${day.day}', style: TextStyle(fontSize: 8, color: CupertinoColors.systemGrey.resolveFrom(context))),
        ]));
      })),
    );
  }
}

class _TrendBarChart extends StatelessWidget {
  final List<_MonthData> months;
  final double Function(_MonthData) valueGetter;
  final Color color;
  const _TrendBarChart({required this.months, required this.valueGetter, required this.color});

  @override
  Widget build(BuildContext context) {
    final values = months.map(valueGetter).toList();
    final maxVal = values.reduce(max).clamp(1.0, double.infinity);
    return Container(
      height: 120, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(color: CupertinoColors.systemGrey6.resolveFrom(context), borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(months.length, (i) {
        final val = values[i];
        final barHeight = val > 0 ? (val / maxVal * 80).clamp(6.0, 80.0) : 3.0;
        return Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
          if (val > 0) Text('${val.round()}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 3),
          Container(width: 28, height: barHeight,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4))),
          const SizedBox(height: 4),
          Text(months[i].label, style: TextStyle(fontSize: 10, color: CupertinoColors.systemGrey.resolveFrom(context))),
        ]));
      })),
    );
  }
}

class _ConsistencyBar extends StatelessWidget {
  final int percentage;
  const _ConsistencyBar({required this.percentage});

  @override
  Widget build(BuildContext context) {
    final color = percentage >= 60 ? const Color(0xFF22C55E)
        : percentage >= 30 ? const Color(0xFFF59E0B) : const Color(0xFFEF4444);
    return Container(
      height: 12,
      decoration: BoxDecoration(color: CupertinoColors.systemGrey5.resolveFrom(context), borderRadius: BorderRadius.circular(6)),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: (percentage / 100).clamp(0.0, 1.0),
        child: Container(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6))),
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
  const _MonthData({required this.label, required this.count, required this.distance, required this.duration});
}

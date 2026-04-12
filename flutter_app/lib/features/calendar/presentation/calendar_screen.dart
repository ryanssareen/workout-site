import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/workouts/data/workout_repository.dart';
import '../../../models/workout.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _calendarRepoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

/// Current month the user is viewing.
final _currentMonthProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month);
});

/// Workouts for the currently viewed month.
final _monthWorkoutsProvider = FutureProvider<List<Workout>>((ref) async {
  final repo = ref.watch(_calendarRepoProvider);
  // Fetch up to 50 workouts (MCP max) — client-side date filter
  final all = await repo.getWorkouts(limit: 50);
  final month = ref.watch(_currentMonthProvider);
  return all.where((w) {
    return w.date.year == month.year && w.date.month == month.month;
  }).toList();
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class CalendarScreen extends ConsumerWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMonth = ref.watch(_currentMonthProvider);
    final workoutsAsync = ref.watch(_monthWorkoutsProvider);

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(DateFormat('MMMM yyyy').format(currentMonth)),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          child: const Icon(CupertinoIcons.chevron_left, size: 22),
          onPressed: () {
            ref.read(_currentMonthProvider.notifier).state = DateTime(
              currentMonth.year,
              currentMonth.month - 1,
            );
          },
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CupertinoButton(
              padding: EdgeInsets.zero,
              child: const Text('Today',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
              onPressed: () {
                final now = DateTime.now();
                ref.read(_currentMonthProvider.notifier).state =
                    DateTime(now.year, now.month);
              },
            ),
            CupertinoButton(
              padding: EdgeInsets.zero,
              child: const Icon(CupertinoIcons.chevron_right, size: 22),
              onPressed: () {
                ref.read(_currentMonthProvider.notifier).state = DateTime(
                  currentMonth.year,
                  currentMonth.month + 1,
                );
              },
            ),
          ],
        ),
      ),
      child: SafeArea(
        child: workoutsAsync.when(
          data: (workouts) => _MonthView(
            month: currentMonth,
            workouts: workouts,
            onRefresh: () async {
              ref.invalidate(_monthWorkoutsProvider);
            },
          ),
          loading: () => const Center(child: CupertinoActivityIndicator()),
          error: (e, _) => Center(
            child: Text('Failed to load: $e',
                style: const TextStyle(color: CupertinoColors.destructiveRed)),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Month grid view
// ---------------------------------------------------------------------------

class _MonthView extends StatelessWidget {
  final DateTime month;
  final List<Workout> workouts;
  final Future<void> Function() onRefresh;

  const _MonthView({
    required this.month,
    required this.workouts,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    final startWeekday = firstDay.weekday; // 1=Mon ... 7=Sun
    final daysInMonth = lastDay.day;

    // Build a map of day → workouts
    final dayMap = <int, List<Workout>>{};
    for (final w in workouts) {
      if (w.date.year == month.year && w.date.month == month.month) {
        (dayMap[w.date.day] ??= []).add(w);
      }
    }

    final today = DateTime.now();
    final isCurrentMonth =
        month.year == today.year && month.month == today.month;

    return CustomScrollView(
      physics:
          const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        CupertinoSliverRefreshControl(onRefresh: onRefresh),

        // Weekday header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
            child: Row(
              children: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                  .map((d) => Expanded(
                        child: Center(
                          child: Text(
                            d,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: CupertinoColors.systemGrey
                                  .resolveFrom(context),
                            ),
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),

        // Calendar grid
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: _buildGrid(
              context,
              startWeekday,
              daysInMonth,
              dayMap,
              isCurrentMonth ? today.day : -1,
            ),
          ),
        ),

        // Selected day or today's workouts
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            child: Text(
              'This Month',
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 20),
            ),
          ),
        ),

        if (workouts.isEmpty)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Center(
                child: Text(
                  'No workouts this month',
                  style: TextStyle(color: CupertinoColors.systemGrey),
                ),
              ),
            ),
          )
        else
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) {
                final sorted = List<Workout>.from(workouts)
                  ..sort((a, b) => a.date.compareTo(b.date));
                final w = sorted[i];
                return _CalendarWorkoutRow(workout: w);
              },
              childCount: workouts.length,
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  Widget _buildGrid(
    BuildContext context,
    int startWeekday,
    int daysInMonth,
    Map<int, List<Workout>> dayMap,
    int todayDay,
  ) {
    final cells = <Widget>[];

    // Empty cells before first day (Monday = 1)
    for (var i = 1; i < startWeekday; i++) {
      cells.add(const SizedBox());
    }

    // Day cells
    for (var day = 1; day <= daysInMonth; day++) {
      final dayWorkouts = dayMap[day] ?? [];
      final isToday = day == todayDay;

      cells.add(_DayCell(
        day: day,
        workouts: dayWorkouts,
        isToday: isToday,
      ));
    }

    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 0.9,
      children: cells,
    );
  }
}

// ---------------------------------------------------------------------------
// Day cell
// ---------------------------------------------------------------------------

class _DayCell extends StatelessWidget {
  final int day;
  final List<Workout> workouts;
  final bool isToday;

  const _DayCell({
    required this.day,
    required this.workouts,
    required this.isToday,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: isToday
            ? AppTheme.primaryRed.withValues(alpha: 0.08)
            : null,
        borderRadius: BorderRadius.circular(10),
        border: isToday
            ? Border.all(color: AppTheme.primaryRed, width: 1.5)
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$day',
            style: TextStyle(
              fontSize: 15,
              fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
              color: isToday
                  ? AppTheme.primaryRed
                  : CupertinoTheme.of(context).textTheme.textStyle.color,
            ),
          ),
          const SizedBox(height: 4),
          if (workouts.isNotEmpty)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: workouts
                  .take(3)
                  .map((w) => Container(
                        width: 7,
                        height: 7,
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        decoration: BoxDecoration(
                          color: SportColors.forType(w.workoutType),
                          shape: BoxShape.circle,
                        ),
                      ))
                  .toList(),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Workout row for the list below the grid
// ---------------------------------------------------------------------------

class _CalendarWorkoutRow extends StatelessWidget {
  final Workout workout;

  const _CalendarWorkoutRow({required this.workout});

  @override
  Widget build(BuildContext context) {
    final type = workout.workoutType;
    final dateStr = DateFormat('EEE d').format(workout.date);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: SportColors.forType(type).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(type.emoji, style: const TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    workout.name,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    dateStr,
                    style: TextStyle(
                      fontSize: 12,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                  ),
                ],
              ),
            ),
            if (workout.completed)
              const Icon(CupertinoIcons.checkmark_circle_fill,
                  color: Color(0xFF22C55E), size: 20)
            else
              Icon(CupertinoIcons.circle,
                  color: CupertinoColors.systemGrey3.resolveFrom(context),
                  size: 20),
          ],
        ),
      ),
    );
  }
}

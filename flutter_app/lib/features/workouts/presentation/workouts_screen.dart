import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../models/workout.dart';
import '../data/workout_repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final workoutRepositoryProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final workoutsListProvider = FutureProvider<List<Workout>>((ref) {
  return ref.watch(workoutRepositoryProvider).getWorkouts(
        limit: AppConstants.maxWorkoutsPerPage,
      );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

enum _Tab { planned, past, all }

class WorkoutsScreen extends ConsumerStatefulWidget {
  const WorkoutsScreen({super.key});

  @override
  ConsumerState<WorkoutsScreen> createState() => _WorkoutsScreenState();
}

class _WorkoutsScreenState extends ConsumerState<WorkoutsScreen> {
  _Tab _selectedTab = _Tab.all;

  List<Workout> _filter(List<Workout> workouts) {
    switch (_selectedTab) {
      case _Tab.planned:
        return workouts
            .where((w) => !w.completed && w.date.isAfter(DateTime.now()))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
      case _Tab.past:
        return workouts.where((w) => w.completed).toList()
          ..sort((a, b) => b.date.compareTo(a.date));
      case _Tab.all:
        return workouts.toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    }
  }

  @override
  Widget build(BuildContext context) {
    final workoutsAsync = ref.watch(workoutsListProvider);

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('Workouts'),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          child: const Icon(CupertinoIcons.add, size: 26),
          onPressed: () {
            context.go('/create-workout');
          },
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Segmented control
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: SizedBox(
                width: double.infinity,
                child: CupertinoSlidingSegmentedControl<_Tab>(
                  groupValue: _selectedTab,
                  onValueChanged: (v) {
                    if (v != null) setState(() => _selectedTab = v);
                  },
                  children: const {
                    _Tab.planned: Text('Planned'),
                    _Tab.past: Text('Past'),
                    _Tab.all: Text('All'),
                  },
                ),
              ),
            ),

            // List
            Expanded(
              child: workoutsAsync.when(
                data: (workouts) {
                  final filtered = _filter(workouts);
                  if (filtered.isEmpty) {
                    return Center(
                      child: Text(
                        _emptyMessage(),
                        style: TextStyle(
                          color:
                              CupertinoColors.systemGrey.resolveFrom(context),
                          fontSize: 15,
                        ),
                      ),
                    );
                  }

                  return CustomScrollView(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    slivers: [
                      CupertinoSliverRefreshControl(
                        onRefresh: () async {
                          ref.invalidate(workoutsListProvider);
                        },
                      ),
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) => _WorkoutRow(
                            workout: filtered[i],
                            onTap: () {
                              context.go('/workout/${filtered[i].id}');
                            },
                          ),
                          childCount: filtered.length,
                        ),
                      ),
                      const SliverToBoxAdapter(child: SizedBox(height: 32)),
                    ],
                  );
                },
                loading: () => const Center(child: CupertinoActivityIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      'Failed to load workouts.\n$e',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: CupertinoColors.destructiveRed,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _emptyMessage() {
    switch (_selectedTab) {
      case _Tab.planned:
        return 'No upcoming workouts';
      case _Tab.past:
        return 'No completed workouts';
      case _Tab.all:
        return 'No workouts yet';
    }
  }

}

// ---------------------------------------------------------------------------
// Row widget
// ---------------------------------------------------------------------------

class _WorkoutRow extends StatelessWidget {
  final Workout workout;
  final VoidCallback onTap;

  const _WorkoutRow({required this.workout, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final type = workout.workoutType;
    final dateStr = DateFormat('EEE, MMM d').format(workout.date);

    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Container(
          padding: const EdgeInsets.all(14),
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
              // Sport badge
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: SportColors.forType(type).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(type.emoji, style: const TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      workout.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          dateStr,
                          style: TextStyle(
                            fontSize: 13,
                            color: CupertinoColors.systemGrey
                                .resolveFrom(context),
                          ),
                        ),
                        if (workout.duration != null) ...[
                          Text(
                            '  \u2022  ${workout.duration} min',
                            style: TextStyle(
                              fontSize: 13,
                              color: CupertinoColors.systemGrey
                                  .resolveFrom(context),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Status
              if (workout.completed)
                const Icon(
                  CupertinoIcons.checkmark_circle_fill,
                  color: Color(0xFF22C55E),
                  size: 22,
                )
              else
                Icon(
                  CupertinoIcons.chevron_right,
                  color: CupertinoColors.systemGrey3.resolveFrom(context),
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

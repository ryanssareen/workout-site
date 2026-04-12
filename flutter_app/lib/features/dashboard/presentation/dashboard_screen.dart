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

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _workoutRepoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final _statsProvider = FutureProvider<UserStats>((ref) {
  return ref.watch(_workoutRepoProvider).getStats();
});

final _workoutsProvider = FutureProvider<List<Workout>>((ref) {
  return ref.watch(_workoutRepoProvider).getWorkouts(limit: 30);
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final stats = ref.watch(_statsProvider);
    final workouts = ref.watch(_workoutsProvider);

    final firstName =
        user.valueOrNull?.displayName?.split(' ').first ?? 'Athlete';

    return CupertinoPageScaffold(
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
                ref.invalidate(currentUserProvider);
              },
            ),

            // Greeting header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_greeting()}, $firstName',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('EEEE, MMMM d').format(DateTime.now()),
                      style: TextStyle(
                        fontSize: 15,
                        color:
                            CupertinoColors.systemGrey.resolveFrom(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Stats cards
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: stats.when(
                  data: (s) => _StatsRow(stats: s),
                  loading: () => const _StatsRowPlaceholder(),
                  error: (e, _) =>
                      const _ErrorCard(message: 'Could not load stats'),
                ),
              ),
            ),

            // Quick actions
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: CupertinoButton(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        color: AppTheme.primaryRed,
                        borderRadius: BorderRadius.circular(12),
                        onPressed: () => context.push('/create-workout'),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(CupertinoIcons.add,
                                color: CupertinoColors.white, size: 18),
                            SizedBox(width: 6),
                            Text(
                              'Log Workout',
                              style: TextStyle(
                                color: CupertinoColors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Section: Upcoming
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                child: Text(
                  'Upcoming Workouts',
                  style: CupertinoTheme.of(context)
                      .textTheme
                      .navTitleTextStyle
                      .copyWith(fontSize: 20),
                ),
              ),
            ),

            workouts.when(
              data: (list) {
                final upcoming = list
                    .where(
                        (w) => !w.completed && w.date.isAfter(DateTime.now()))
                    .toList()
                  ..sort((a, b) => a.date.compareTo(b.date));

                if (upcoming.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: _EmptyCard(text: 'No upcoming workouts'),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _WorkoutTile(workout: upcoming[i]),
                    childCount: upcoming.take(5).length,
                  ),
                );
              },
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CupertinoActivityIndicator()),
                ),
              ),
              error: (e, _) => const SliverToBoxAdapter(
                child: _ErrorCard(message: 'Could not load workouts'),
              ),
            ),

            // Section: Recently completed
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
                child: Text(
                  'Recently Completed',
                  style: CupertinoTheme.of(context)
                      .textTheme
                      .navTitleTextStyle
                      .copyWith(fontSize: 20),
                ),
              ),
            ),

            workouts.when(
              data: (list) {
                final completed = list.where((w) => w.completed).toList()
                  ..sort((a, b) => (b.completedAt ?? b.date)
                      .compareTo(a.completedAt ?? a.date));

                if (completed.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: _EmptyCard(text: 'No completed workouts yet'),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _WorkoutTile(workout: completed[i]),
                    childCount: completed.take(5).length,
                  ),
                );
              },
              loading: () =>
                  const SliverToBoxAdapter(child: SizedBox.shrink()),
              error: (_, __) =>
                  const SliverToBoxAdapter(child: SizedBox.shrink()),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stats Row — gradient accent cards like web
// ---------------------------------------------------------------------------

class _StatsRow extends StatelessWidget {
  final UserStats stats;
  const _StatsRow({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatCard(
          label: 'Streak',
          value: '${stats.streak}d',
          icon: CupertinoIcons.flame_fill,
          gradient: const [Color(0xFFFF6B6B), Color(0xFFEE5A24)],
        ),
        const SizedBox(width: 10),
        _StatCard(
          label: 'This Week',
          value: stats.thisWeek.toString(),
          icon: CupertinoIcons.bolt_fill,
          gradient: const [Color(0xFF3B82F6), Color(0xFF6366F1)],
        ),
        const SizedBox(width: 10),
        _StatCard(
          label: 'All Time',
          value: stats.total.toString(),
          icon: CupertinoIcons.star_fill,
          gradient: const [Color(0xFF22C55E), Color(0xFF10B981)],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final List<Color> gradient;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              gradient[0].withValues(alpha: 0.12),
              gradient[1].withValues(alpha: 0.06),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: gradient[0].withValues(alpha: 0.15),
            width: 0.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: gradient[0], size: 20),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: gradient[0],
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
      ),
    );
  }
}

class _StatsRowPlaceholder extends StatelessWidget {
  const _StatsRowPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        3,
        (_) => Expanded(
          child: Container(
            height: 90,
            margin: const EdgeInsets.only(right: 10),
            decoration: BoxDecoration(
              color: CupertinoColors.systemGrey5.resolveFrom(context),
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Workout tile with status-driven colors like web
// ---------------------------------------------------------------------------

class _WorkoutTile extends StatelessWidget {
  final Workout workout;
  const _WorkoutTile({required this.workout});

  @override
  Widget build(BuildContext context) {
    final type = workout.workoutType;
    final dateStr = DateFormat('EEE, MMM d').format(workout.date);
    final now = DateTime.now();

    // Status-driven border/background colors matching web
    Color borderColor;
    Color bgColor;
    IconData statusIcon;
    Color statusIconColor;

    if (workout.completed) {
      // Completed
      borderColor = const Color(0xFF22C55E).withValues(alpha: 0.4);
      bgColor = const Color(0xFF22C55E).withValues(alpha: 0.06);
      statusIcon = CupertinoIcons.checkmark_circle_fill;
      statusIconColor = const Color(0xFF22C55E);
    } else if (workout.date.isBefore(now)) {
      // Missed (past + incomplete)
      borderColor = CupertinoColors.destructiveRed.withValues(alpha: 0.4);
      bgColor = CupertinoColors.destructiveRed.withValues(alpha: 0.06);
      statusIcon = CupertinoIcons.xmark_circle;
      statusIconColor = CupertinoColors.destructiveRed;
    } else {
      // Future/Planned
      borderColor = const Color(0xFF3B82F6).withValues(alpha: 0.3);
      bgColor = const Color(0xFF3B82F6).withValues(alpha: 0.04);
      statusIcon = CupertinoIcons.clock;
      statusIconColor = const Color(0xFF3B82F6);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: GestureDetector(
        onTap: () => context.push('/workout/${workout.id}'),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: 1),
          ),
          child: Row(
            children: [
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      workout.name,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
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
              Icon(statusIcon, color: statusIconColor, size: 22),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Utility widgets
// ---------------------------------------------------------------------------

class _EmptyCard extends StatelessWidget {
  final String text;
  const _EmptyCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: CupertinoColors.systemGrey.resolveFrom(context),
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  final String message;
  const _ErrorCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        decoration: BoxDecoration(
          color: CupertinoColors.systemRed.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: CupertinoColors.destructiveRed,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

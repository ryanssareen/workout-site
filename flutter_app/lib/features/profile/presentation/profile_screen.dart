import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/workouts/data/workout_repository.dart';
import '../../../models/stats.dart';
import '../../../models/user.dart';
import '../../../models/workout.dart';

final _profileRepoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final _profileStatsProvider = FutureProvider<UserStats>((ref) {
  return ref.watch(_profileRepoProvider).getStats();
});

final _profileWorkoutsProvider = FutureProvider<List<Workout>>((ref) {
  return ref.watch(_profileRepoProvider).getWorkouts(limit: 50);
});

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);
    final statsAsync = ref.watch(_profileStatsProvider);
    final workoutsAsync = ref.watch(_profileWorkoutsProvider);

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Profile'),
      ),
      child: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            CupertinoSliverRefreshControl(
              onRefresh: () async {
                ref.invalidate(currentUserProvider);
                ref.invalidate(_profileStatsProvider);
                ref.invalidate(_profileWorkoutsProvider);
              },
            ),

            // Profile header
            SliverToBoxAdapter(
              child: userAsync.when(
                data: (user) => _ProfileHeader(user: user),
                loading: () => const SizedBox(
                  height: 160,
                  child: Center(child: CupertinoActivityIndicator()),
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),

            // Stats grid
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: statsAsync.when(
                  data: (s) => _StatsGrid(stats: s),
                  loading: () => const SizedBox(
                    height: 100,
                    child: Center(child: CupertinoActivityIndicator()),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),
            ),

            // Sport breakdown
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: workoutsAsync.when(
                  data: (workouts) => _SportBreakdown(workouts: workouts),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),
            ),

            // Recent activity
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Recent Activity',
                  style: CupertinoTheme.of(context)
                      .textTheme
                      .navTitleTextStyle
                      .copyWith(fontSize: 20),
                ),
              ),
            ),

            workoutsAsync.when(
              data: (workouts) {
                final recent = workouts.where((w) => w.completed).take(10).toList();
                if (recent.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(
                        child: Text('No activity yet',
                            style: TextStyle(color: CupertinoColors.systemGrey)),
                      ),
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _ActivityRow(workout: recent[i]),
                    childCount: recent.length,
                  ),
                );
              },
              loading: () => const SliverToBoxAdapter(
                child: Center(child: CupertinoActivityIndicator()),
              ),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  final User? user;
  const _ProfileHeader({this.user});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primaryRed.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                user?.displayName?.isNotEmpty == true
                    ? user!.displayName![0].toUpperCase()
                    : '?',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.primaryRed,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            user?.displayName ?? 'Athlete',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          if (user?.username != null)
            Text(
              '@${user!.username}',
              style: TextStyle(
                fontSize: 15,
                color: CupertinoColors.systemGrey.resolveFrom(context),
              ),
            ),
          if (user?.bio != null && user!.bio!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              user!.bio!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: CupertinoColors.systemGrey.resolveFrom(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final UserStats stats;
  const _StatsGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _GridStat(value: stats.total.toString(), label: 'Workouts'),
        _GridStat(value: stats.completed.toString(), label: 'Completed'),
        _GridStat(value: stats.completionRate, label: 'Rate'),
        _GridStat(
          value: stats.totalDuration > 0
              ? '${(stats.totalDuration / 60).toStringAsFixed(0)}h'
              : '0h',
          label: 'Duration',
        ),
      ],
    );
  }
}

class _GridStat extends StatelessWidget {
  final String value;
  final String label;
  const _GridStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: CupertinoColors.systemGrey.resolveFrom(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SportBreakdown extends StatelessWidget {
  final List<Workout> workouts;
  const _SportBreakdown({required this.workouts});

  @override
  Widget build(BuildContext context) {
    final counts = <WorkoutType, int>{};
    for (final w in workouts) {
      counts[w.workoutType] = (counts[w.workoutType] ?? 0) + 1;
    }
    if (counts.isEmpty) return const SizedBox.shrink();

    final sorted = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final total = workouts.length;

    return Container(
      padding: const EdgeInsets.all(16),
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
          const Text(
            'Sport Breakdown',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          ...sorted.map((e) {
            final pct = (e.value / total * 100).round();
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Text(e.key.emoji, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Text(e.key.displayName,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Text('$pct%',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: SportColors.forType(e.key),
                      )),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 80,
                    height: 6,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: CupertinoColors.systemGrey5.resolveFrom(context),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          FractionallySizedBox(
                            widthFactor: e.value / total,
                            child: Container(
                              decoration: BoxDecoration(
                                color: SportColors.forType(e.key),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final Workout workout;
  const _ActivityRow({required this.workout});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: CupertinoColors.systemBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: CupertinoColors.separator.resolveFrom(context),
            width: 0.5,
          ),
        ),
        child: Row(
          children: [
            Text(workout.workoutType.emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                workout.name,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              DateFormat('MMM d').format(workout.date),
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

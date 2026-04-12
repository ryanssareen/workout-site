import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../models/workout.dart';
import '../../../models/workout_comment.dart';
import '../data/workout_repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _repoProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(mcpClientProvider));
});

final workoutDetailProvider =
    FutureProvider.family<Workout, String>((ref, id) {
  return ref.watch(_repoProvider).getWorkoutDetail(id);
});

final workoutCommentsProvider =
    FutureProvider.family<List<WorkoutComment>, String>((ref, id) {
  return ref.watch(_repoProvider).getComments(id);
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class WorkoutDetailScreen extends ConsumerStatefulWidget {
  final String workoutId;

  const WorkoutDetailScreen({super.key, required this.workoutId});

  @override
  ConsumerState<WorkoutDetailScreen> createState() =>
      _WorkoutDetailScreenState();
}

class _WorkoutDetailScreenState extends ConsumerState<WorkoutDetailScreen> {
  final _commentController = TextEditingController();
  bool _isSending = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _sendComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSending = true);
    try {
      final repo = ref.read(_repoProvider);
      await repo.addComment(workoutId: widget.workoutId, text: text);
      _commentController.clear();
      ref.invalidate(workoutCommentsProvider(widget.workoutId));
    } catch (_) {
      // Silently fail — could show an alert
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _toggleComplete(Workout workout) async {
    try {
      final repo = ref.read(_repoProvider);
      await repo.completeWorkout(
        workoutId: workout.id,
        completed: !workout.completed,
      );
      ref.invalidate(workoutDetailProvider(widget.workoutId));
    } catch (_) {
      // ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    final workoutAsync = ref.watch(workoutDetailProvider(widget.workoutId));
    final commentsAsync = ref.watch(workoutCommentsProvider(widget.workoutId));

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: workoutAsync.whenOrNull(
              data: (w) => Text(w.name),
            ) ??
            const Text('Workout'),
        previousPageTitle: 'Back',
      ),
      child: SafeArea(
        child: workoutAsync.when(
          data: (workout) => _buildContent(context, workout, commentsAsync),
          loading: () =>
              const Center(child: CupertinoActivityIndicator()),
          error: (e, _) => Center(
            child: Text(
              'Failed to load workout.\n$e',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: CupertinoColors.destructiveRed,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    Workout workout,
    AsyncValue<List<WorkoutComment>> commentsAsync,
  ) {
    final type = workout.workoutType;
    final dateStr = DateFormat('EEEE, MMMM d, yyyy').format(workout.date);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: SportColors.forType(type).withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(type.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      workout.name,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                dateStr,
                style: TextStyle(
                  fontSize: 15,
                  color: CupertinoColors.systemGrey.resolveFrom(context),
                ),
              ),
              if (workout.duration != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${workout.duration} minutes',
                  style: TextStyle(
                    fontSize: 15,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Completion toggle
        CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => _toggleComplete(workout),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: workout.completed
                  ? const Color(0xFF22C55E).withValues(alpha: 0.1)
                  : AppTheme.primaryRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  workout.completed
                      ? CupertinoIcons.checkmark_circle_fill
                      : CupertinoIcons.circle,
                  color: workout.completed
                      ? const Color(0xFF22C55E)
                      : AppTheme.primaryRed,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Text(
                  workout.completed ? 'Completed' : 'Mark as Complete',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: workout.completed
                        ? const Color(0xFF22C55E)
                        : AppTheme.primaryRed,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Description
        if (workout.description != null &&
            workout.description!.isNotEmpty) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: CupertinoColors.systemGrey6.resolveFrom(context),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              workout.description!,
              style: const TextStyle(fontSize: 15, height: 1.5),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Tags
        if (workout.tags.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: workout.tags.map((tag) {
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: CupertinoColors.systemGrey5.resolveFrom(context),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  tag,
                  style: const TextStyle(fontSize: 13),
                ),
              );
            }).toList(),
          ),

        // Comments section
        const SizedBox(height: 24),
        Text(
          'Comments',
          style: CupertinoTheme.of(context)
              .textTheme
              .navTitleTextStyle
              .copyWith(fontSize: 18),
        ),
        const SizedBox(height: 12),

        commentsAsync.when(
          data: (comments) {
            if (comments.isEmpty) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  'No comments yet.',
                  style: TextStyle(
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                    fontSize: 14,
                  ),
                ),
              );
            }
            return Column(
              children: comments.map((c) => _CommentTile(comment: c)).toList(),
            );
          },
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: CupertinoActivityIndicator(),
          ),
          error: (_, __) => const Text(
            'Could not load comments.',
            style: TextStyle(
              color: CupertinoColors.destructiveRed,
              fontSize: 14,
            ),
          ),
        ),

        // Comment input
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: CupertinoTextField(
                controller: _commentController,
                placeholder: 'Add a comment...',
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: CupertinoColors.systemGrey6.resolveFrom(context),
                  borderRadius: BorderRadius.circular(10),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendComment(),
              ),
            ),
            const SizedBox(width: 8),
            CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: _isSending ? null : _sendComment,
              child: _isSending
                  ? const CupertinoActivityIndicator()
                  : const Icon(CupertinoIcons.arrow_up_circle_fill, size: 34),
            ),
          ],
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}

class _CommentTile extends StatelessWidget {
  final WorkoutComment comment;
  const _CommentTile({required this.comment});

  @override
  Widget build(BuildContext context) {
    final dateStr = comment.createdAt != null
        ? DateFormat('MMM d, h:mm a').format(comment.createdAt!)
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: CupertinoColors.systemGrey6.resolveFrom(context),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  comment.userName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                if (comment.userRole != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      comment.userRole!,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppTheme.primaryRed,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                Text(
                  dateStr,
                  style: TextStyle(
                    fontSize: 12,
                    color: CupertinoColors.systemGrey.resolveFrom(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              comment.text,
              style: const TextStyle(fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

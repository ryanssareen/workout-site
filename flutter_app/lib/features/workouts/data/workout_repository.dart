import '../../../core/constants/app_constants.dart';
import '../../../core/network/mcp_client.dart';
import '../../../models/stats.dart';
import '../../../models/workout.dart';
import '../../../models/workout_comment.dart';
import '../../../models/personal_record.dart';

/// Repository for workout CRUD operations via MCP tools.
class WorkoutRepository {
  final McpClient _mcp;

  WorkoutRepository(this._mcp);

  // ---------------------------------------------------------------------------
  // Workouts
  // ---------------------------------------------------------------------------

  /// Fetches the current user's workouts.
  Future<List<Workout>> getWorkouts({int? limit}) async {
    final result = await _mcp.callTool('get_user_workouts', {
      'limit': limit ?? AppConstants.defaultWorkoutLimit,
    });

    final workouts = result['workouts'] as List<dynamic>? ?? [];
    return workouts
        .map((w) => Workout.fromJson(w as Map<String, dynamic>))
        .toList();
  }

  /// Fetches a single workout by ID.
  Future<Workout> getWorkoutDetail(String workoutId) async {
    final result = await _mcp.callTool('get_workout_detail', {
      'workoutId': workoutId,
    });

    return Workout.fromJson(result);
  }

  /// Creates a new workout.
  Future<Workout> createWorkout({
    required String name,
    required String type,
    required DateTime date,
    String? description,
    int? duration,
    List<String>? tags,
  }) async {
    final args = <String, dynamic>{
      'name': name,
      'type': type,
      'date': date.toIso8601String(),
    };
    if (description != null) args['description'] = description;
    if (duration != null) args['duration'] = duration;
    if (tags != null && tags.isNotEmpty) args['tags'] = tags;

    final result = await _mcp.callTool('create_workout', args);
    return Workout.fromJson(result);
  }

  /// Updates an existing workout.
  Future<Workout> updateWorkout({
    required String workoutId,
    String? name,
    String? type,
    String? date,
    String? description,
    int? duration,
    List<String>? tags,
  }) async {
    final args = <String, dynamic>{'workoutId': workoutId};
    if (name != null) args['name'] = name;
    if (type != null) args['type'] = type;
    if (date != null) args['date'] = date;
    if (description != null) args['description'] = description;
    if (duration != null) args['duration'] = duration;
    if (tags != null) args['tags'] = tags;

    final result = await _mcp.callTool('update_workout', args);
    return Workout.fromJson(result);
  }

  /// Deletes a workout.
  Future<void> deleteWorkout(String workoutId) async {
    await _mcp.callTool('delete_workout', {'workoutId': workoutId});
  }

  /// Marks a workout as completed or resets it.
  Future<Workout> completeWorkout({
    required String workoutId,
    required bool completed,
    String? notes,
  }) async {
    final args = <String, dynamic>{
      'workoutId': workoutId,
      'completed': completed,
    };
    if (notes != null) args['notes'] = notes;

    final result = await _mcp.callTool('complete_workout', args);
    return Workout.fromJson(result);
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  /// Gets comments for a workout.
  Future<List<WorkoutComment>> getComments(String workoutId) async {
    final result = await _mcp.callTool('get_workout_comments', {
      'workoutId': workoutId,
    });

    final comments = result['comments'] as List<dynamic>? ?? [];
    return comments
        .map((c) => WorkoutComment.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Adds a comment to a workout.
  Future<WorkoutComment> addComment({
    required String workoutId,
    required String text,
    String? rating,
  }) async {
    final args = <String, dynamic>{
      'workoutId': workoutId,
      'text': text,
    };
    if (rating != null) args['rating'] = rating;

    final result = await _mcp.callTool('add_workout_comment', args);
    return WorkoutComment.fromJson(result);
  }

  // ---------------------------------------------------------------------------
  // Stats & PRs
  // ---------------------------------------------------------------------------

  /// Gets user workout statistics.
  Future<UserStats> getStats() async {
    final result = await _mcp.callTool('get_user_stats', {});
    return UserStats.fromJson(result);
  }

  /// Gets personal records.
  Future<List<PersonalRecord>> getPersonalRecords() async {
    final result = await _mcp.callTool('get_personal_records', {});
    final records = result['records'] as List<dynamic>? ?? [];
    return records
        .map((r) => PersonalRecord.fromJson(r as Map<String, dynamic>))
        .toList();
  }
}

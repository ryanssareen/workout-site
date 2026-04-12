/// Per-type statistics.
class TypeStats {
  final int total;
  final int completed;
  final int pending;
  final String completionRate;

  const TypeStats({
    required this.total,
    required this.completed,
    required this.pending,
    required this.completionRate,
  });

  factory TypeStats.fromJson(Map<String, dynamic> json) {
    return TypeStats(
      total: json['total'] as int? ?? 0,
      completed: json['completed'] as int? ?? 0,
      pending: json['pending'] as int? ?? 0,
      completionRate: json['completionRate'] as String? ?? '0%',
    );
  }

  Map<String, dynamic> toJson() => {
        'total': total,
        'completed': completed,
        'pending': pending,
        'completionRate': completionRate,
      };
}

/// Aggregate user workout statistics returned by the MCP `get_user_stats` tool.
class UserStats {
  final int total;
  final int completed;
  final int pending;
  final String completionRate;
  final int totalDuration; // minutes
  final int thisWeek; // workouts this week
  final int streak; // consecutive days
  final Map<String, TypeStats> byType;

  const UserStats({
    required this.total,
    required this.completed,
    required this.pending,
    required this.completionRate,
    this.totalDuration = 0,
    this.thisWeek = 0,
    this.streak = 0,
    required this.byType,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    final byTypeRaw = json['byType'] as Map<String, dynamic>? ?? {};
    final byType = byTypeRaw.map(
      (key, value) => MapEntry(
        key,
        TypeStats.fromJson(value as Map<String, dynamic>),
      ),
    );

    return UserStats(
      total: json['total'] as int? ?? 0,
      completed: json['completed'] as int? ?? 0,
      pending: json['pending'] as int? ?? 0,
      completionRate: json['completionRate'] as String? ?? '0%',
      totalDuration: json['totalDuration'] as int? ?? 0,
      thisWeek: json['thisWeek'] as int? ?? 0,
      streak: json['streak'] as int? ?? 0,
      byType: byType,
    );
  }

  Map<String, dynamic> toJson() => {
        'total': total,
        'completed': completed,
        'pending': pending,
        'completionRate': completionRate,
        'totalDuration': totalDuration,
        'thisWeek': thisWeek,
        'streak': streak,
        'byType': byType.map((k, v) => MapEntry(k, v.toJson())),
      };
}

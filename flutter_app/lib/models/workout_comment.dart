/// A comment on a workout.
class WorkoutComment {
  final String id;
  final String userId;
  final String userName;
  final String? userRole;
  final String text;
  final String? rating; // 'too_easy', 'just_right', 'too_hard'
  final DateTime? createdAt;
  final String? parentCommentId;

  const WorkoutComment({
    required this.id,
    required this.userId,
    required this.userName,
    required this.text,
    this.userRole,
    this.rating,
    this.createdAt,
    this.parentCommentId,
  });

  factory WorkoutComment.fromJson(Map<String, dynamic> json) {
    return WorkoutComment(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      userName: json['userName'] as String? ?? '',
      userRole: json['userRole'] as String?,
      text: json['text'] as String? ?? '',
      rating: json['rating'] as String?,
      createdAt: _parseDate(json['createdAt']),
      parentCommentId: json['parentCommentId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'userName': userName,
        'userRole': userRole,
        'text': text,
        'rating': rating,
        'createdAt': createdAt?.toIso8601String(),
        'parentCommentId': parentCommentId,
      };

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is String) return DateTime.tryParse(value);
    if (value is Map) {
      final seconds = value['_seconds'] ?? value['seconds'];
      if (seconds is int) {
        return DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
      }
    }
    return null;
  }
}

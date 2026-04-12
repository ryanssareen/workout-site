import '../core/constants/app_constants.dart';

/// Workout model matching the SafeWorkout shape from the MCP server.
class Workout {
  final String id;
  final String name;
  final String type; // swim, bike, run, walk, strength, other
  final DateTime date;
  final bool completed;
  final int? duration; // minutes
  final String? assignedTo;
  final String? createdBy;
  final String? description;
  final List<String> tags;
  final String? source;
  final DateTime? completedAt;
  final bool completedLate;
  final String? rating;
  final String? feedback;

  // Sport-specific data — kept as flexible maps
  final Map<String, dynamic>? swim;
  final Map<String, dynamic>? bike;
  final Map<String, dynamic>? run;
  final Map<String, dynamic>? strength;
  final Map<String, dynamic>? walk;

  const Workout({
    required this.id,
    required this.name,
    required this.type,
    required this.date,
    this.completed = false,
    this.duration,
    this.assignedTo,
    this.createdBy,
    this.description,
    this.tags = const [],
    this.source,
    this.completedAt,
    this.completedLate = false,
    this.rating,
    this.feedback,
    this.swim,
    this.bike,
    this.run,
    this.strength,
    this.walk,
  });

  factory Workout.fromJson(Map<String, dynamic> json) {
    return Workout(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Untitled Workout',
      type: json['type'] as String? ?? 'other',
      date: _parseDate(json['date']) ?? DateTime.now(),
      completed: json['completed'] as bool? ?? false,
      duration: json['duration'] as int?,
      assignedTo: json['assignedTo'] as String?,
      createdBy: json['createdBy'] as String?,
      description: json['description'] as String?,
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      source: json['source'] as String?,
      completedAt: _parseDate(json['completedAt']),
      completedLate: json['completedLate'] as bool? ?? false,
      rating: json['rating'] as String?,
      feedback: json['feedback'] as String?,
      swim: _asMap(json['swim']),
      bike: _asMap(json['bike']),
      run: _asMap(json['run']),
      strength: _asMap(json['strength']),
      walk: _asMap(json['walk']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'date': date.toIso8601String(),
        'completed': completed,
        if (duration != null) 'duration': duration,
        if (assignedTo != null) 'assignedTo': assignedTo,
        if (createdBy != null) 'createdBy': createdBy,
        if (description != null) 'description': description,
        if (tags.isNotEmpty) 'tags': tags,
        if (source != null) 'source': source,
        if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
        if (completedLate) 'completedLate': completedLate,
        if (rating != null) 'rating': rating,
        if (feedback != null) 'feedback': feedback,
        if (swim != null) 'swim': swim,
        if (bike != null) 'bike': bike,
        if (run != null) 'run': run,
        if (strength != null) 'strength': strength,
        if (walk != null) 'walk': walk,
      };

  WorkoutType get workoutType => WorkoutType.fromString(type);

  bool get isPlanned => !completed && date.isAfter(DateTime.now());

  bool get isPast =>
      completed || date.isBefore(DateTime.now().subtract(const Duration(hours: 1)));

  Workout copyWith({
    String? id,
    String? name,
    String? type,
    DateTime? date,
    bool? completed,
    int? duration,
    String? assignedTo,
    String? createdBy,
    String? description,
    List<String>? tags,
    String? source,
    DateTime? completedAt,
    bool? completedLate,
    String? rating,
    String? feedback,
  }) {
    return Workout(
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      date: date ?? this.date,
      completed: completed ?? this.completed,
      duration: duration ?? this.duration,
      assignedTo: assignedTo ?? this.assignedTo,
      createdBy: createdBy ?? this.createdBy,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      source: source ?? this.source,
      completedAt: completedAt ?? this.completedAt,
      completedLate: completedLate ?? this.completedLate,
      rating: rating ?? this.rating,
      feedback: feedback ?? this.feedback,
      swim: swim,
      bike: bike,
      run: run,
      strength: strength,
      walk: walk,
    );
  }

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

  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    return null;
  }
}

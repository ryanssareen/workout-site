import 'dart:ui';

enum WorkoutType {
  swim,
  bike,
  run,
  walk,
  strength,
  other;

  String get displayName {
    switch (this) {
      case WorkoutType.swim:
        return 'Swim';
      case WorkoutType.bike:
        return 'Bike';
      case WorkoutType.run:
        return 'Run';
      case WorkoutType.walk:
        return 'Walk';
      case WorkoutType.strength:
        return 'Strength';
      case WorkoutType.other:
        return 'Other';
    }
  }

  String get emoji {
    switch (this) {
      case WorkoutType.swim:
        return '\u{1F3CA}';
      case WorkoutType.bike:
        return '\u{1F6B4}';
      case WorkoutType.run:
        return '\u{1F3C3}';
      case WorkoutType.walk:
        return '\u{1F6B6}';
      case WorkoutType.strength:
        return '\u{1F4AA}';
      case WorkoutType.other:
        return '\u{1F3AF}';
    }
  }

  static WorkoutType fromString(String value) {
    return WorkoutType.values.firstWhere(
      (t) => t.name == value.toLowerCase(),
      orElse: () => WorkoutType.other,
    );
  }
}

class SportColors {
  SportColors._();

  static const Color run = Color(0xFF3B82F6); // blue-500
  static const Color bike = Color(0xFF22C55E); // green-500
  static const Color swim = Color(0xFF06B6D4); // cyan-500
  static const Color strength = Color(0xFFA855F7); // purple-500
  static const Color walk = Color(0xFFF97316); // orange-500
  static const Color other = Color(0xFF6B7280); // gray-500

  static Color forType(WorkoutType type) {
    switch (type) {
      case WorkoutType.run:
        return run;
      case WorkoutType.bike:
        return bike;
      case WorkoutType.swim:
        return swim;
      case WorkoutType.strength:
        return strength;
      case WorkoutType.walk:
        return walk;
      case WorkoutType.other:
        return other;
    }
  }
}

class AppConstants {
  AppConstants._();

  static const int defaultWorkoutLimit = 20;
  static const int maxWorkoutsPerPage = 50;
  static const String appName = 'The Daily Athlete';
  static const Duration cacheTtl = Duration(minutes: 5);
}

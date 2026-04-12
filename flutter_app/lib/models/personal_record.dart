/// A personal record entry.
class PersonalRecord {
  final String id;
  final String category; // e.g., 'run', 'bike', 'swim', 'strength'
  final String name; // e.g., 'Longest Run', 'Fastest 5K'
  final dynamic value; // number or string
  final String? unit; // e.g., 'km', 'min', 'kg'
  final DateTime? date;
  final dynamic previousValue;
  final String? notes;
  final String? workoutId;

  const PersonalRecord({
    required this.id,
    required this.category,
    required this.name,
    this.value,
    this.unit,
    this.date,
    this.previousValue,
    this.notes,
    this.workoutId,
  });

  factory PersonalRecord.fromJson(Map<String, dynamic> json) {
    return PersonalRecord(
      id: json['id'] as String? ?? '',
      category: json['category'] as String? ?? '',
      name: json['name'] as String? ?? '',
      value: json['value'],
      unit: json['unit'] as String?,
      date: _parseDate(json['date']),
      previousValue: json['previousValue'],
      notes: json['notes'] as String?,
      workoutId: json['workoutId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'category': category,
        'name': name,
        'value': value,
        'unit': unit,
        'date': date?.toIso8601String(),
        'previousValue': previousValue,
        'notes': notes,
        'workoutId': workoutId,
      };

  /// Display value with unit, e.g. "42.2 km".
  String get displayValue {
    final v = value?.toString() ?? '?';
    return unit != null ? '$v $unit' : v;
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
}

/// User model matching the SafeUser shape from the MCP server.
class User {
  final String username;
  final String? displayName;
  final String? email;
  final String role; // 'coach', 'athlete', 'student'
  final String? coachUsername;
  final DateTime? createdAt;
  final bool onboardingCompleted;
  final bool stravaConnected;
  final String? photoURL;
  final String? bio;
  final String? profileTagline;
  final bool profilePublic;
  final String? ageRange;
  final String? experienceLevel;
  final List<String> sportPreferences;
  final String? trainingFor;

  const User({
    required this.username,
    this.displayName,
    this.email,
    this.role = 'athlete',
    this.coachUsername,
    this.createdAt,
    this.onboardingCompleted = false,
    this.stravaConnected = false,
    this.photoURL,
    this.bio,
    this.profileTagline,
    this.profilePublic = false,
    this.ageRange,
    this.experienceLevel,
    this.sportPreferences = const [],
    this.trainingFor,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String?,
      email: json['email'] as String?,
      role: json['role'] as String? ?? 'athlete',
      coachUsername: json['coachUsername'] as String?,
      createdAt: _parseDate(json['createdAt']),
      onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
      stravaConnected: json['stravaConnected'] as bool? ?? false,
      photoURL: json['photoURL'] as String?,
      bio: json['bio'] as String?,
      profileTagline: json['profileTagline'] as String?,
      profilePublic: json['profilePublic'] as bool? ?? false,
      ageRange: json['ageRange'] as String?,
      experienceLevel: json['experienceLevel'] as String?,
      sportPreferences: (json['sportPreferences'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      trainingFor: json['trainingFor'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'username': username,
        'displayName': displayName,
        'email': email,
        'role': role,
        'coachUsername': coachUsername,
        'createdAt': createdAt?.toIso8601String(),
        'onboardingCompleted': onboardingCompleted,
        'stravaConnected': stravaConnected,
        'photoURL': photoURL,
        'bio': bio,
        'profileTagline': profileTagline,
        'profilePublic': profilePublic,
        'ageRange': ageRange,
        'experienceLevel': experienceLevel,
        'sportPreferences': sportPreferences,
        'trainingFor': trainingFor,
      };

  User copyWith({
    String? username,
    String? displayName,
    String? email,
    String? role,
    String? coachUsername,
    DateTime? createdAt,
    bool? onboardingCompleted,
    bool? stravaConnected,
    String? photoURL,
    String? bio,
    String? profileTagline,
    bool? profilePublic,
    String? ageRange,
    String? experienceLevel,
    List<String>? sportPreferences,
    String? trainingFor,
  }) {
    return User(
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      role: role ?? this.role,
      coachUsername: coachUsername ?? this.coachUsername,
      createdAt: createdAt ?? this.createdAt,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      stravaConnected: stravaConnected ?? this.stravaConnected,
      photoURL: photoURL ?? this.photoURL,
      bio: bio ?? this.bio,
      profileTagline: profileTagline ?? this.profileTagline,
      profilePublic: profilePublic ?? this.profilePublic,
      ageRange: ageRange ?? this.ageRange,
      experienceLevel: experienceLevel ?? this.experienceLevel,
      sportPreferences: sportPreferences ?? this.sportPreferences,
      trainingFor: trainingFor ?? this.trainingFor,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is String) return DateTime.tryParse(value);
    // Firestore Timestamp with _seconds
    if (value is Map) {
      final seconds = value['_seconds'] ?? value['seconds'];
      if (seconds is int) {
        return DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
      }
    }
    return null;
  }
}

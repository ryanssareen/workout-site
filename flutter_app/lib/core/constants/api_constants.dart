class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://www.thedailyathlete.in';
  static const String mcpEndpoint = '/api/mcp';
  static const String mcpUrl = '$baseUrl$mcpEndpoint';

  // Firebase Auth REST API
  static const String firebaseApiKey = 'AIzaSyB92ywaKH03zflEHZWSkMIJcPZtdYHhmdY';
  static const String _firebaseAuthBase =
      'https://identitytoolkit.googleapis.com/v1/accounts';
  static const String _firebaseTokenBase =
      'https://securetoken.googleapis.com/v1/token';

  static const String signInUrl =
      '$_firebaseAuthBase:signInWithPassword?key=$firebaseApiKey';
  static const String signUpUrl =
      '$_firebaseAuthBase:signUp?key=$firebaseApiKey';
  static const String refreshTokenUrl =
      '$_firebaseTokenBase?key=$firebaseApiKey';
  static const String resetPasswordUrl =
      '$_firebaseAuthBase:sendOobCode?key=$firebaseApiKey';
  static const String signInWithIdpUrl =
      '$_firebaseAuthBase:signInWithIdp?key=$firebaseApiKey';

  // App API routes
  static const String checkUsernameUrl = '$baseUrl/api/auth/check-username';
  static const String createUserUrl = '$baseUrl/api/auth/create-user';

  // Headers
  static const String authHeader = 'Authorization';
  static const String apiKeyHeader = 'x-api-key';
  static const String contentType = 'application/json';
  static const String mcpAccept = 'application/json, text/event-stream';
}

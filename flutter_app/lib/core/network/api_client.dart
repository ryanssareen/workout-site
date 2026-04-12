import 'package:dio/dio.dart';

import '../constants/api_constants.dart';

/// Exception for API-level errors (Firebase REST, app endpoints).
class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final dynamic data;

  ApiException({this.statusCode, required this.message, this.data});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Client for Firebase Auth REST API and app-specific endpoints.
class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  // ---------------------------------------------------------------------------
  // Firebase Auth
  // ---------------------------------------------------------------------------

  /// Signs in with email and password.
  ///
  /// Returns a map containing `idToken`, `refreshToken`, `localId` (UID),
  /// `email`, and `expiresIn`.
  Future<Map<String, dynamic>> signIn(String email, String password) async {
    return _firebaseAuthRequest(
      ApiConstants.signInUrl,
      {'email': email, 'password': password, 'returnSecureToken': true},
    );
  }

  /// Creates a new account with email and password.
  ///
  /// Returns a map containing `idToken`, `refreshToken`, `localId` (UID),
  /// `email`, and `expiresIn`.
  Future<Map<String, dynamic>> signUp(String email, String password) async {
    return _firebaseAuthRequest(
      ApiConstants.signUpUrl,
      {'email': email, 'password': password, 'returnSecureToken': true},
    );
  }

  /// Exchanges a refresh token for a new ID token.
  ///
  /// Returns a map containing `id_token`, `refresh_token`, `user_id`,
  /// and `expires_in`.
  Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.refreshTokenUrl,
        data: {
          'grant_type': 'refresh_token',
          'refresh_token': refreshToken,
        },
        options: Options(
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        ),
      );
      return response.data ?? {};
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// Sends a password reset email.
  Future<void> sendPasswordReset(String email) async {
    await _firebaseAuthRequest(
      ApiConstants.resetPasswordUrl,
      {'requestType': 'PASSWORD_RESET', 'email': email},
    );
  }

  // ---------------------------------------------------------------------------
  // App endpoints
  // ---------------------------------------------------------------------------

  /// Checks if a username is available.
  ///
  /// Returns `{'available': bool}`.
  Future<Map<String, dynamic>> checkUsername(String username) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.checkUsernameUrl,
        queryParameters: {'username': username},
      );
      return response.data ?? {};
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// Creates a user profile on the server after Firebase Auth sign-up.
  ///
  /// Requires the Firebase ID token for authorization.
  Future<Map<String, dynamic>> createUser({
    required String token,
    required String username,
    required String email,
    required String displayName,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.createUserUrl,
        data: {
          'username': username,
          'email': email,
          'displayName': displayName,
        },
        options: Options(
          headers: {
            'Content-Type': ApiConstants.contentType,
            ApiConstants.authHeader: 'Bearer $token',
          },
        ),
      );
      return response.data ?? {};
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> _firebaseAuthRequest(
    String url,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        url,
        data: body,
        options: Options(headers: {'Content-Type': ApiConstants.contentType}),
      );
      return response.data ?? {};
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  ApiException _handleDioError(DioException e) {
    final data = e.response?.data;
    String message = e.message ?? 'Unknown network error';

    // Firebase REST errors nest under `error.message`
    if (data is Map<String, dynamic> && data.containsKey('error')) {
      final error = data['error'];
      if (error is Map<String, dynamic>) {
        message = error['message'] as String? ?? message;
      } else if (error is String) {
        message = error;
      }
    }

    return ApiException(
      statusCode: e.response?.statusCode,
      message: _friendlyFirebaseError(message),
      data: data,
    );
  }

  /// Converts Firebase error codes to user-friendly messages.
  String _friendlyFirebaseError(String raw) {
    switch (raw) {
      case 'EMAIL_NOT_FOUND':
        return 'No account found with this email.';
      case 'INVALID_PASSWORD':
        return 'Incorrect password.';
      case 'USER_DISABLED':
        return 'This account has been disabled.';
      case 'EMAIL_EXISTS':
        return 'An account with this email already exists.';
      case 'WEAK_PASSWORD : Password should be at least 6 characters':
        return 'Password must be at least 6 characters.';
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return 'Too many attempts. Please try again later.';
      case 'INVALID_LOGIN_CREDENTIALS':
        return 'Invalid email or password.';
      default:
        if (raw.startsWith('WEAK_PASSWORD')) {
          return 'Password must be at least 6 characters.';
        }
        return raw;
    }
  }
}

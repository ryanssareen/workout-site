import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../storage/secure_storage.dart';
import 'api_client.dart';

/// Dio interceptor that attaches the Firebase ID token to outgoing requests
/// and handles automatic token refresh on 401 responses.
class AuthInterceptor extends Interceptor {
  final SecureStorageService _storage;
  final ApiClient _apiClient;

  /// Whether a token refresh is currently in progress.
  bool _isRefreshing = false;

  AuthInterceptor({
    required SecureStorageService storage,
    required ApiClient apiClient,
  })  : _storage = storage,
        _apiClient = apiClient;

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for Firebase auth endpoints (they use API key)
    final uri = options.uri.toString();
    if (uri.contains('identitytoolkit.googleapis.com') ||
        uri.contains('securetoken.googleapis.com')) {
      return handler.next(options);
    }

    final token = await _storage.getIdToken();
    if (token != null) {
      options.headers[ApiConstants.authHeader] = 'Bearer $token';
      print('[AUTH] Added token (${token.length} chars) to ${options.uri}');
    } else {
      print('[AUTH] No token available for ${options.uri}');
    }

    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // Don't treat quota exhaustion as an auth error
    final body = err.response?.data;
    if (body is Map && body['error']?.toString().contains('RESOURCE_EXHAUSTED') == true) {
      return handler.next(err);
    }
    if (body is String && body.contains('RESOURCE_EXHAUSTED')) {
      return handler.next(err);
    }

    // Avoid concurrent refresh attempts
    if (_isRefreshing) {
      return handler.next(err);
    }

    _isRefreshing = true;
    try {
      final refreshTokenValue = await _storage.getRefreshToken();
      if (refreshTokenValue == null) {
        _isRefreshing = false;
        return handler.next(err);
      }

      // Attempt token refresh
      final result = await _apiClient.refreshToken(refreshTokenValue);
      final newIdToken = result['id_token'] as String?;
      final newRefreshToken = result['refresh_token'] as String?;

      if (newIdToken == null) {
        _isRefreshing = false;
        return handler.next(err);
      }

      // Persist new tokens
      await _storage.saveTokens(
        newIdToken,
        newRefreshToken ?? refreshTokenValue,
      );

      _isRefreshing = false;

      // Retry the original request with the new token
      final options = err.requestOptions;
      options.headers[ApiConstants.authHeader] = 'Bearer $newIdToken';

      final retryDio = Dio(BaseOptions(
        connectTimeout: options.connectTimeout,
        receiveTimeout: options.receiveTimeout,
      ));

      final response = await retryDio.request<dynamic>(
        options.path,
        data: options.data,
        queryParameters: options.queryParameters,
        options: Options(
          method: options.method,
          headers: options.headers,
          responseType: options.responseType,
        ),
      );

      return handler.resolve(response);
    } catch (_) {
      _isRefreshing = false;
      // Clear tokens on refresh failure — user must re-authenticate
      await _storage.clearAll();
      return handler.next(err);
    }
  }
}

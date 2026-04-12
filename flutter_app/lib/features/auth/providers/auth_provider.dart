import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/auth_interceptor.dart';
import '../../../core/network/mcp_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../models/user.dart';
import '../data/auth_repository.dart';

// ---------------------------------------------------------------------------
// Core service providers
// ---------------------------------------------------------------------------

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

/// Raw Dio without auth interceptor — used for Firebase Auth REST calls
/// and for the ApiClient that the interceptor itself depends on.
final _baseDioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(_baseDioProvider));
});

/// Authenticated Dio with the [AuthInterceptor] attached.
final authenticatedDioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: ApiConstants.baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
    followRedirects: true,
    maxRedirects: 5,
  ));

  dio.interceptors.add(AuthInterceptor(
    storage: ref.watch(secureStorageProvider),
    apiClient: ref.watch(apiClientProvider),
  ));

  return dio;
});

final mcpClientProvider = Provider<McpClient>((ref) {
  return McpClient(ref.watch(authenticatedDioProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiClient: ref.watch(apiClientProvider),
    mcpClient: ref.watch(mcpClientProvider),
    storage: ref.watch(secureStorageProvider),
  );
});

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

/// Tracks whether the user is authenticated.
///
/// Checks for a stored session on app start, then updates on sign-in / sign-out.
final authStateProvider =
    StateNotifierProvider<AuthStateNotifier, AsyncValue<bool>>((ref) {
  return AuthStateNotifier(ref.watch(authRepositoryProvider));
});

class AuthStateNotifier extends StateNotifier<AsyncValue<bool>> {
  final AuthRepository _repo;

  AuthStateNotifier(this._repo) : super(const AsyncValue.loading()) {
    _checkSession();
  }

  Future<void> _checkSession() async {
    try {
      final hasSession = await _repo.hasStoredSession();
      state = AsyncValue.data(hasSession);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<User> signIn(String email, String password) async {
    final user = await _repo.signIn(email, password);
    state = const AsyncValue.data(true);
    return user;
  }

  Future<User> signUp({
    required String email,
    required String password,
    required String username,
    required String displayName,
  }) async {
    final user = await _repo.signUp(
      email: email,
      password: password,
      username: username,
      displayName: displayName,
    );
    state = const AsyncValue.data(true);
    return user;
  }

  Future<void> signOut() async {
    await _repo.signOut();
    state = const AsyncValue.data(false);
  }
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/// Provides the current user profile. Re-fetched when auth state changes.
final currentUserProvider = FutureProvider<User?>((ref) async {
  final isLoggedIn = ref.watch(authStateProvider).valueOrNull ?? false;
  if (!isLoggedIn) return null;

  final repo = ref.watch(authRepositoryProvider);
  try {
    return await repo.fetchProfile();
  } catch (_) {
    return null;
  }
});

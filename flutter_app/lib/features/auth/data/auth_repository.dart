import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/mcp_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../models/user.dart';

/// Repository managing authentication and user profile retrieval.
class AuthRepository {
  final ApiClient _apiClient;
  final McpClient _mcpClient;
  final SecureStorageService _storage;

  AuthRepository({
    required ApiClient apiClient,
    required McpClient mcpClient,
    required SecureStorageService storage,
  })  : _apiClient = apiClient,
        _mcpClient = mcpClient,
        _storage = storage;

  /// Signs in with email and password.
  ///
  /// Stores tokens in secure storage and fetches the user profile from MCP.
  Future<User> signIn(String email, String password) async {
    final result = await _apiClient.signIn(email, password);

    final idToken = result['idToken'] as String;
    final refreshToken = result['refreshToken'] as String;
    final uid = result['localId'] as String;

    await _storage.saveTokens(idToken, refreshToken);
    await _storage.saveUserInfo(uid: uid, email: email);

    return _fetchProfile();
  }

  /// Creates a new account with email and password.
  ///
  /// After Firebase Auth sign-up, creates the user profile on the server,
  /// then fetches the full profile from MCP.
  Future<User> signUp({
    required String email,
    required String password,
    required String username,
    required String displayName,
  }) async {
    final result = await _apiClient.signUp(email, password);

    final idToken = result['idToken'] as String;
    final refreshToken = result['refreshToken'] as String;
    final uid = result['localId'] as String;

    await _storage.saveTokens(idToken, refreshToken);
    await _storage.saveUserInfo(uid: uid, email: email);

    // Create server-side profile
    await _apiClient.createUser(
      token: idToken,
      username: username,
      email: email,
      displayName: displayName,
    );

    return _fetchProfile();
  }

  /// Signs in with Google OAuth.
  ///
  /// Uses Google Sign-In SDK to get an ID token, then exchanges it for a
  /// Firebase ID token via signInWithIdp.
  Future<User> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn.instance;
    await googleSignIn.initialize(
      serverClientId: '1003604918622-68qdqc8p509dl2nijog6bogp8ivpbui3.apps.googleusercontent.com',
    );

    final account = await googleSignIn.authenticate();
    final googleIdToken = account.authentication.idToken;
    if (googleIdToken == null) throw Exception('Failed to get Google ID token');

    final result = await _apiClient.signInWithGoogleToken(googleIdToken);

    final idToken = result['idToken'] as String;
    final refreshToken = result['refreshToken'] as String;
    final uid = result['localId'] as String;
    final email = result['email'] as String? ?? account.email;
    final displayName = result['displayName'] as String? ?? account.displayName ?? '';
    final isNewUser = result['isNewUser'] as bool? ?? false;

    await _storage.saveTokens(idToken, refreshToken);
    await _storage.saveUserInfo(uid: uid, email: email);

    if (isNewUser) {
      final prefix = email.split('@').first.replaceAll(RegExp(r'[^a-z0-9_]'), '_');
      final username = prefix.substring(0, prefix.length.clamp(0, 20));
      await _apiClient.createUser(
        token: idToken,
        username: username,
        email: email,
        displayName: displayName,
      );
    }

    return _fetchProfile();
  }

  /// Signs out and clears all stored tokens.
  Future<void> signOut() async {
    await _storage.clearAll();
  }

  /// Refreshes the ID token using the stored refresh token.
  ///
  /// Returns the new ID token, or null if refresh failed.
  Future<String?> refreshToken() async {
    final currentRefresh = await _storage.getRefreshToken();
    if (currentRefresh == null) return null;

    try {
      final result = await _apiClient.refreshToken(currentRefresh);
      final newId = result['id_token'] as String?;
      final newRefresh = result['refresh_token'] as String?;

      if (newId != null) {
        await _storage.saveTokens(newId, newRefresh ?? currentRefresh);
        return newId;
      }
    } catch (_) {
      // Refresh failed — caller should handle sign-out
    }
    return null;
  }

  /// Checks if the user has stored tokens (persisted session).
  Future<bool> hasStoredSession() async {
    final token = await _storage.getIdToken();
    return token != null;
  }

  /// Fetches the current user's profile from MCP.
  Future<User> fetchProfile() => _fetchProfile();

  /// Checks if a username is available.
  Future<bool> checkUsername(String username) async {
    final result = await _apiClient.checkUsername(username);
    return result['available'] as bool? ?? false;
  }

  /// Sends a password reset email.
  Future<void> sendPasswordReset(String email) async {
    await _apiClient.sendPasswordReset(email);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  Future<User> _fetchProfile() async {
    final result = await _mcpClient.callTool('get_user_profile', {});
    return User.fromJson(result);
  }
}

import 'package:shared_preferences/shared_preferences.dart';

/// Wrapper around [SharedPreferences] for managing auth tokens.
class SecureStorageService {
  static const _keyIdToken = 'id_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyUid = 'uid';
  static const _keyEmail = 'email';

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  Future<void> saveTokens(String idToken, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.setString(_keyIdToken, idToken),
      prefs.setString(_keyRefreshToken, refreshToken),
    ]);
  }

  Future<String?> getIdToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyIdToken);
  }

  Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyRefreshToken);
  }

  // ---------------------------------------------------------------------------
  // User info (convenience, non-sensitive)
  // ---------------------------------------------------------------------------

  Future<void> saveUserInfo({required String uid, required String email}) async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.setString(_keyUid, uid),
      prefs.setString(_keyEmail, email),
    ]);
  }

  Future<String?> getUid() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUid);
  }

  Future<String?> getEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyEmail);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove(_keyIdToken),
      prefs.remove(_keyRefreshToken),
      prefs.remove(_keyUid),
      prefs.remove(_keyEmail),
    ]);
  }
}

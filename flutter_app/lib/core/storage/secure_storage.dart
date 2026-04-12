import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wrapper around [FlutterSecureStorage] for managing auth tokens.
class SecureStorageService {
  static const _keyIdToken = 'id_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyUid = 'uid';
  static const _keyEmail = 'email';

  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  Future<void> saveTokens(String idToken, String refreshToken) async {
    await Future.wait([
      _storage.write(key: _keyIdToken, value: idToken),
      _storage.write(key: _keyRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> getIdToken() => _storage.read(key: _keyIdToken);

  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);

  // ---------------------------------------------------------------------------
  // User info (convenience, non-sensitive)
  // ---------------------------------------------------------------------------

  Future<void> saveUserInfo({required String uid, required String email}) async {
    await Future.wait([
      _storage.write(key: _keyUid, value: uid),
      _storage.write(key: _keyEmail, value: email),
    ]);
  }

  Future<String?> getUid() => _storage.read(key: _keyUid);

  Future<String?> getEmail() => _storage.read(key: _keyEmail);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  Future<void> clearAll() => _storage.deleteAll();
}

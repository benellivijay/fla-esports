import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants/api_endpoints.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: false,
    ),
  );

  static const String keyAccessToken = 'ff_access_token';
  static const String keyRefreshToken = 'ff_refresh_token';
  static const String keyUserData = 'ff_user_data';
  static const String keyProfileData = 'ff_profile_data';
  static const String keyIsLoggedIn = 'ff_is_logged_in';

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 90),
        receiveTimeout: const Duration(seconds: 90),
        sendTimeout: const Duration(seconds: 90),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          try {
            final token = await _storage.read(key: keyAccessToken);
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {}
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401 &&
              error.response?.data?['code'] == 'TOKEN_EXPIRED') {
            final refreshed = await attemptTokenRefresh();
            if (refreshed) {
              final token = await _storage.read(key: keyAccessToken);
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $token';
              try {
                final cloneReq = await dio.fetch(opts);
                return handler.resolve(cloneReq);
              } catch (e) {
                return handler.next(error);
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Future<bool> attemptTokenRefresh() async {
    try {
      final refreshToken = await _storage.read(key: keyRefreshToken);
      if (refreshToken == null || refreshToken.isEmpty) return false;

      final res = await Dio().post(
        '${ApiEndpoints.baseUrl}${ApiEndpoints.refreshToken}',
        data: {'refreshToken': refreshToken},
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final newAccess = res.data['data']['accessToken'];
        final newRefresh = res.data['data']['refreshToken'];
        await saveTokens(accessToken: newAccess, refreshToken: newRefresh);
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    try {
      await _storage.write(key: keyAccessToken, value: accessToken);
      await _storage.write(key: keyRefreshToken, value: refreshToken);
      await _storage.write(key: keyIsLoggedIn, value: 'true');
    } catch (_) {}
  }

  Future<void> saveUserSession({
    required String accessToken,
    required String refreshToken,
    Map<String, dynamic>? user,
    Map<String, dynamic>? profile,
  }) async {
    try {
      await _storage.write(key: keyAccessToken, value: accessToken);
      await _storage.write(key: keyRefreshToken, value: refreshToken);
      await _storage.write(key: keyIsLoggedIn, value: 'true');
      if (user != null) {
        await _storage.write(key: keyUserData, value: jsonEncode(user));
      }
      if (profile != null) {
        await _storage.write(key: keyProfileData, value: jsonEncode(profile));
      }
    } catch (_) {}
  }

  Future<void> saveCachedUser(Map<String, dynamic> user) async {
    try {
      await _storage.write(key: keyUserData, value: jsonEncode(user));
    } catch (_) {}
  }

  Future<void> saveCachedProfile(Map<String, dynamic> profile) async {
    try {
      await _storage.write(key: keyProfileData, value: jsonEncode(profile));
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getCachedUser() async {
    try {
      final str = await _storage.read(key: keyUserData);
      if (str != null && str.isNotEmpty) {
        return jsonDecode(str) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getCachedProfile() async {
    try {
      final str = await _storage.read(key: keyProfileData);
      if (str != null && str.isNotEmpty) {
        return jsonDecode(str) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<bool> isLoggedIn() async {
    try {
      final loggedInFlag = await _storage.read(key: keyIsLoggedIn);
      if (loggedInFlag == 'true') return true;
      final token = await _storage.read(key: keyAccessToken);
      return token != null && token.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> clearTokens() async {
    try {
      await _storage.delete(key: keyAccessToken);
      await _storage.delete(key: keyRefreshToken);
      await _storage.delete(key: keyIsLoggedIn);
      await _storage.delete(key: keyUserData);
      await _storage.delete(key: keyProfileData);
    } catch (_) {}
  }

  Future<void> clearUserSession() async {
    await clearTokens();
  }

  Future<String?> getAccessToken() async {
    try {
      return await _storage.read(key: keyAccessToken);
    } catch (_) {
      return null;
    }
  }

  Future<bool> hasValidToken() async {
    try {
      final token = await _storage.read(key: keyAccessToken);
      return token != null && token.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  static const String keyGoogleEmail = 'ff_google_email';
  static const String keyGoogleName = 'ff_google_name';
  static const String keyGoogleId = 'ff_google_id';

  Future<Map<String, String>> getOrCreatePersistentGoogleAccount() async {
    try {
      final savedEmail = await _storage.read(key: keyGoogleEmail);
      final savedName = await _storage.read(key: keyGoogleName);
      final savedId = await _storage.read(key: keyGoogleId);

      if (savedEmail != null && savedEmail.isNotEmpty) {
        return {
          'email': savedEmail,
          'displayName': savedName ?? 'Google Player',
          'googleId': savedId ?? '',
        };
      }
    } catch (_) {}

    // Generate a fixed, persistent ID for this installation
    final uniqueId = DateTime.now().millisecondsSinceEpoch.toString().substring(5);
    final newEmail = 'player_g$uniqueId@gmail.com';
    const newName = 'Google Player';

    try {
      await _storage.write(key: keyGoogleEmail, value: newEmail);
      await _storage.write(key: keyGoogleName, value: newName);
      await _storage.write(key: keyGoogleId, value: uniqueId);
    } catch (_) {}

    return {
      'email': newEmail,
      'displayName': newName,
      'googleId': uniqueId,
    };
  }

  Future<void> savePersistentGoogleAccount({required String email, String? displayName, String? googleId}) async {
    try {
      await _storage.write(key: keyGoogleEmail, value: email);
      if (displayName != null) {
        await _storage.write(key: keyGoogleName, value: displayName);
      }
      if (googleId != null) {
        await _storage.write(key: keyGoogleId, value: googleId);
      }
    } catch (_) {}
  }
}

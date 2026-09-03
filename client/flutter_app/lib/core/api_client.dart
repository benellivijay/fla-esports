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
      resetOnError: true,
    ),
  );

  static const String keyAccessToken = 'ff_access_token';
  static const String keyRefreshToken = 'ff_refresh_token';

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
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {}
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401 &&
              error.response?.data?['code'] == 'TOKEN_EXPIRED') {
            final refreshed = await _attemptTokenRefresh();
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

  Future<bool> _attemptTokenRefresh() async {
    try {
      final refreshToken = await _storage.read(key: keyRefreshToken);
      if (refreshToken == null) return false;

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
    await clearTokens();
    return false;
  }

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    try {
      await _storage.write(key: keyAccessToken, value: accessToken);
      await _storage.write(key: keyRefreshToken, value: refreshToken);
    } catch (_) {}
  }

  Future<void> clearTokens() async {
    try {
      await _storage.delete(key: keyAccessToken);
      await _storage.delete(key: keyRefreshToken);
    } catch (_) {}
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

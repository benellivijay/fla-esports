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
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
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
}

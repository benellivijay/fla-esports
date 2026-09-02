import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/auth_state.dart';
import '../models/user_model.dart';
import '../../profile/models/profile_model.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient = ApiClient();

  AuthNotifier() : super(const AuthState()) {
    checkInitialAuth();
  }

  Future<void> checkInitialAuth() async {
    final hasToken = await _apiClient.hasValidToken();
    if (!hasToken) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    try {
      final res = await _apiClient.dio.get(ApiEndpoints.profileMe);
      if (res.statusCode == 200 && res.data['success'] == true) {
        final profile = ProfileModel.fromJson(res.data['data']['profile']);
        state = state.copyWith(
          status: AuthStatus.authenticated,
          profile: profile,
        );
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> sendOtp({required String identifier, required String type}) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.sendOtp,
        data: {'identifier': identifier, 'type': type},
      );

      if (res.statusCode == 200) {
        final otp = res.data['otp'] ?? res.data['debugOtp'];
        state = state.copyWith(
          status: AuthStatus.otpSent,
          pendingIdentifier: identifier,
          identifierType: type,
          lastGeneratedOtp: otp != null ? otp.toString() : null,
        );
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to send OTP. Please try again.';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
    }
  }

  Future<bool> verifyOtp({required String otpCode, String? name}) async {
    if (state.pendingIdentifier == null || state.identifierType == null) {
      state = state.copyWith(errorMessage: 'Session expired. Please request OTP again.');
      return false;
    }

    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.verifyOtp,
        data: {
          'identifier': state.pendingIdentifier,
          'otpCode': otpCode,
          'type': state.identifierType,
          if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final data = res.data['data'];
        final user = UserModel.fromJson(data['user']);
        final profile = ProfileModel.fromJson(data['profile']);

        await _apiClient.saveTokens(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
        );

        state = state.copyWith(
          status: AuthStatus.authenticated,
          user: user,
          profile: profile,
        );
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Invalid OTP code. Please check and retry.';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
    }
  }

  Future<void> logout() async {
    try {
      final refresh = await _apiClient.getAccessToken();
      if (refresh != null) {
        await _apiClient.dio.post(ApiEndpoints.logout, data: {'refreshToken': refresh});
      }
    } catch (_) {}
    await _apiClient.clearTokens();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

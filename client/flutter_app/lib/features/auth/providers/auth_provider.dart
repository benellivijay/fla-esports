import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
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

  Future<bool> signIn({
    required String identifier,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.signin,
        data: {
          'identifier': identifier.trim(),
          'password': password,
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
      final msg = (e as dynamic).response?.data?['message'] ?? 'Incorrect username/email or password';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
    }
  }

  Future<bool> register({
    required String username,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.register,
        data: {
          'username': username.trim(),
          'email': email.trim().toLowerCase(),
          'password': password,
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        state = state.copyWith(
          status: AuthStatus.otpSent,
          pendingIdentifier: email.trim().toLowerCase(),
        );
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to send verification code.';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
    }
  }

  Future<bool> verifyRegistrationOtp({
    required String email,
    required String code,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.verifyOtp,
        data: {
          'email': email.trim().toLowerCase(),
          'code': code.trim(),
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
      final msg = (e as dynamic).response?.data?['message'] ?? 'Invalid verification code.';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
    }
  }

  Future<bool> resendRegistrationOtp({required String email}) async {
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.resendOtp,
        data: {
          'email': email.trim().toLowerCase(),
        },
      );
      return res.statusCode == 200 && res.data['success'] == true;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to resend code.';
      state = state.copyWith(errorMessage: msg);
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(
        scopes: ['email', 'profile'],
      );

      final GoogleSignInAccount? account = await googleSignIn.signIn();
      if (account == null) {
        state = state.copyWith(status: AuthStatus.unauthenticated);
        return false;
      }

      final GoogleSignInAuthentication auth = await account.authentication;

      final res = await _apiClient.dio.post(
        ApiEndpoints.googleAuth,
        data: {
          'idToken': auth.idToken,
          'email': account.email,
          'name': account.displayName,
          'avatarUrl': account.photoUrl,
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
      final msg = (e as dynamic).response?.data?['message'] ?? 'Google authentication failed.';
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return false;
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
        state = state.copyWith(
          status: AuthStatus.otpSent,
          pendingIdentifier: identifier,
          identifierType: type,
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

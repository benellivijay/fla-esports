import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/auth_state.dart';
import '../models/user_model.dart';
import '../../profile/models/profile_model.dart';

class GoogleAccountDetails {
  final String? idToken;
  final String email;
  final String? displayName;
  final String? photoUrl;
  final String? googleId;

  GoogleAccountDetails({
    this.idToken,
    required this.email,
    this.displayName,
    this.photoUrl,
    this.googleId,
  });
}

class GoogleAuthResult {
  final bool success;
  final bool isNewUser;
  final bool cancelled;
  final String? errorMessage;
  final GoogleAccountDetails? account;
  final String? suggestedUsername;

  GoogleAuthResult({
    required this.success,
    this.isNewUser = false,
    this.cancelled = false,
    this.errorMessage,
    this.account,
    this.suggestedUsername,
  });
}

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

  String _extractErrorMessage(dynamic e, String defaultMsg) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      if (e.message != null && e.message!.isNotEmpty) {
        return e.message!;
      }
    } else if (e is PlatformException) {
      if (e.message != null && e.message!.isNotEmpty) {
        return e.message!;
      }
    }
    return defaultMsg;
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
      final msg = _extractErrorMessage(e, 'Incorrect username/email or password');
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
      final msg = _extractErrorMessage(e, 'Failed to send verification code.');
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
      final msg = _extractErrorMessage(e, 'Invalid verification code.');
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
      final msg = _extractErrorMessage(e, 'Failed to resend code.');
      state = state.copyWith(errorMessage: msg);
      return false;
    }
  }

  /**
   * Checks if a chosen username is available in real time.
   */
  Future<bool> checkUsernameAvailable(String username) async {
    try {
      final res = await _apiClient.dio.get(
        ApiEndpoints.checkUsername,
        queryParameters: {'username': username.trim().toLowerCase()},
      );
      if (res.statusCode == 200 && res.data['success'] == true) {
        return res.data['data']?['available'] == true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /**
   * Completes Google sign in / sign up with a chosen username or checks if new user.
   */
  Future<GoogleAuthResult> handleGoogleSignIn({
    String? chosenUsername,
    GoogleAccountDetails? accountDetails,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      GoogleAccountDetails? details = accountDetails;

      if (details == null) {
        final GoogleSignIn googleSignIn = GoogleSignIn(
          scopes: ['email', 'profile'],
        );

        GoogleSignInAccount? account;
        try {
          account = await googleSignIn.signIn();
        } on PlatformException catch (pe) {
          state = state.copyWith(status: AuthStatus.unauthenticated);
          if (pe.code == 'sign_in_canceled') {
            return GoogleAuthResult(success: false, cancelled: true);
          }
          return GoogleAuthResult(
            success: false,
            errorMessage: pe.message ?? 'Google Sign-In failed (${pe.code}).',
          );
        } catch (e) {
          state = state.copyWith(status: AuthStatus.unauthenticated);
          return GoogleAuthResult(
            success: false,
            errorMessage: e.toString(),
          );
        }

        if (account == null) {
          state = state.copyWith(status: AuthStatus.unauthenticated);
          return GoogleAuthResult(success: false, cancelled: true);
        }

        GoogleSignInAuthentication? auth;
        try {
          auth = await account.authentication;
        } catch (_) {}

        details = GoogleAccountDetails(
          idToken: auth?.idToken,
          email: account.email,
          displayName: account.displayName,
          photoUrl: account.photoUrl,
          googleId: account.id,
        );
      }

      // If no username provided yet, check if this is an existing user or new user
      if (chosenUsername == null) {
        final checkRes = await _apiClient.dio.post(
          ApiEndpoints.googleAuth,
          data: {
            if (details.idToken != null) 'idToken': details.idToken,
            'email': details.email.trim().toLowerCase(),
            if (details.displayName != null && details.displayName!.trim().isNotEmpty) 'name': details.displayName!.trim(),
            if (details.photoUrl != null && details.photoUrl!.isNotEmpty) 'avatarUrl': details.photoUrl,
            if (details.googleId != null && details.googleId!.isNotEmpty) 'googleId': details.googleId,
            'checkOnly': true,
          },
        );

        if (checkRes.statusCode == 200 && checkRes.data['success'] == true) {
          final data = checkRes.data['data'];
          final isNewUser = data['isNewUser'] == true;

          if (isNewUser) {
            // Player is new -> Prompt for username selection
            state = state.copyWith(status: AuthStatus.unauthenticated);
            return GoogleAuthResult(
              success: true,
              isNewUser: true,
              account: details,
              suggestedUsername: data['suggestedUsername'] ??
                  (details.displayName ?? details.email.split('@')[0])
                      .replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_')
                      .toLowerCase(),
            );
          } else {
            // Existing user -> Proceed with sign in
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
            return GoogleAuthResult(success: true, isNewUser: false);
          }
        }
      }

      // Complete registration with the chosen username
      final res = await _apiClient.dio.post(
        ApiEndpoints.googleAuth,
        data: {
          if (details.idToken != null) 'idToken': details.idToken,
          'email': details.email.trim().toLowerCase(),
          if (details.displayName != null && details.displayName!.trim().isNotEmpty) 'name': details.displayName!.trim(),
          if (details.photoUrl != null && details.photoUrl!.isNotEmpty) 'avatarUrl': details.photoUrl,
          if (details.googleId != null && details.googleId!.isNotEmpty) 'googleId': details.googleId,
          if (chosenUsername != null) 'username': chosenUsername.trim().toLowerCase(),
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
        return GoogleAuthResult(success: true, isNewUser: data['isNewUser'] == true);
      }
      state = state.copyWith(status: AuthStatus.error, errorMessage: 'Google sign-in could not be completed.');
      return GoogleAuthResult(success: false, errorMessage: 'Google sign-in could not be completed.');
    } catch (e) {
      final msg = _extractErrorMessage(e, 'Google authentication failed.');
      state = state.copyWith(status: AuthStatus.error, errorMessage: msg);
      return GoogleAuthResult(success: false, errorMessage: msg);
    }
  }

  Future<bool> signInWithGoogle() async {
    final res = await handleGoogleSignIn();
    return res.success && !res.isNewUser;
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
      final msg = _extractErrorMessage(e, 'Failed to send OTP. Please try again.');
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
      final msg = _extractErrorMessage(e, 'Invalid OTP code. Please check and retry.');
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

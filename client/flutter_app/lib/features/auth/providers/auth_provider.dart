import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/auth_state.dart';
import '../models/user_model.dart';
import '../screens/google_web_auth_screen.dart';
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
  final bool requiresWebAuth;
  final String? errorMessage;
  final GoogleAccountDetails? account;
  final String? suggestedUsername;

  GoogleAuthResult({
    required this.success,
    this.isNewUser = false,
    this.cancelled = false,
    this.requiresWebAuth = false,
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
    final isLoggedIn = await _apiClient.isLoggedIn();
    final hasToken = await _apiClient.hasValidToken();

    if (!isLoggedIn && !hasToken) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    // 1. Immediately restore locally cached user & profile for instant startup
    final cachedUserJson = await _apiClient.getCachedUser();
    final cachedProfileJson = await _apiClient.getCachedProfile();

    UserModel? user;
    ProfileModel? profile;
    if (cachedUserJson != null) {
      try {
        user = UserModel.fromJson(cachedUserJson);
      } catch (_) {}
    }
    if (cachedProfileJson != null) {
      try {
        profile = ProfileModel.fromJson(cachedProfileJson);
      } catch (_) {}
    }

    // Mark as authenticated immediately so the player is NEVER kicked out to login
    state = state.copyWith(
      status: AuthStatus.authenticated,
      user: user,
      profile: profile,
    );

    // 2. Silently sync latest profile from backend in the background
    try {
      final res = await _apiClient.dio.get(ApiEndpoints.profileMe);
      if (res.statusCode == 200 && res.data['success'] == true) {
        final profileData = res.data['data']?['profile'];
        if (profileData != null) {
          final updatedProfile = ProfileModel.fromJson(profileData);
          await _apiClient.saveCachedProfile(updatedProfile.toJson());
          state = state.copyWith(profile: updatedProfile);
        }
      }
    } catch (e) {
      // If token expired, attempt refresh
      if (e is DioException && e.response?.statusCode == 401) {
        final refreshed = await _apiClient.attemptTokenRefresh();
        if (refreshed) {
          try {
            final res = await _apiClient.dio.get(ApiEndpoints.profileMe);
            if (res.statusCode == 200 && res.data['success'] == true) {
              final profileData = res.data['data']?['profile'];
              if (profileData != null) {
                final updatedProfile = ProfileModel.fromJson(profileData);
                await _apiClient.saveCachedProfile(updatedProfile.toJson());
                state = state.copyWith(profile: updatedProfile);
              }
            }
          } catch (_) {}
        }
      }
      // Offline, server waking up, or network latency: KEEP PLAYER LOGGED IN!
    }
  }

  String _extractErrorMessage(dynamic e, String defaultMsg) {
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return 'Server is waking up. Please wait 10 seconds and tap Send code again.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Unable to connect to server. Please check internet connection.';
      }
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      if (e.message != null && e.message!.isNotEmpty && !e.message!.contains('0:00:')) {
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

        await _apiClient.saveUserSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: user.toJson(),
          profile: profile.toJson(),
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
    String? name,
    required String username,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.register,
        data: {
          if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
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

        await _apiClient.saveUserSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: user.toJson(),
          profile: profile.toJson(),
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

  /// Checks if a chosen username is available in real time.
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

  /// Fetches AI-generated gaming tag recommendations.
  Future<List<String>> fetchAiUsernames({String? name, String? email}) async {
    try {
      final res = await _apiClient.dio.get(
        ApiEndpoints.aiUsernames,
        queryParameters: {
          if (name != null && name.isNotEmpty) 'name': name,
          if (email != null && email.isNotEmpty) 'email': email,
        },
      );
      if (res.statusCode == 200 && res.data['success'] == true) {
        final List<dynamic>? list = res.data['data']?['suggestions'];
        if (list != null && list.isNotEmpty) {
          return list.map((e) => e.toString()).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  /// Completes Google sign in / sign up with your chosen name & username.
  Future<GoogleAuthResult> handleGoogleSignIn({
    String? chosenName,
    String? chosenUsername,
    GoogleAccountDetails? accountDetails,
    GoogleWebAuthPayload? webPayload,
  }) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);
    try {
      GoogleAccountDetails? details = accountDetails;

      if (details == null && webPayload != null) {
        details = GoogleAccountDetails(
          idToken: webPayload.idToken,
          email: webPayload.email ?? '',
          displayName: webPayload.displayName,
          photoUrl: webPayload.photoUrl,
          googleId: webPayload.googleId,
        );
      }

      if (details == null) {
        final GoogleSignIn googleSignIn = GoogleSignIn(
          serverClientId: ApiEndpoints.googleWebClientId,
          scopes: ['email', 'profile'],
        );

        // Always disconnect and signOut first so Google Play Services prompts the account selection dialog!
        try {
          await googleSignIn.signOut();
          await googleSignIn.disconnect();
        } catch (_) {}

        GoogleSignInAccount? account;
        try {
          account = await googleSignIn.signIn();
        } on PlatformException catch (pe) {
          if (pe.code == 'sign_in_canceled' || pe.code == '12501') {
            state = state.copyWith(status: AuthStatus.unauthenticated);
            return GoogleAuthResult(success: false, cancelled: true);
          }
          // On any native platform exception (e.g. 10: DEVELOPER_ERROR in emulators/MSI App Player), seamlessly trigger Webview OAuth!
          state = state.copyWith(status: AuthStatus.unauthenticated);
          return GoogleAuthResult(
            success: false,
            requiresWebAuth: true,
            errorMessage: pe.message ?? pe.code,
          );
        } catch (e) {
          state = state.copyWith(status: AuthStatus.unauthenticated);
          return GoogleAuthResult(
            success: false,
            requiresWebAuth: true,
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

      if (details.email.isEmpty) {
        state = state.copyWith(status: AuthStatus.error, errorMessage: 'Could not retrieve email from Google.');
        return GoogleAuthResult(success: false, errorMessage: 'Could not retrieve email from Google.');
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
            // Player is new -> Prompt for name and username selection
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
            // Existing user -> Automatically sign in directly without asking username!
            final user = UserModel.fromJson(data['user']);
            final profile = ProfileModel.fromJson(data['profile']);

            await _apiClient.saveUserSession(
              accessToken: data['accessToken'],
              refreshToken: data['refreshToken'],
              user: user.toJson(),
              profile: profile.toJson(),
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

      // Complete registration with the chosen name and username
      final finalDisplayName = chosenName?.trim().isNotEmpty == true
          ? chosenName!.trim()
          : details.displayName?.trim();

      final res = await _apiClient.dio.post(
        ApiEndpoints.googleAuth,
        data: {
          if (details.idToken != null) 'idToken': details.idToken,
          'email': details.email.trim().toLowerCase(),
          if (finalDisplayName != null && finalDisplayName.isNotEmpty) 'name': finalDisplayName,
          if (details.photoUrl != null && details.photoUrl!.isNotEmpty) 'avatarUrl': details.photoUrl,
          if (details.googleId != null && details.googleId!.isNotEmpty) 'googleId': details.googleId,
          if (chosenUsername != null) 'username': chosenUsername.trim().toLowerCase(),
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final data = res.data['data'];
        final user = UserModel.fromJson(data['user']);
        final profile = ProfileModel.fromJson(data['profile']);

        await _apiClient.saveUserSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: user.toJson(),
          profile: profile.toJson(),
        );

        state = state.copyWith(
          status: AuthStatus.authenticated,
          user: user,
          profile: profile,
        );
        return GoogleAuthResult(success: true, isNewUser: false);
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

        await _apiClient.saveUserSession(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          user: user.toJson(),
          profile: profile.toJson(),
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
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      await googleSignIn.signOut();
      await googleSignIn.disconnect();
    } catch (_) {}
    await _apiClient.clearUserSession();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

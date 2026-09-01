import 'package:flutter/foundation.dart';

class ApiEndpoints {
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:4000/api/v1';
    }
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:4000/api/v1'
        : 'http://localhost:4000/api/v1';
  }

  // Auth
  static const String sendOtp = '/auth/otp/send';
  static const String verifyOtp = '/auth/otp/verify';
  static const String verifySecondary = '/auth/verify-secondary';
  static const String googleSignIn = '/auth/google';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';

  // Profile
  static const String profileMe = '/profile/me';
  static const String updateProfile = '/profile/me';
  static const String initiateFfUid = '/profile/ff-uid/initiate';
  static const String submitFfProof = '/profile/ff-uid/submit-proof';

  // Admin
  static const String adminFfVerifications = '/admin/verifications/ff-uid';
}

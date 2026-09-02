import 'package:flutter/foundation.dart';

class ApiEndpoints {
  // Set to true to connect app to your live Render backend
  static const bool useCloudServer = true;
  static const String cloudBaseUrl = 'https://fla-esports-api.onrender.com/api/v1';

  static String get baseUrl {
    if (useCloudServer || kReleaseMode) {
      return cloudBaseUrl;
    }
    if (kIsWeb) {
      return 'http://localhost:4000/api/v1';
    }
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:4000/api/v1'
        : 'http://localhost:4000/api/v1';
  }

  // Auth
  static const String signin = '/auth/signin';
  static const String register = '/auth/register';
  static const String verifyOtp = '/auth/verify-otp';
  static const String resendOtp = '/auth/resend-otp';
  static const String googleSignIn = '/auth/google';
  static const String googleAuth = '/auth/google';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String sendOtp = '/auth/otp/send';
  static const String verifySecondary = '/auth/verify-secondary';

  // Profile
  static const String profileMe = '/profile/me';
  static const String updateProfile = '/profile/me';
  static const String initiateFfUid = '/profile/ff-uid/initiate';
  static const String submitFfProof = '/profile/ff-uid/submit-proof';

  // Admin
  static const String adminFfVerifications = '/admin/verifications/ff-uid';
}

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../api_client.dart';
import '../../features/match_room/screens/match_room_screen.dart';
import '../../features/wallet/screens/wallet_screen.dart';

/// Background message handler — must be top-level (not inside a class)
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundMessageHandler(RemoteMessage message) async {
  // Background messages are shown automatically by FCM on Android.
  // No action needed here unless you need custom processing.
  debugPrint('[FCM Background] ${message.notification?.title}: ${message.notification?.body}');
}

class FcmNotificationService {
  static final ApiClient _apiClient = ApiClient();
  static bool _initialized = false;

  /// Call once after user logs in.
  /// Requests permission, gets FCM token, registers with backend,
  /// and wires up foreground + tap listeners.
  static Future<void> initializeFCM(BuildContext? context) async {
    if (_initialized) return;

    try {
      final messaging = FirebaseMessaging.instance;

      // 1. Request notification permissions
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      debugPrint('[FCM] Permission: ${settings.authorizationStatus}');
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[FCM] User denied notification permissions.');
        return;
      }

      // 2. For iOS — get APNs token first
      if (Platform.isIOS) {
        await messaging.getAPNSToken();
      }

      // 3. Get FCM token and register with backend
      final token = await messaging.getToken();
      if (token != null) {
        await registerPushToken(token);
        debugPrint('[FCM] Token registered: ${token.substring(0, 20)}...');
      }

      // 4. Listen for token refresh and re-register
      messaging.onTokenRefresh.listen((newToken) async {
        await registerPushToken(newToken);
        debugPrint('[FCM] Token refreshed and re-registered.');
      });

      // 5. Background handler
      FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundMessageHandler);

      // 6. Foreground notification display (Android — show heads-up by default)
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 7. Handle notification tap when app is in foreground
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[FCM Foreground] ${message.notification?.title}');
        // In-app banner is shown automatically on iOS.
        // For Android foreground, show a SnackBar or local notification if needed.
      });

      // 8. Handle notification tap when app was in background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[FCM Opened] ${message.data}');
        if (context != null && context.mounted) {
          handleNotificationClick(
            context,
            message.data['type'] ?? '',
            message.data,
          );
        }
      });

      // 9. Handle notification tap when app was terminated
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null && context != null && context.mounted) {
        handleNotificationClick(
          context,
          initialMessage.data['type'] ?? '',
          initialMessage.data,
        );
      }

      _initialized = true;
      debugPrint('[FCM] Notification service fully initialized.');
    } catch (e) {
      debugPrint('[FCM] Initialization error (non-fatal): $e');
    }
  }

  /// Registers current device push token with backend API
  static Future<void> registerPushToken(String fcmToken) async {
    try {
      final platform = Platform.isIOS ? 'ios' : Platform.isAndroid ? 'android' : 'web';
      await _apiClient.dio.post(
        '/notifications/device-token',
        data: {
          'token': fcmToken,
          'platform': platform,
          'deviceInfo': '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
        },
      );
    } catch (_) {}
  }

  /// De-registers push token on user logout
  static Future<void> unregisterPushToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _apiClient.dio.delete(
          '/notifications/device-token',
          data: {'token': token},
        );
      }
      _initialized = false; // Allow re-init after next login
    } catch (_) {
      _initialized = false;
    }
  }

  /// Routes notification click deep-links to the correct screen
  static void handleNotificationClick(BuildContext context, String type, Map<String, dynamic>? data) {
    if (data == null) return;

    switch (type) {
      case 'ROOM_REVEALED':
      case 'MATCH_REMINDER':
      case 'TOURNAMENT_ALERT':
        final tournamentId = data['tournamentId'] as String?;
        if (tournamentId != null) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => MatchRoomScreen(tournamentId: tournamentId)),
          );
        }
        break;
      case 'PRIZE_CREDITED':
      case 'WITHDRAWAL_COMPLETED':
      case 'WITHDRAWAL_REJECTED':
      case 'BOOKING_REFUNDED':
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const WalletScreen()),
        );
        break;
      default:
        break;
    }
  }
}

import 'dart:io';
import 'package:flutter/material.dart';
import '../api_client.dart';
import '../../features/match_room/screens/match_room_screen.dart';
import '../../features/wallet/screens/wallet_screen.dart';

class FcmNotificationService {
  static final ApiClient _apiClient = ApiClient();

  /**
   * Registers current device push token with backend API
   */
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

  /**
   * De-registers push token on user logout
   */
  static Future<void> unregisterPushToken(String fcmToken) async {
    try {
      await _apiClient.dio.delete(
        '/notifications/device-token',
        data: { 'token': fcmToken },
      );
    } catch (_) {}
  }

  /**
   * Routes notification click deep-links
   */
  static void handleNotificationClick(BuildContext context, String type, Map<String, dynamic>? data) {
    if (data == null) return;

    switch (type) {
      case 'ROOM_REVEALED':
      case 'MATCH_REMINDER':
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

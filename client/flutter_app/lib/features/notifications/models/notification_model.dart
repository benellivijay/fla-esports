import 'dart:convert';

class InAppNotificationModel {
  final String id;
  final String userId;
  final String title;
  final String body;
  final String type; // 'ROOM_REVEALED', 'MATCH_REMINDER', 'BOOKING_CONFIRMED', 'PRIZE_CREDITED', 'WITHDRAWAL_COMPLETED', 'RESULT_APPROVED', 'RESULT_REJECTED', 'SYSTEM'
  final Map<String, dynamic>? data;
  final bool isRead;
  final DateTime createdAt;

  InAppNotificationModel({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.type,
    this.data,
    required this.isRead,
    required this.createdAt,
  });

  factory InAppNotificationModel.fromJson(Map<String, dynamic> json) {
    // data may come as a JSON string (from SQLite) or already decoded Map
    Map<String, dynamic>? parsedData;
    final raw = json['data'];
    if (raw is Map<String, dynamic>) {
      parsedData = raw;
    } else if (raw is String && raw.isNotEmpty) {
      try { parsedData = jsonDecode(raw) as Map<String, dynamic>?; } catch (_) {}
    }

    return InAppNotificationModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String? ?? 'SYSTEM',
      data: parsedData,
      isRead: json['is_read'] == true || json['is_read'] == 1,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}


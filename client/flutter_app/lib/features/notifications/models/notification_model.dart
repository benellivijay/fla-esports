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
    return InAppNotificationModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String? ?? 'SYSTEM',
      data: json['data'] is Map<String, dynamic> ? json['data'] as Map<String, dynamic> : null,
      isRead: json['is_read'] == true || json['is_read'] == 1,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

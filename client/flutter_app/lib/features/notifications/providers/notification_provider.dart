import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/notification_model.dart';

class NotificationState {
  final bool isLoading;
  final int unreadCount;
  final List<InAppNotificationModel> notifications;
  final List<InAppNotificationModel> announcements;
  final Set<String> dismissedAnnouncementIds;
  final String? errorMessage;

  const NotificationState({
    this.isLoading = false,
    this.unreadCount = 0,
    this.notifications = const [],
    this.announcements = const [],
    this.dismissedAnnouncementIds = const {},
    this.errorMessage,
  });

  NotificationState copyWith({
    bool? isLoading,
    int? unreadCount,
    List<InAppNotificationModel>? notifications,
    List<InAppNotificationModel>? announcements,
    Set<String>? dismissedAnnouncementIds,
    String? errorMessage,
  }) {
    return NotificationState(
      isLoading: isLoading ?? this.isLoading,
      unreadCount: unreadCount ?? this.unreadCount,
      notifications: notifications ?? this.notifications,
      announcements: announcements ?? this.announcements,
      dismissedAnnouncementIds: dismissedAnnouncementIds ?? this.dismissedAnnouncementIds,
      errorMessage: errorMessage,
    );
  }
}

final notificationProvider = StateNotifierProvider<NotificationNotifier, NotificationState>((ref) {
  return NotificationNotifier();
});

class NotificationNotifier extends StateNotifier<NotificationState> {
  final ApiClient _apiClient = ApiClient();

  NotificationNotifier() : super(const NotificationState()) {
    fetchUnreadCount();
    fetchAnnouncements();
  }

  Future<void> fetchUnreadCount() async {
    try {
      final res = await _apiClient.dio.get('/notifications/unread-count');
      if (res.statusCode == 200 && res.data['data'] != null) {
        final count = (res.data['data']['unreadCount'] as num?)?.toInt() ?? 0;
        state = state.copyWith(unreadCount: count);
      }
    } catch (_) {}
  }

  Future<void> fetchAnnouncements() async {
    try {
      final res = await _apiClient.dio.get('/notifications/announcements');
      if (res.statusCode == 200 && res.data['data'] != null) {
        final List list = res.data['data']['announcements'] ?? [];
        final parsed = list.map((item) => InAppNotificationModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(announcements: parsed);
      }
    } catch (_) {}
  }

  void dismissAnnouncement(String announcementId) {
    final updatedSet = Set<String>.from(state.dismissedAnnouncementIds)..add(announcementId);
    state = state.copyWith(dismissedAnnouncementIds: updatedSet);
  }

  Future<void> fetchInbox() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/notifications/inbox');
      if (res.statusCode == 200 && res.data['data'] != null) {
        final List list = res.data['data']['notifications'] ?? [];
        final parsed = list.map((item) => InAppNotificationModel.fromJson(item as Map<String, dynamic>)).toList();
        final unread = (res.data['data']['unreadCount'] as num?)?.toInt() ?? 0;
        state = state.copyWith(
          isLoading: false,
          notifications: parsed,
          unreadCount: unread,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to load notifications.');
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await _apiClient.dio.patch('/notifications/$notificationId/read');
      final updatedList = state.notifications.map((n) {
        if (n.id == notificationId) {
          return InAppNotificationModel(
            id: n.id,
            userId: n.userId,
            title: n.title,
            body: n.body,
            type: n.type,
            data: n.data,
            isRead: true,
            createdAt: n.createdAt,
          );
        }
        return n;
      }).toList();

      final newUnread = (state.unreadCount - 1).clamp(0, 9999);
      state = state.copyWith(notifications: updatedList, unreadCount: newUnread);
    } catch (_) {}
  }

  Future<void> markAllAsRead() async {
    try {
      await _apiClient.dio.patch('/notifications/mark-all-read');
      final updatedList = state.notifications.map((n) {
        return InAppNotificationModel(
          id: n.id,
          userId: n.userId,
          title: n.title,
          body: n.body,
          type: n.type,
          data: n.data,
          isRead: true,
          createdAt: n.createdAt,
        );
      }).toList();

      state = state.copyWith(notifications: updatedList, unreadCount: 0);
    } catch (_) {}
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/notification_provider.dart';
import '../models/notification_model.dart';
import '../../../core/services/fcm_notification_service.dart';

class NotificationInboxScreen extends ConsumerStatefulWidget {
  const NotificationInboxScreen({super.key});

  @override
  ConsumerState<NotificationInboxScreen> createState() => _NotificationInboxScreenState();
}

class _NotificationInboxScreenState extends ConsumerState<NotificationInboxScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(notificationProvider.notifier).fetchInbox();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (state.notifications.any((n) => !n.isRead))
            TextButton(
              onPressed: () => ref.read(notificationProvider.notifier).markAllAsRead(),
              child: const Text('Mark all as read', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : state.notifications.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none_rounded, size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text('No notifications yet', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                      SizedBox(height: 4),
                      Text('Match alerts and prize updates will appear here.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => ref.read(notificationProvider.notifier).fetchInbox(),
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: state.notifications.length,
                    itemBuilder: (context, index) {
                      return _buildNotificationTile(state.notifications[index]);
                    },
                  ),
                ),
    );
  }

  Widget _buildNotificationTile(InAppNotificationModel item) {
    final dateStr = DateFormat('d MMM • h:mm a').format(item.createdAt);

    IconData icon = Icons.notifications_none_rounded;
    Color iconColor = AppColors.textSecondary;

    switch (item.type) {
      case 'TOURNAMENT_CREATED':
        icon = Icons.emoji_events_outlined;
        iconColor = AppColors.primary;
        break;
      case 'ROOM_REVEALED':
        icon = Icons.lock_open_outlined;
        iconColor = AppColors.success;
        break;
      case 'MATCH_REMINDER':
        icon = Icons.timer_outlined;
        iconColor = AppColors.warning;
        break;
      case 'BOOKING_CONFIRMED':
        icon = Icons.sports_esports_outlined;
        iconColor = AppColors.textPrimary;
        break;
      case 'BOOKING_REFUNDED':
        icon = Icons.replay_rounded;
        iconColor = AppColors.textSecondary;
        break;
      case 'PRIZE_CREDITED':
        icon = Icons.emoji_events_outlined;
        iconColor = AppColors.primary;
        break;
      case 'RESULT_APPROVED':
        icon = Icons.check_circle_outline;
        iconColor = AppColors.success;
        break;
      case 'RESULT_REJECTED':
      case 'WITHDRAWAL_REJECTED':
        icon = Icons.cancel_outlined;
        iconColor = AppColors.danger;
        break;
      case 'BROADCAST':
        icon = Icons.campaign_rounded;
        iconColor = AppColors.highlight;
        break;
      case 'ADMIN_MESSAGE':
        icon = Icons.support_agent_rounded;
        iconColor = AppColors.primary;
        break;
      case 'TOURNAMENT_ALERT':
        icon = Icons.notification_important_rounded;
        iconColor = AppColors.warning;
        break;
      case 'WITHDRAWAL_COMPLETED':
        icon = Icons.account_balance_outlined;
        iconColor = AppColors.success;
        break;
      default:
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: AppTheme.cardDecoration(),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (!item.isRead) {
              ref.read(notificationProvider.notifier).markAsRead(item.id);
            }
            FcmNotificationService.handleNotificationClick(context, item.type, item.data);
          },
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.border, width: 0.5),
                  ),
                  child: Icon(icon, color: iconColor, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          if (!item.isRead)
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.body,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.3),
                      ),
                      const SizedBox(height: 4),
                      Text(dateStr, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

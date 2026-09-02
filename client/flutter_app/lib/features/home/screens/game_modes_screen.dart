import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/tournament_provider.dart';
import '../../wallet/providers/wallet_provider.dart';
import '../../wallet/screens/wallet_screen.dart';
import '../../notifications/providers/notification_provider.dart';
import '../../notifications/screens/notification_inbox_screen.dart';
import 'mode_tournaments_screen.dart';

class GameModeItem {
  final String key;
  final String label;
  final IconData icon;
  final Color iconBgColor;
  final Color iconColor;
  final String? badgeText;
  final bool isLiveBadge;

  const GameModeItem({
    required this.key,
    required this.label,
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    this.badgeText,
    this.isLiveBadge = false,
  });
}

class GameModesScreen extends ConsumerStatefulWidget {
  const GameModesScreen({super.key});

  @override
  ConsumerState<GameModesScreen> createState() => _GameModesScreenState();
}

class _GameModesScreenState extends ConsumerState<GameModesScreen> {
  // 8 Game modes in exact specified order
  static const List<GameModeItem> _modes = [
    GameModeItem(
      key: 'ff_max',
      label: 'FF Max',
      icon: Icons.local_fire_department_rounded,
      iconBgColor: Color(0xFFFEF2F2),
      iconColor: Color(0xFFEF4444),
      isLiveBadge: true,
    ),
    GameModeItem(
      key: 'survival',
      label: 'Survival',
      icon: Icons.favorite_rounded,
      iconBgColor: Color(0xFFEFF6FF),
      iconColor: Color(0xFF3B82F6),
    ),
    GameModeItem(
      key: 'free_match',
      label: 'Free match',
      icon: Icons.confirmation_number_rounded,
      iconBgColor: Color(0xFFF0FDF4),
      iconColor: Color(0xFF16A34A),
      badgeText: 'No entry fee',
    ),
    GameModeItem(
      key: 'lone_wolf',
      label: 'Lone wolf',
      icon: Icons.dark_mode_rounded,
      iconBgColor: Color(0xFFF5F3FF),
      iconColor: Color(0xFF8B5CF6),
    ),
    GameModeItem(
      key: 'headshot_only',
      label: 'Headshot only',
      icon: Icons.gps_fixed_rounded,
      iconBgColor: Color(0xFFFFFBEB),
      iconColor: Color(0xFFD97706),
    ),
    GameModeItem(
      key: 'one_tap',
      label: 'One tap',
      icon: Icons.bolt_rounded,
      iconBgColor: Color(0xFFFFF7ED),
      iconColor: Color(0xFFEA580C),
    ),
    GameModeItem(
      key: 'sniper_1v1',
      label: 'Sniper 1v1',
      icon: Icons.center_focus_strong_rounded,
      iconBgColor: Color(0xFFECFEFF),
      iconColor: Color(0xFF0891B2),
    ),
    GameModeItem(
      key: 'lone_wolf_headshot',
      label: 'Lone wolf headshot',
      icon: Icons.sports_kabaddi_rounded,
      iconBgColor: Color(0xFFFAF5FF),
      iconColor: Color(0xFF9333EA),
    ),
  ];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(tournamentListProvider.notifier).fetchGameModeStats();
      ref.read(walletProvider.notifier).fetchSummary();
      ref.read(notificationProvider.notifier).fetchUnreadCount();
    });
  }

  void _onSelectMode(GameModeItem mode) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ModeTournamentsScreen(
          gameModeKey: mode.key,
          gameModeLabel: mode.label,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final listState = ref.watch(tournamentListProvider);
    final walletState = ref.watch(walletProvider);
    final notificationState = ref.watch(notificationProvider);
    final balance = walletState.summary?.balance ?? 0.0;
    final unreadCount = notificationState.unreadCount;
    final stats = listState.gameModeStats;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border, width: 0.5),
              ),
              padding: const EdgeInsets.all(4),
              child: Image.asset(
                'assets/images/app_logo.png',
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.sports_esports,
                  size: 16,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'FLA ESPORTS',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 16,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          // Notification Bell
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, color: AppColors.textSecondary, size: 22),
                tooltip: 'Notifications',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationInboxScreen()),
                  );
                },
              ),
              if (unreadCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      unreadCount > 9 ? '9+' : '$unreadCount',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),

          // Wallet Balance Chip
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const WalletScreen()),
              );
            },
            borderRadius: BorderRadius.circular(999),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border, width: 0.5),
              ),
              child: Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined, color: AppColors.textPrimary, size: 15),
                  const SizedBox(width: 6),
                  Text(
                    '?${balance.toStringAsFixed(0)}',
                    style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(tournamentListProvider.notifier).fetchGameModeStats();
          await ref.read(walletProvider.notifier).fetchSummary();
        },
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Section Header Label
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Game modes',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.2,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Select a custom battle format to explore matches',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 3-Column Grid of 1:1 Mode Tiles
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _modes.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 1.0,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                ),
                itemBuilder: (context, index) {
                  final mode = _modes[index];
                  final modeStats = stats[mode.key];
                  final liveCount = modeStats?['liveCount'] ?? 0;

                  String? badgeText;
                  Color badgeBgColor = AppColors.successBg;
                  Color badgeTextColor = AppColors.success;
                  Color badgeBorderColor = AppColors.successBorder;

                  if (mode.isLiveBadge && liveCount > 0) {
                    badgeText = '$liveCount live';
                  } else if (mode.badgeText != null) {
                    badgeText = mode.badgeText;
                  }

                  return _buildModeTile(
                    mode: mode,
                    badgeText: badgeText,
                    badgeBgColor: badgeBgColor,
                    badgeTextColor: badgeTextColor,
                    badgeBorderColor: badgeBorderColor,
                    onTap: () => _onSelectMode(mode),
                  );
                },
              ),

              const SizedBox(height: 24),

              // Bottom Banner Info
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 0.5),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.shield_outlined, size: 20, color: AppColors.textSecondary),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Official Rules & Anti-Cheat',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'All modes feature instant slot booking and automated kill reward distribution.',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModeTile({
    required GameModeItem mode,
    required String? badgeText,
    required Color badgeBgColor,
    required Color badgeTextColor,
    required Color badgeBorderColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 0.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
        child: Stack(
          children: [
            // Centered Icon & Label
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: mode.iconBgColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      mode.icon,
                      size: 20,
                      color: mode.iconColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    mode.label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),

            // Top-Right Pill Badge (e.g. "N live", "No entry fee")
            if (badgeText != null)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: badgeBgColor,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: badgeBorderColor, width: 0.5),
                  ),
                  child: Text(
                    badgeText,
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                      color: badgeTextColor,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

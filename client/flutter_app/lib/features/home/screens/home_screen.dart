import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/tournament_provider.dart';
import '../widgets/tournament_card.dart';
import '../../auth/providers/auth_provider.dart';
import '../../admin/screens/admin_create_tournament_screen.dart';
import '../../wallet/providers/wallet_provider.dart';
import '../../wallet/screens/wallet_screen.dart';
import 'game_modes_screen.dart';
import '../../notifications/providers/notification_provider.dart';
import '../../notifications/screens/notification_inbox_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(tournamentListProvider.notifier).fetchTournaments();
      ref.read(walletProvider.notifier).fetchSummary();
      ref.read(notificationProvider.notifier).fetchUnreadCount();
    });
  }

  @override
  Widget build(BuildContext context) {
    final listState = ref.watch(tournamentListProvider);
    final authState = ref.watch(authProvider);
    final walletState = ref.watch(walletProvider);
    final notificationState = ref.watch(notificationProvider);
    final notifier = ref.read(tournamentListProvider.notifier);
    final isAdmin = authState.user?.role == 'admin' || authState.user?.role == 'moderator';
    final balance = walletState.summary?.balance ?? 0.0;
    final unreadCount = notificationState.unreadCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'FLA ESPORTS',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          // Notification Bell with Pill Unread Badge
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, color: AppColors.textSecondary),
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

          // Wallet Balance Pill with Hairline Border
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
                  const Icon(Icons.account_balance_wallet_outlined, color: AppColors.highlight, size: 15),
                  const SizedBox(width: 6),
                  Text(
                    '₹${balance.toStringAsFixed(0)}',
                    style: const TextStyle(color: AppColors.highlight, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary, size: 20),
            onPressed: () {
              notifier.fetchTournaments();
              ref.read(walletProvider.notifier).fetchSummary();
              ref.read(notificationProvider.notifier).fetchUnreadCount();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips Section with 0.5px hairline bottom border
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
            ),
            child: Column(
              children: [
                // Entry Type Filters + Game Modes Entry Point
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      // Game Modes Grid Entry Point
                      InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const GameModesScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceMuted,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border, width: 0.5),
                          ),
                          child: Row(
                            children: const [
                              Icon(Icons.grid_view_rounded, size: 14, color: AppColors.primary),
                              SizedBox(width: 6),
                              Text(
                                'Game modes',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildFilterChip('All matches', 'all', listState.filters.entryType, (val) => notifier.setFilters(entryType: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Free matches', 'free', listState.filters.entryType, (val) => notifier.setFilters(entryType: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Paid matches', 'paid', listState.filters.entryType, (val) => notifier.setFilters(entryType: val)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Map and Mode secondary filters
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All maps', 'all', listState.filters.map, (val) => notifier.setFilters(map: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Bermuda', 'bermuda', listState.filters.map, (val) => notifier.setFilters(map: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Purgatory', 'purgatory', listState.filters.map, (val) => notifier.setFilters(map: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Kalahari', 'kalahari', listState.filters.map, (val) => notifier.setFilters(map: val)),
                      const SizedBox(width: 14),
                      Container(width: 1, height: 16, color: AppColors.border),
                      const SizedBox(width: 14),
                      _buildFilterChip('All modes', 'all', listState.filters.mode, (val) => notifier.setFilters(mode: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Solo', 'solo', listState.filters.mode, (val) => notifier.setFilters(mode: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Duo', 'duo', listState.filters.mode, (val) => notifier.setFilters(mode: val)),
                      const SizedBox(width: 8),
                      _buildFilterChip('Squad', 'squad', listState.filters.mode, (val) => notifier.setFilters(mode: val)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Tournament List or Empty State
          Expanded(
            child: listState.isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                : listState.tournaments.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: AppColors.border, width: 0.5),
                              ),
                              child: const Icon(Icons.sports_esports_outlined, size: 36, color: AppColors.textMuted),
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'No tournaments found',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Try changing your filters or check back soon',
                              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        onRefresh: () async {
                          await notifier.fetchTournaments();
                          await ref.read(walletProvider.notifier).fetchSummary();
                        },
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: listState.tournaments.length,
                          itemBuilder: (context, index) {
                            final tournament = listState.tournaments[index];
                            return TournamentCard(tournament: tournament);
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: isAdmin
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AdminCreateTournamentScreen()),
                );
              },
              backgroundColor: AppColors.primary,
              elevation: 0,
              focusElevation: 0,
              hoverElevation: 0,
              highlightElevation: 0,
              shape: const StadiumBorder(),
              icon: const Icon(Icons.add_rounded, color: Color(0xFF0B0E17), size: 18),
              label: const Text('New tournament', style: TextStyle(color: Color(0xFF0B0E17), fontWeight: FontWeight.w700, fontSize: 13)),
            )
          : null,
    );
  }

  Widget _buildFilterChip(String label, String value, String selectedValue, Function(String) onSelect) {
    final isSelected = selectedValue == value;
    return InkWell(
      onTap: () => onSelect(value),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(999), // Pill shape
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: 0.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFF0B0E17) : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/tournament_provider.dart';
import '../widgets/tournament_card.dart';
import '../../wallet/providers/wallet_provider.dart';
import '../../wallet/screens/wallet_screen.dart';

class ModeTournamentsScreen extends ConsumerStatefulWidget {
  final String gameModeKey;
  final String gameModeLabel;
  final String? imageAsset;

  const ModeTournamentsScreen({
    super.key,
    required this.gameModeKey,
    required this.gameModeLabel,
    this.imageAsset,
  });

  @override
  ConsumerState<ModeTournamentsScreen> createState() => _ModeTournamentsScreenState();
}

class _ModeTournamentsScreenState extends ConsumerState<ModeTournamentsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(tournamentListProvider.notifier).setFilters(
        gameMode: widget.gameModeKey,
        entryType: 'all',
        mode: 'all',
        map: 'all',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final listState = ref.watch(tournamentListProvider);
    final walletState = ref.watch(walletProvider);
    final notifier = ref.read(tournamentListProvider.notifier);
    final balance = walletState.summary?.balance ?? 0.0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          widget.gameModeLabel,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        actions: [
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
      body: Column(
        children: [
          // Mode Filter Indicator Banner with Graphic
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
            ),
            child: Row(
              children: [
                if (widget.imageAsset != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      widget.imageAsset!,
                      width: 28,
                      height: 28,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.sports_esports, size: 20, color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.tune_rounded, size: 12, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        'Mode: ${widget.gameModeLabel}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  '${listState.tournaments.length} match${listState.tournaments.length == 1 ? '' : 'es'} found',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          // Tournament List
          Expanded(
            child: listState.isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                : listState.tournaments.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.sports_esports_outlined, size: 44, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            Text(
                              'No ${widget.gameModeLabel} tournaments available right now.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Check back shortly for new lobbies.',
                              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton.icon(
                              onPressed: () => notifier.fetchTournaments(),
                              icon: const Icon(Icons.refresh_rounded, size: 16),
                              label: const Text('Refresh'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.border, width: 1),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => notifier.fetchTournaments(),
                        color: AppColors.primary,
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
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../models/tournament_model.dart';
import '../../tournament_detail/screens/tournament_detail_screen.dart';

class TournamentCard extends StatelessWidget {
  final TournamentModel tournament;

  const TournamentCard({
    super.key,
    required this.tournament,
  });

  @override
  Widget build(BuildContext context) {
    final double fillPercentage = tournament.maxSlots > 0 
        ? (tournament.filledSlots / tournament.maxSlots).clamp(0.0, 1.0) 
        : 0.0;

    final String formattedDate = DateFormat('EEE, d MMM • h:mm a').format(tournament.startTime);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: AppTheme.cardDecoration(),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => TournamentDetailScreen(tournamentId: tournament.id),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Title and Mode/Map pill tags
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: const Icon(
                        Icons.sports_esports_outlined,
                        color: AppColors.textPrimary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tournament.title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              _buildPillTag(
                                _formatGameMode(tournament.gameMode),
                                AppColors.primary,
                                AppColors.surfaceMuted,
                              ),
                              const SizedBox(width: 6),
                              _buildPillTag(
                                _toSentenceCase(tournament.mode),
                                AppColors.textSecondary,
                                AppColors.surfaceMuted,
                              ),
                              const SizedBox(width: 6),
                              _buildPillTag(
                                _toSentenceCase(tournament.map),
                                AppColors.textSecondary,
                                AppColors.surfaceMuted,
                              ),
                              const SizedBox(width: 6),
                              _buildPillTag(
                                tournament.isPaid ? 'Paid' : 'Free',
                                tournament.isPaid ? AppColors.textPrimary : AppColors.success,
                                tournament.isPaid ? AppColors.surfaceMuted : AppColors.successBg,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Middle row: Prize pool, per kill, start time
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border, width: 0.5),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Prize pool', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(
                            tournament.isPaid ? '₹${tournament.prizePool.toStringAsFixed(0)}' : '${tournament.prizePool.toStringAsFixed(0)} Coins',
                            style: const TextStyle(
                              color: AppColors.highlight,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      if (tournament.perKillPrize > 0)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Per kill', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                            const SizedBox(height: 2),
                            Text(
                              '₹${tournament.perKillPrize.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Start time', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text(
                            formattedDate,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Bottom row: Slots gauge and Pill Join Button
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${tournament.filledSlots} of ${tournament.maxSlots} slots filled',
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                              ),
                              Text(
                                '${(fillPercentage * 100).toInt()}%',
                                style: TextStyle(
                                  color: tournament.isFull ? AppColors.danger : AppColors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: fillPercentage,
                              minHeight: 5,
                              backgroundColor: AppColors.surfaceMuted,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                tournament.isFull ? AppColors.danger : AppColors.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    ElevatedButton(
                      onPressed: tournament.isFull
                          ? null
                          : () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => TournamentDetailScreen(tournamentId: tournament.id),
                                ),
                              );
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        disabledBackgroundColor: AppColors.surfaceMuted,
                        disabledForegroundColor: AppColors.textMuted,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        minimumSize: const Size(0, 36),
                      ),
                      child: Text(
                        tournament.isFull 
                            ? 'Full' 
                            : tournament.isPaid 
                                ? 'Join ₹${tournament.entryFee.toStringAsFixed(0)}' 
                                : 'Join free',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPillTag(String text, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999), // Pill shape
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  String _toSentenceCase(String input) {
    if (input.isEmpty) return '';
    return input[0].toUpperCase() + input.substring(1).toLowerCase();
  }

  String _formatGameMode(String mode) {
    switch (mode) {
      case 'ff_max':
        return 'FF Max';
      case 'survival':
        return 'Survival';
      case 'free_match':
        return 'Free Match';
      case 'lone_wolf':
        return 'Lone Wolf';
      case 'headshot_only':
        return 'Headshot Only';
      case 'one_tap':
        return 'One Tap';
      case 'sniper_1v1':
        return 'Sniper 1v1';
      case 'lone_wolf_headshot':
        return 'Lone Wolf HS';
      default:
        return _toSentenceCase(mode.replaceAll('_', ' '));
    }
  }
}

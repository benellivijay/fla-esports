import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/slot_booking_provider.dart';
import '../models/slot_model.dart';
import '../../match_room/screens/match_room_screen.dart';

class MyMatchesScreen extends ConsumerStatefulWidget {
  const MyMatchesScreen({super.key});

  @override
  ConsumerState<MyMatchesScreen> createState() => _MyMatchesScreenState();
}

class _MyMatchesScreenState extends ConsumerState<MyMatchesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(slotBookingProvider.notifier).fetchMyMatches();
    });
  }

  void _handleCancel(String tournamentId, String title) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
        ),
        title: const Text('Cancel match booking?', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: Text(
          'Are you sure you want to leave $title? Any entry fee paid will be instantly refunded to your wallet.',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep slot', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await ref.read(slotBookingProvider.notifier).cancelBooking(tournamentId);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Booking cancelled and funds refunded to wallet.')),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: const Text('Cancel and refund'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slotBookingProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My joined matches'),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : state.myMatches.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.sports_esports_outlined, size: 48, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      const Text('You have not joined any tournaments yet.', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                      const SizedBox(height: 4),
                      const Text('Browse upcoming tournaments and book your slot.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => ref.read(slotBookingProvider.notifier).fetchMyMatches(),
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: state.myMatches.length,
                    itemBuilder: (context, index) {
                      return _buildMatchCard(state.myMatches[index]);
                    },
                  ),
                ),
    );
  }

  Widget _buildMatchCard(UserBookingMatchModel match) {
    final formattedDate = DateFormat('EEE, d MMM • h:mm a').format(match.startTime);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildPillTag(
                'Your slot #${match.slotNumber}',
                AppColors.success,
                AppColors.successBg,
              ),
              _buildPillTag(
                match.entryType == 'paid' ? 'Paid entry' : 'Free entry',
                AppColors.textSecondary,
                AppColors.surfaceMuted,
              ),
            ],
          ),
          const SizedBox(height: 10),

          Text(
            match.title,
            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            '${_toSentenceCase(match.mode)} • ${_toSentenceCase(match.map)} • Start: $formattedDate',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 14),

          // Action Buttons: Enter Room & Cancel
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => MatchRoomScreen(tournamentId: match.tournamentId),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: match.roomRevealed ? AppColors.primary : AppColors.surfaceMuted,
                    foregroundColor: match.roomRevealed ? Colors.white : AppColors.textPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  icon: Icon(
                    match.roomRevealed ? Icons.lock_open_outlined : Icons.lock_clock_outlined,
                    size: 16,
                  ),
                  label: Text(
                    match.roomRevealed ? 'Enter room (live)' : 'View room details',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => _handleCancel(match.tournamentId, match.title),
                icon: const Icon(Icons.close_rounded, color: AppColors.danger, size: 18),
                tooltip: 'Leave match and refund',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.dangerBg,
                  padding: const EdgeInsets.all(8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPillTag(String text, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
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
}

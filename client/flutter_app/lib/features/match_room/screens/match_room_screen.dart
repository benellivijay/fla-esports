import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/match_room_provider.dart';
import '../../results/screens/submit_result_screen.dart';

class MatchRoomScreen extends ConsumerWidget {
  final String tournamentId;

  const MatchRoomScreen({
    super.key,
    required this.tournamentId,
  });

  String _formatDuration(int totalSeconds) {
    final hours = (totalSeconds ~/ 3600).toString().padLeft(2, '0');
    final minutes = ((totalSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return totalSeconds >= 3600 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(matchRoomProvider(tournamentId));
    final room = state.room;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Match room'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.read(matchRoomProvider(tournamentId).notifier).fetchRoomDetails(),
          ),
        ],
      ),
      body: state.isLoading && room == null
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : room == null
              ? Center(
                  child: Text(
                    state.errorMessage ?? 'Unable to load room details.',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Countdown Header Banner (12px rounded, 0.5px border)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: AppTheme.cardDecoration(),
                        child: Column(
                          children: [
                            Text(
                              room.title,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_toSentenceCase(room.mode)} • ${_toSentenceCase(room.map)} • Status: ${_toSentenceCase(room.status)}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                            const SizedBox(height: 12),

                            // Ticker
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  room.isRevealed ? Icons.timer_outlined : Icons.lock_clock_outlined,
                                  color: room.isRevealed ? AppColors.success : AppColors.warning,
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  room.isRevealed
                                      ? 'Match starts in: ${_formatDuration(state.currentCountdownSeconds)}'
                                      : 'Room unlocks in: ${_formatDuration(state.currentCountdownSeconds)}',
                                  style: TextStyle(
                                    color: room.isRevealed ? AppColors.success : AppColors.warning,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Assigned Slot Card
                      if (room.slotNumber != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: AppTheme.cardDecoration(),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Your assigned match slot', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.successBg,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: AppColors.successBorder, width: 0.5),
                                ),
                                child: Text(
                                  'Slot #${room.slotNumber}',
                                  style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w600, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Credentials Display (Revealed vs Locked)
                      if (room.isRevealed) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: AppTheme.cardDecoration(),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.lock_open_outlined, color: AppColors.success, size: 20),
                                  SizedBox(width: 8),
                                  Text(
                                    'Room credentials unlocked',
                                    style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),

                              _buildCredentialRow(
                                context,
                                'Room ID',
                                room.roomId ?? 'Pending admin',
                                Icons.tag_rounded,
                              ),
                              const SizedBox(height: 10),
                              _buildCredentialRow(
                                context,
                                'Password',
                                room.roomPassword ?? 'No password',
                                Icons.password_rounded,
                              ),
                              const SizedBox(height: 14),

                              ElevatedButton.icon(
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: 'Room: ${room.roomId} Password: ${room.roomPassword}'));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Room ID and password copied to clipboard.'),
                                    ),
                                  );
                                },
                                icon: const Icon(Icons.copy_rounded, size: 16),
                                label: const Text('Copy credentials'),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: AppTheme.cardDecoration(),
                          child: const Column(
                            children: [
                              Icon(Icons.lock_outline_rounded, color: AppColors.warning, size: 36),
                              SizedBox(height: 10),
                              Text(
                                'Room credentials locked',
                                style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w600),
                              ),
                              SizedBox(height: 6),
                              Text(
                                'Room ID and password will be unlocked automatically before start. A notification will also be sent to your device.',
                                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),

                      // Game Record Video Reminder
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1F1206),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4), width: 1),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.videocam_rounded, color: Color(0xFFEF4444), size: 16),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Note: Full match recording is mandatory. Save directly to our Google Drive folder.',
                                style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontWeight: FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Submit Match Result CTA (Pill Button)
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SubmitResultScreen(
                                tournamentId: room.tournamentId,
                                tournamentTitle: room.title,
                              ),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        icon: const Icon(Icons.upload_file_outlined, size: 18),
                        label: const Text('Submit match result'),
                      ),
                      const SizedBox(height: 16),

                      // Step-by-step instructions
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: AppTheme.cardDecoration(),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'How to join Free Fire custom match:',
                              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            SizedBox(height: 8),
                            Text(
                              '1. Open Free Fire on your mobile device.\n'
                              '2. Tap "Modes" > "Custom" > "Join Room".\n'
                              '3. Enter the Room ID and Password displayed above.\n'
                              '4. Strictly sit in your assigned slot number.\n'
                              '5. Take a screenshot of the end game results table and submit it here.',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildCredentialRow(BuildContext context, String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 18),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
              Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
            ],
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.copy_rounded, color: AppColors.textPrimary, size: 18),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('$label copied: $value')),
              );
            },
          ),
        ],
      ),
    );
  }

  String _toSentenceCase(String input) {
    if (input.isEmpty) return '';
    return input[0].toUpperCase() + input.substring(1).toLowerCase();
  }
}

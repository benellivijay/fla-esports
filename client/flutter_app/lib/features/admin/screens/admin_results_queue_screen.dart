import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../results/providers/result_provider.dart';
import '../../results/models/result_model.dart';

class AdminResultsQueueScreen extends ConsumerStatefulWidget {
  const AdminResultsQueueScreen({super.key});

  @override
  ConsumerState<AdminResultsQueueScreen> createState() => _AdminResultsQueueScreenState();
}

class _AdminResultsQueueScreenState extends ConsumerState<AdminResultsQueueScreen> {
  static const String driveFolderUrl =
      'https://drive.google.com/drive/folders/11B5k-tOHXku9fN9qVXJJb7NPyZc0Gver?usp=sharing';

  Future<void> _openDriveFolder() async {
    final uri = Uri.parse(driveFolderUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        Clipboard.setData(const ClipboardData(text: driveFolderUrl));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Drive link copied to clipboard!')),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(resultProvider.notifier).fetchAdminQueue(status: 'pending_review');
    });
  }

  void _showApproveDialog(AdminResultQueueItemModel item) {
    final TextEditingController rankController = TextEditingController(text: item.claimedRank.toString());
    final TextEditingController killsController = TextEditingController(text: item.claimedKills.toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border, width: 0.5)),
        title: const Text('Approve match result', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Player: ${item.playerDisplayName} (UID: ${item.playerFfUid})', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 14),
            TextField(
              controller: rankController,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Confirmed placement rank',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: killsController,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Confirmed kills',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary))),
          ElevatedButton(
            onPressed: () async {
              final rank = int.tryParse(rankController.text.trim()) ?? item.claimedRank;
              final kills = int.tryParse(killsController.text.trim()) ?? item.claimedKills;
              Navigator.pop(ctx);

              final success = await ref.read(resultProvider.notifier).reviewResult(
                    resultId: item.id,
                    decision: 'approved',
                    confirmedRank: rank,
                    confirmedKills: kills,
                  );

              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Result approved and statistics updated.')),
                );
              }
            },
            child: const Text('Confirm and approve'),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(AdminResultQueueItemModel item) {
    final TextEditingController reasonController = TextEditingController(text: 'Scoreboard is not clearly visible.');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border, width: 0.5)),
        title: const Text('Reject result claim', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: TextField(
          controller: reasonController,
          maxLines: 2,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
          decoration: const InputDecoration(
            labelText: 'Reason for rejection',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary))),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonController.text.trim();
              Navigator.pop(ctx);

              final success = await ref.read(resultProvider.notifier).reviewResult(
                    resultId: item.id,
                    decision: 'rejected',
                    rejectionReason: reason,
                  );

              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Result claim rejected.')),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Reject claim'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resultProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Results review queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.folder_shared_rounded, color: Color(0xFFF59E0B)),
            tooltip: 'Open Recordings Drive Folder',
            onPressed: _openDriveFolder,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.read(resultProvider.notifier).fetchAdminQueue(status: 'pending_review'),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : state.adminQueue.isEmpty
              ? const Center(
                  child: Text('No pending result claims in queue.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.adminQueue.length,
                  itemBuilder: (context, index) {
                    return _buildQueueCard(state.adminQueue[index]);
                  },
                ),
    );
  }

  Widget _buildQueueCard(AdminResultQueueItemModel item) {
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
              Text(
                item.tournamentTitle,
                style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
              ),
              _buildPillTag('Slot #${item.slotNumber}'),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Player: ${item.playerDisplayName} • UID: ${item.playerFfUid} • IGN: ${item.playerFfIgn}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border, width: 0.5),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    const Text('Claimed rank', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text('#${item.claimedRank}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                  ],
                ),
                Column(
                  children: [
                    const Text('Claimed kills', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text('${item.claimedKills}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                  ],
                ),
                Column(
                  children: [
                    const Text('Proof URL', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text(item.screenshotUrl.split('/').last, style: const TextStyle(color: AppColors.primary, fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showRejectDialog(item),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger, width: 0.5),
                  ),
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _showApproveDialog(item),
                  child: const Text('Approve and credit'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPillTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

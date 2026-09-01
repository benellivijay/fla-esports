import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../wallet/providers/withdrawal_provider.dart';
import '../../wallet/models/withdrawal_model.dart';

class AdminWithdrawalsScreen extends ConsumerStatefulWidget {
  const AdminWithdrawalsScreen({super.key});

  @override
  ConsumerState<AdminWithdrawalsScreen> createState() => _AdminWithdrawalsScreenState();
}

class _AdminWithdrawalsScreenState extends ConsumerState<AdminWithdrawalsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(withdrawalProvider.notifier).fetchAdminQueue(status: 'pending');
    });
  }

  void _showCompleteDialog(AdminWithdrawalQueueItemModel item) {
    final TextEditingController utrController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border, width: 0.5)),
        title: const Text('Complete payout', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Player: ${item.displayName} (${item.phone})', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 6),
            Text(
              'Net payable: ₹${item.netPayableAmount.toStringAsFixed(2)}',
              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              item.payoutMethod == 'upi' ? 'UPI: ${item.upiId}' : 'Bank: ${item.bankAccountNumber} (${item.bankIfsc})',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: utrController,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Bank UTR or reference ID',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary))),
          ElevatedButton(
            onPressed: () async {
              final utr = utrController.text.trim();
              Navigator.pop(ctx);

              final success = await ref.read(withdrawalProvider.notifier).processWithdrawal(
                    requestId: item.id,
                    decision: 'completed',
                    payoutReferenceId: utr.isNotEmpty ? utr : null,
                  );

              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Withdrawal marked completed.')),
                );
              }
            },
            child: const Text('Mark paid'),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(AdminWithdrawalQueueItemModel item) {
    final TextEditingController reasonController = TextEditingController(text: 'Invalid UPI ID or bank details.');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border, width: 0.5)),
        title: const Text('Reject and refund withdrawal', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Gross amount of ₹${item.amount.toStringAsFixed(2)} will be immediately refunded to player\'s wallet ledger.',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 2,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Rejection reason',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary))),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonController.text.trim();
              Navigator.pop(ctx);

              final success = await ref.read(withdrawalProvider.notifier).processWithdrawal(
                    requestId: item.id,
                    decision: 'rejected',
                    rejectionReason: reason,
                  );

              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Withdrawal rejected and refunded.')),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Reject and refund'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(withdrawalProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Withdrawal approvals queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.read(withdrawalProvider.notifier).fetchAdminQueue(status: 'pending'),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : state.adminQueue.isEmpty
              ? const Center(
                  child: Text('No pending withdrawal requests.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
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

  Widget _buildQueueCard(AdminWithdrawalQueueItemModel item) {
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
                'Net payout: ₹${item.netPayableAmount.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 15),
              ),
              Text(
                'Gross: ₹${item.amount.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Player: ${item.displayName ?? 'User'} • Phone: ${item.phone ?? 'N/A'} • UID: ${item.ffUid ?? 'N/A'}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border, width: 0.5),
            ),
            child: Text(
              item.payoutMethod == 'upi'
                  ? 'UPI ID: ${item.upiId}'
                  : 'Bank: ${item.bankAccountNumber} | IFSC: ${item.bankIfsc} | Name: ${item.bankAccountHolderName}',
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
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
                  child: const Text('Reject and refund'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _showCompleteDialog(item),
                  child: const Text('Mark paid'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

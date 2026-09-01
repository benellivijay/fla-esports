import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/withdrawal_provider.dart';
import '../models/withdrawal_model.dart';

class WithdrawalHistoryScreen extends ConsumerStatefulWidget {
  const WithdrawalHistoryScreen({super.key});

  @override
  ConsumerState<WithdrawalHistoryScreen> createState() => _WithdrawalHistoryScreenState();
}

class _WithdrawalHistoryScreenState extends ConsumerState<WithdrawalHistoryScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(withdrawalProvider.notifier).fetchMyWithdrawals();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(withdrawalProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Withdrawal history'),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : state.myWithdrawals.isEmpty
              ? const Center(
                  child: Text('No withdrawal requests found.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                )
              : RefreshIndicator(
                  onRefresh: () => ref.read(withdrawalProvider.notifier).fetchMyWithdrawals(),
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: state.myWithdrawals.length,
                    itemBuilder: (context, index) {
                      return _buildWithdrawalCard(state.myWithdrawals[index]);
                    },
                  ),
                ),
    );
  }

  Widget _buildWithdrawalCard(WithdrawalRequestModel req) {
    final dateStr = DateFormat('d MMM yyyy • h:mm a').format(req.createdAt);

    Color statusColor = AppColors.warning;
    Color statusBg = AppColors.warningBg;
    String statusText = 'Pending approval';

    if (req.status == 'completed') {
      statusColor = AppColors.success;
      statusBg = AppColors.successBg;
      statusText = 'Paid (completed)';
    } else if (req.status == 'rejected') {
      statusColor = AppColors.danger;
      statusBg = AppColors.dangerBg;
      statusText = 'Rejected and refunded';
    } else if (req.status == 'processing') {
      statusColor = AppColors.primary;
      statusBg = AppColors.surfaceMuted;
      statusText = 'Processing';
    }

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
                'Net payout: ₹${req.netPayableAmount.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 15),
              ),
              _buildPillTag(statusText, statusColor, statusBg),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Gross: ₹${req.amount.toStringAsFixed(2)} • 30% TDS: -₹${req.tdsDeducted.toStringAsFixed(2)}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 8),

          Text(
            req.payoutMethod == 'upi'
                ? 'UPI ID: ${req.upiId}'
                : 'Bank: ${req.bankAccountNumber} (${req.bankIfsc})',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),

          if (req.payoutReferenceId != null) ...[
            const SizedBox(height: 4),
            Text(
              'UTR reference: ${req.payoutReferenceId}',
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ],

          if (req.rejectionReason != null) ...[
            const SizedBox(height: 4),
            Text(
              'Reason: ${req.rejectionReason}',
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ],

          const SizedBox(height: 8),
          Text(dateStr, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
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
}

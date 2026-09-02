import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/withdrawal_provider.dart';
import '../providers/wallet_provider.dart';
import 'withdrawal_history_screen.dart';

class WithdrawalScreen extends ConsumerStatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  ConsumerState<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends ConsumerState<WithdrawalScreen> {
  final TextEditingController _amountController = TextEditingController(text: '100');
  String _payoutMethod = 'upi'; // 'upi' | 'bank_transfer'
  final TextEditingController _upiController = TextEditingController();
  final TextEditingController _accountNumberController = TextEditingController();
  final TextEditingController _ifscController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();

  double _requestedAmount = 100.0;

  @override
  void initState() {
    super.initState();
    _amountController.addListener(() {
      final val = double.tryParse(_amountController.text.trim()) ?? 0.0;
      setState(() {
        _requestedAmount = val;
      });
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _upiController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _handleSubmit() async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    final walletSummary = ref.read(walletProvider).summary;
    final withdrawableBalance = walletSummary?.withdrawableBalance ?? 0.0;

    if (amount < 100) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Minimum withdrawal limit is ₹100.00.')),
      );
      return;
    }

    if (amount > withdrawableBalance) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Insufficient withdrawable winnings balance (₹${withdrawableBalance.toStringAsFixed(2)}). Deposited funds cannot be withdrawn and must be used to join matches.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    if (_payoutMethod == 'upi' && (_upiController.text.trim().isEmpty || !_upiController.text.contains('@'))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid UPI ID (e.g. mobile@upi).')),
      );
      return;
    }

    if (_payoutMethod == 'bank_transfer') {
      if (_accountNumberController.text.trim().isEmpty ||
          _ifscController.text.trim().isEmpty ||
          _nameController.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill all bank account details.')),
        );
        return;
      }
    }

    final success = await ref.read(withdrawalProvider.notifier).requestWithdrawal(
          amount: amount,
          payoutMethod: _payoutMethod,
          upiId: _payoutMethod == 'upi' ? _upiController.text.trim() : null,
          bankAccountNumber: _payoutMethod == 'bank_transfer' ? _accountNumberController.text.trim() : null,
          bankIfsc: _payoutMethod == 'bank_transfer' ? _ifscController.text.trim() : null,
          bankAccountHolderName: _payoutMethod == 'bank_transfer' ? _nameController.text.trim() : null,
        );

    if (success && mounted) {
      ref.read(walletProvider.notifier).fetchWalletSummary();
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const WithdrawalHistoryScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(walletProvider);
    final withdrawalState = ref.watch(withdrawalProvider);
    final currentBalance = walletState.summary?.balance ?? 0.0;
    final withdrawableBalance = walletState.summary?.withdrawableBalance ?? 0.0;
    final depositBalance = walletState.summary?.depositBalance ?? 0.0;

    final tdsDeducted = _requestedAmount * 0.30;
    final netPayable = (_requestedAmount - tdsDeducted).clamp(0.0, double.infinity);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Withdraw funds'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history_rounded, size: 20),
            tooltip: 'Withdrawal history',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const WithdrawalHistoryScreen()),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Available Winnings Balance Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Available to withdraw', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                          SizedBox(height: 2),
                          Text('Won prize balance', style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      Text(
                        '₹${withdrawableBalance.toStringAsFixed(2)}',
                        style: const TextStyle(color: AppColors.success, fontSize: 22, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const Divider(height: 20, thickness: 0.5, color: AppColors.border),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Total balance: ₹${currentBalance.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      Text('Deposit cash: ₹${depositBalance.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Rule Notice
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border, width: 0.5),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Only won match prizes can be withdrawn (Min ₹100). Deposited money can only be used for match entry.',
                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Amount Input Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Enter withdrawal amount', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w700),
                    decoration: const InputDecoration(
                      prefixText: '₹ ',
                      prefixStyle: TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w700),
                      hintText: '100',
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Quick pill chips
                  Row(
                    children: [100, 200, 500, 1000].map((amt) {
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => _amountController.text = amt.toString(),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.border, width: 0.5),
                            ),
                            child: Text(
                              '₹$amt',
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Live 30% TDS Breakdown Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('TDS and net payout calculation', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 10),
                  _buildSummaryRow('Gross requested amount', '₹${_requestedAmount.toStringAsFixed(2)}', AppColors.textSecondary),
                  const SizedBox(height: 6),
                  _buildSummaryRow('30% TDS deduction (Income tax)', '- ₹${tdsDeducted.toStringAsFixed(2)}', AppColors.warning),
                  const Divider(height: 16),
                  _buildSummaryRow('Net credited to bank or UPI', '₹${netPayable.toStringAsFixed(2)}', AppColors.textPrimary, isBold: true),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Payout Method Selector
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select payout method', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _payoutMethod = 'upi'),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _payoutMethod == 'upi' ? AppColors.primary : AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: _payoutMethod == 'upi' ? AppColors.primary : AppColors.border, width: 0.5),
                            ),
                            child: Center(
                              child: Text(
                                'Instant UPI',
                                style: TextStyle(
                                  color: _payoutMethod == 'upi' ? Colors.white : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _payoutMethod = 'bank_transfer'),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _payoutMethod == 'bank_transfer' ? AppColors.primary : AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: _payoutMethod == 'bank_transfer' ? AppColors.primary : AppColors.border, width: 0.5),
                            ),
                            child: Center(
                              child: Text(
                                'Bank transfer',
                                style: TextStyle(
                                  color: _payoutMethod == 'bank_transfer' ? Colors.white : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  if (_payoutMethod == 'upi') ...[
                    TextField(
                      controller: _upiController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'UPI ID or VPA (e.g. mobile@upi)',
                      ),
                    ),
                  ] else ...[
                    TextField(
                      controller: _accountNumberController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'Bank account number',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _ifscController,
                      textCapitalization: TextCapitalization.characters,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'IFSC code (e.g. HDFC0001234)',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _nameController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'Account holder name',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Submit Pill CTA
            ElevatedButton(
              onPressed: withdrawalState.isSubmitting ? null : _handleSubmit,
              child: withdrawalState.isSubmitting
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                  : const Text('Confirm and withdraw'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, Color valueColor, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontWeight: isBold ? FontWeight.w600 : FontWeight.w500,
            fontSize: isBold ? 14 : 12,
          ),
        ),
      ],
    );
  }
}

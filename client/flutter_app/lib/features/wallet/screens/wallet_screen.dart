import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/wallet_provider.dart';
import '../models/wallet_model.dart';
import 'withdrawal_screen.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  final TextEditingController _amountController = TextEditingController(text: '100');
  String _selectedFilter = 'all';

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(walletProvider.notifier).fetchWalletSummary();
      ref.read(walletProvider.notifier).fetchTransactions();
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _showDepositModal() {
    final utrController = TextEditingController();
    final ImagePicker picker = ImagePicker();
    XFile? pickedScreenshot;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        side: BorderSide(color: AppColors.border, width: 0.5),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (modalCtx, setModalState) {
          final amount = double.tryParse(_amountController.text.trim()) ?? 100.0;
          final cleanAmt = (amount > 0 ? amount : 10.0).toStringAsFixed(2);
          const upiId = '9342235510@ybl';
          final upiUri = 'upi://pay?pa=$upiId&pn=FLA%20ESPORTS&am=$cleanAmt&cu=INR&tn=FLA%20ESPORTS%20Deposit';

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(modalCtx).size.height * 0.9,
            ),
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Modal Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.qr_code_scanner_rounded, color: AppColors.primary, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Deposit via UPI QR',
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                        onPressed: () => Navigator.pop(modalCtx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Scan with PhonePe, GPay, Paytm or BHIM — exact amount is auto-filled!',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 14),

                  // Amount Selector Input
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border, width: 0.5),
                    ),
                    child: Row(
                      children: [
                        const Text(
                          '₹',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _amountController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w700),
                            decoration: const InputDecoration(
                              hintText: 'Enter amount',
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            onChanged: (_) => setModalState(() {}),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Quick Presets
                  Wrap(
                    spacing: 6,
                    children: [50, 100, 200, 500, 1000].map((amt) {
                      final isSelected = _amountController.text.trim() == amt.toString();
                      return InkWell(
                        onTap: () {
                          _amountController.text = amt.toString();
                          setModalState(() {});
                        },
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primary : AppColors.surfaceMuted,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: 0.5),
                          ),
                          child: Text(
                            '+ ₹$amt',
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),

                  // Dynamic Auto-Generated UPI QR Code Container
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border, width: 0.5),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0x1F5F259F),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.bolt_rounded, size: 13, color: Color(0xFF5F259F)),
                              SizedBox(width: 4),
                              Text(
                                'Scan with PhonePe / GPay / Paytm / BHIM',
                                style: TextStyle(
                                  color: Color(0xFF5F259F),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Rendered Dynamic UPI QR Code (Auto updates with amount)
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border, width: 0.5),
                          ),
                          child: QrImageView(
                            data: upiUri,
                            version: QrVersions.auto,
                            size: 175.0,
                            backgroundColor: Colors.white,
                            eyeStyle: const QrEyeStyle(
                              eyeShape: QrEyeShape.square,
                              color: Color(0xFF0F172A),
                            ),
                            dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'Scan to pay exact ',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                            Text(
                              '₹${amount > 0 ? amount.toStringAsFixed(0) : "0"}',
                              style: const TextStyle(color: AppColors.primary, fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // UTR / Transaction ID Input
                  TextField(
                    controller: utrController,
                    keyboardType: TextInputType.text,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                    decoration: const InputDecoration(
                      labelText: '12-Digit UPI UTR / Ref Number *',
                      hintText: 'e.g. 423849102938 or Ref ID',
                      prefixIcon: Icon(Icons.receipt_long_outlined, size: 18),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Payment Screenshot Attachment
                  InkWell(
                    onTap: () async {
                      try {
                        final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                        if (picked != null) {
                          setModalState(() {
                            pickedScreenshot = picked;
                          });
                        }
                      } catch (_) {}
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: pickedScreenshot != null ? AppColors.successBg : AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: pickedScreenshot != null ? AppColors.successBorder : AppColors.border,
                          width: 0.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            pickedScreenshot != null ? Icons.check_circle_outline : Icons.add_photo_alternate_outlined,
                            size: 18,
                            color: pickedScreenshot != null ? AppColors.success : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              pickedScreenshot != null
                                  ? 'Screenshot attached (${pickedScreenshot!.name.length > 20 ? "${pickedScreenshot!.name.substring(0, 18)}..." : pickedScreenshot!.name})'
                                  : 'Attach payment screenshot * (Mandatory)',
                              style: TextStyle(
                                color: pickedScreenshot != null ? AppColors.success : AppColors.primary,
                                fontSize: 12,
                                fontWeight: pickedScreenshot != null ? FontWeight.w600 : FontWeight.w500,
                              ),
                            ),
                          ),
                          if (pickedScreenshot != null)
                            IconButton(
                              icon: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                setModalState(() {
                                  pickedScreenshot = null;
                                });
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Submit Deposit Button
                  ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final depAmount = double.tryParse(_amountController.text.trim()) ?? 0.0;
                            final utr = utrController.text.trim();

                            if (depAmount < 10) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Minimum deposit amount is ₹10.00.')),
                              );
                              return;
                            }
                            if (utr.isEmpty || utr.length < 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Please enter a valid 12-digit UPI UTR number.')),
                              );
                              return;
                            }
                            if (pickedScreenshot == null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Payment screenshot proof is mandatory. Please attach your payment screenshot.')),
                              );
                              return;
                            }

                            setModalState(() => isSubmitting = true);

                            List<int>? bytes;
                            if (pickedScreenshot != null) {
                              bytes = await pickedScreenshot!.readAsBytes();
                            }

                            final success = await ref.read(walletProvider.notifier).submitUpiQrDeposit(
                                  amount: depAmount,
                                  utrNumber: utr,
                                  qrUsed: 'upi_9342235510@ybl',
                                  screenshotBytes: bytes,
                                  screenshotName: pickedScreenshot?.name,
                                );

                            setModalState(() => isSubmitting = false);

                            if (success && mounted) {
                              if (modalCtx.mounted) {
                                Navigator.pop(modalCtx);
                              }
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Deposit request for ₹${depAmount.toStringAsFixed(0)} submitted! It will be verified and credited shortly.'),
                                  backgroundColor: AppColors.primary,
                                  duration: const Duration(seconds: 4),
                                ),
                              );
                            } else if (mounted) {
                              final error = ref.read(walletProvider).errorMessage ?? 'Deposit failed. Please check UTR number.';
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(error),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text('Submit and add ₹${amount > 0 ? amount.toStringAsFixed(0) : "0"} to wallet'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(walletProvider);
    final summary = state.summary;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Wallet and passbook'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () {
              ref.read(walletProvider.notifier).fetchWalletSummary();
              ref.read(walletProvider.notifier).fetchTransactions(type: _selectedFilter == 'all' ? null : _selectedFilter);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(walletProvider.notifier).fetchWalletSummary();
          await ref.read(walletProvider.notifier).fetchTransactions(type: _selectedFilter == 'all' ? null : _selectedFilter);
        },
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Balance Card (12px rounded, 0.5px border, pure white)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total wallet balance', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
                        Icon(Icons.account_balance_wallet_outlined, color: AppColors.textSecondary, size: 20),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '₹${summary?.balance.toStringAsFixed(2) ?? '0.00'}',
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 32, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 14),

                    // Cash Type Breakdown (Deposited vs Won)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.lock_outline_rounded, size: 12, color: AppColors.textMuted),
                                    SizedBox(width: 4),
                                    Text('Deposit cash', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '₹${summary?.depositBalance.toStringAsFixed(2) ?? '0.00'}',
                                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700),
                                ),
                                const Text('For match entry', style: TextStyle(color: AppColors.textSecondary, fontSize: 9)),
                              ],
                            ),
                          ),
                          Container(width: 0.5, height: 32, color: AppColors.border),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.emoji_events_outlined, size: 12, color: AppColors.success),
                                    SizedBox(width: 4),
                                    Text('Winnings cash', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '₹${summary?.withdrawableBalance.toStringAsFixed(2) ?? '0.00'}',
                                  style: const TextStyle(color: AppColors.success, fontSize: 14, fontWeight: FontWeight.w700),
                                ),
                                const Text('Withdrawable (Min ₹100)', style: TextStyle(color: AppColors.textSecondary, fontSize: 9)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Quick Actions: Deposit and Withdraw Pill Buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _showDepositModal,
                            icon: const Icon(Icons.add_rounded, size: 16),
                            label: const Text('Add money'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const WithdrawalScreen()),
                              );
                            },
                            icon: const Icon(Icons.arrow_upward_rounded, size: 16),
                            label: const Text('Withdraw'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Ledger Statement Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All activity', 'all'),
                    _buildFilterChip('Deposits', 'deposit'),
                    _buildFilterChip('Prizes', 'prize_credit'),
                    _buildFilterChip('Entry fees', 'entry_fee_debit'),
                    _buildFilterChip('Withdrawals', 'withdrawal'),
                    _buildFilterChip('Refunds', 'refund'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Statement List
              const Text('Passbook history', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),

              if (state.isLoading)
                const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
              else if (state.transactions.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  decoration: AppTheme.cardDecoration(),
                  child: const Text('No transactions recorded yet.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: state.transactions.length,
                  itemBuilder: (context, index) {
                    return _buildTransactionTile(state.transactions[index]);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () {
          setState(() => _selectedFilter = value);
          ref.read(walletProvider.notifier).fetchTransactions(type: value == 'all' ? null : value);
        },
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: 0.5),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : AppColors.textSecondary,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionTile(LedgerTransactionModel item) {
    final isPositive = ['deposit', 'prize_credit', 'refund'].contains(item.type);
    final color = isPositive ? AppColors.success : AppColors.danger;
    final prefix = isPositive ? '+' : '-';
    final formattedDate = DateFormat('d MMM • h:mm a').format(item.createdAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: AppTheme.cardDecoration(),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isPositive ? AppColors.successBg : AppColors.dangerBg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: isPositive ? AppColors.successBorder : AppColors.dangerBorder, width: 0.5),
            ),
            child: Icon(
              item.type == 'deposit'
                  ? Icons.account_balance_wallet_outlined
                  : item.type == 'prize_credit'
                      ? Icons.emoji_events_outlined
                      : item.type == 'withdrawal'
                          ? Icons.arrow_upward_outlined
                          : Icons.replay_rounded,
              color: color,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.description ?? _toSentenceCase(item.type.replaceAll('_', ' ')),
                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(formattedDate, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Text(
            '$prefix ₹${item.amount.toStringAsFixed(2)}',
            style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 14),
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

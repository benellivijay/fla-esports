class WalletSummaryModel {
  final double balance;
  final double withdrawableBalance;
  final double depositBalance;
  final double totalDeposited;
  final double totalWinnings;
  final double totalSpent;
  final double totalRefunds;
  final String currency;

  WalletSummaryModel({
    required this.balance,
    required this.withdrawableBalance,
    required this.depositBalance,
    required this.totalDeposited,
    required this.totalWinnings,
    required this.totalSpent,
    required this.totalRefunds,
    required this.currency,
  });

  factory WalletSummaryModel.fromJson(Map<String, dynamic> json) {
    final balance = (json['balance'] as num?)?.toDouble() ?? 0.0;
    final totalWinnings = (json['totalWinnings'] as num?)?.toDouble() ?? 0.0;
    final withdrawable = (json['withdrawableBalance'] as num?)?.toDouble() ?? totalWinnings.clamp(0.0, balance);
    final deposit = (json['depositBalance'] as num?)?.toDouble() ?? (balance - withdrawable).clamp(0.0, balance);

    return WalletSummaryModel(
      balance: balance,
      withdrawableBalance: withdrawable,
      depositBalance: deposit,
      totalDeposited: (json['totalDeposited'] as num?)?.toDouble() ?? 0.0,
      totalWinnings: totalWinnings,
      totalSpent: (json['totalSpent'] as num?)?.toDouble() ?? 0.0,
      totalRefunds: (json['totalRefunds'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'INR',
    );
  }
}

class LedgerTransactionModel {
  final String id;
  final String type; // 'deposit' | 'entry_fee_debit' | 'prize_credit' | 'refund' | 'withdrawal'
  final double amount;
  final String? referenceId;
  final String? description;
  final DateTime createdAt;

  LedgerTransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    this.referenceId,
    this.description,
    required this.createdAt,
  });

  factory LedgerTransactionModel.fromJson(Map<String, dynamic> json) {
    return LedgerTransactionModel(
      id: json['id'] as String,
      type: json['type'] as String,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      referenceId: json['reference_id'] as String?,
      description: json['description'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  bool get isCredit => type == 'deposit' || type == 'prize_credit' || type == 'refund';
}

class DepositOrderModel {
  final String orderId;
  final double amount;
  final String currency;
  final String gateway;
  final String paymentSessionId;
  final String keyId;

  DepositOrderModel({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.gateway,
    required this.paymentSessionId,
    required this.keyId,
  });

  factory DepositOrderModel.fromJson(Map<String, dynamic> json) {
    return DepositOrderModel(
      orderId: json['orderId'] as String,
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'INR',
      gateway: json['gateway'] as String? ?? 'mock_gateway',
      paymentSessionId: json['paymentSessionId'] as String? ?? '',
      keyId: json['keyId'] as String? ?? '',
    );
  }
}

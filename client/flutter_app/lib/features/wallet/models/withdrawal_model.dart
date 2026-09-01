class WithdrawalRequestModel {
  final String id;
  final String userId;
  final double amount;
  final String payoutMethod; // 'upi' | 'bank_transfer'
  final String? upiId;
  final String? bankAccountNumber;
  final String? bankIfsc;
  final String? bankAccountHolderName;
  final double tdsDeducted;
  final double netPayableAmount;
  final String status; // 'pending' | 'processing' | 'completed' | 'rejected'
  final String? payoutReferenceId;
  final String? rejectionReason;
  final DateTime createdAt;

  WithdrawalRequestModel({
    required this.id,
    required this.userId,
    required this.amount,
    required this.payoutMethod,
    this.upiId,
    this.bankAccountNumber,
    this.bankIfsc,
    this.bankAccountHolderName,
    required this.tdsDeducted,
    required this.netPayableAmount,
    required this.status,
    this.payoutReferenceId,
    this.rejectionReason,
    required this.createdAt,
  });

  factory WithdrawalRequestModel.fromJson(Map<String, dynamic> json) {
    return WithdrawalRequestModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      amount: (json['amount'] as num).toDouble(),
      payoutMethod: json['payout_method'] as String? ?? 'upi',
      upiId: json['upi_id'] as String?,
      bankAccountNumber: json['bank_account_number'] as String?,
      bankIfsc: json['bank_ifsc'] as String?,
      bankAccountHolderName: json['bank_account_holder_name'] as String?,
      tdsDeducted: (json['tds_deducted'] as num?)?.toDouble() ?? 0.0,
      netPayableAmount: (json['net_payable_amount'] as num?)?.toDouble() ?? (json['amount'] as num).toDouble(),
      status: json['status'] as String? ?? 'pending',
      payoutReferenceId: json['payout_reference_id'] as String?,
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

class AdminWithdrawalQueueItemModel extends WithdrawalRequestModel {
  final String? phone;
  final String? email;
  final String? displayName;
  final String? ffUid;
  final String? ffIgn;

  AdminWithdrawalQueueItemModel({
    required super.id,
    required super.userId,
    required super.amount,
    required super.payoutMethod,
    super.upiId,
    super.bankAccountNumber,
    super.bankIfsc,
    super.bankAccountHolderName,
    required super.tdsDeducted,
    required super.netPayableAmount,
    required super.status,
    super.payoutReferenceId,
    super.rejectionReason,
    required super.createdAt,
    this.phone,
    this.email,
    this.displayName,
    this.ffUid,
    this.ffIgn,
  });

  factory AdminWithdrawalQueueItemModel.fromJson(Map<String, dynamic> json) {
    return AdminWithdrawalQueueItemModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      amount: (json['amount'] as num).toDouble(),
      payoutMethod: json['payout_method'] as String? ?? 'upi',
      upiId: json['upi_id'] as String?,
      bankAccountNumber: json['bank_account_number'] as String?,
      bankIfsc: json['bank_ifsc'] as String?,
      bankAccountHolderName: json['bank_account_holder_name'] as String?,
      tdsDeducted: (json['tds_deducted'] as num?)?.toDouble() ?? 0.0,
      netPayableAmount: (json['net_payable_amount'] as num?)?.toDouble() ?? (json['amount'] as num).toDouble(),
      status: json['status'] as String? ?? 'pending',
      payoutReferenceId: json['payout_reference_id'] as String?,
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      displayName: json['display_name'] as String?,
      ffUid: json['ff_uid'] as String?,
      ffIgn: json['ff_ign'] as String?,
    );
  }
}

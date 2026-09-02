class KycModel {
  final bool isPhoneVerified;
  final bool isEmailVerified;
  final String? phone;
  final String? email;
  final String status; // 'verified' | 'unverified'

  KycModel({
    required this.isPhoneVerified,
    required this.isEmailVerified,
    this.phone,
    this.email,
    required this.status,
  });

  factory KycModel.fromJson(Map<String, dynamic> json) {
    final isPhone = json['isPhoneVerified'] == true || json['isPhoneVerified'] == 1;
    final isEmail = json['isEmailVerified'] == true || json['isEmailVerified'] == 1;
    final kycStatus = (json['kycStatus'] as String?) ?? (isEmail ? 'verified' : 'unverified');

    return KycModel(
      isPhoneVerified: isPhone,
      isEmailVerified: isEmail,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      status: kycStatus,
    );
  }

  bool get isKycVerified => isEmailVerified || status == 'verified';
}

class UserModel {
  final String id;
  final String? username;
  final String? phone;
  final String? email;
  final String? googleId;
  final String role;
  final String status;
  final bool isPhoneVerified;
  final bool isEmailVerified;
  final bool kycVerified;

  UserModel({
    required this.id,
    this.username,
    this.phone,
    this.email,
    this.googleId,
    required this.role,
    required this.status,
    required this.isPhoneVerified,
    required this.isEmailVerified,
    this.kycVerified = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      googleId: json['google_id'] as String?,
      role: json['role'] as String? ?? 'user',
      status: json['status'] as String? ?? 'active',
      isPhoneVerified: json['is_phone_verified'] == 1 || json['is_phone_verified'] == true,
      isEmailVerified: json['is_email_verified'] == 1 || json['is_email_verified'] == true || json['email_verified'] == 1 || json['email_verified'] == true,
      kycVerified: json['kyc_verified'] == 1 || json['kyc_verified'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'phone': phone,
      'email': email,
      'google_id': googleId,
      'role': role,
      'status': status,
      'is_phone_verified': isPhoneVerified ? 1 : 0,
      'is_email_verified': isEmailVerified ? 1 : 0,
      'kyc_verified': kycVerified ? 1 : 0,
    };
  }
}

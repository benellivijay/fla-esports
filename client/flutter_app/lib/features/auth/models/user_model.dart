class UserModel {
  final String id;
  final String? phone;
  final String? email;
  final String role;
  final String status;
  final bool isPhoneVerified;
  final bool isEmailVerified;

  UserModel({
    required this.id,
    this.phone,
    this.email,
    required this.role,
    required this.status,
    required this.isPhoneVerified,
    required this.isEmailVerified,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      role: json['role'] as String? ?? 'user',
      status: json['status'] as String? ?? 'active',
      isPhoneVerified: json['is_phone_verified'] == 1 || json['is_phone_verified'] == true,
      isEmailVerified: json['is_email_verified'] == 1 || json['is_email_verified'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'email': email,
      'role': role,
      'status': status,
      'is_phone_verified': isPhoneVerified ? 1 : 0,
      'is_email_verified': isEmailVerified ? 1 : 0,
    };
  }
}

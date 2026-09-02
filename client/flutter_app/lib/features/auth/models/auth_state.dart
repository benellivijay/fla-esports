import 'user_model.dart';
import '../../profile/models/profile_model.dart';

enum AuthStatus { initial, unauthenticated, authenticating, otpSent, authenticated, error }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final ProfileModel? profile;
  final String? pendingIdentifier;
  final String? identifierType;
  final String? lastGeneratedOtp;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.profile,
    this.pendingIdentifier,
    this.identifierType,
    this.lastGeneratedOtp,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    ProfileModel? profile,
    String? pendingIdentifier,
    String? identifierType,
    String? lastGeneratedOtp,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      profile: profile ?? this.profile,
      pendingIdentifier: pendingIdentifier ?? this.pendingIdentifier,
      identifierType: identifierType ?? this.identifierType,
      lastGeneratedOtp: lastGeneratedOtp ?? this.lastGeneratedOtp,
      errorMessage: errorMessage,
    );
  }
}

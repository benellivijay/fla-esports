class ProfileModel {
  final String id;
  final String userId;
  final String displayName;
  final String? avatarUrl;
  final String? ffUid;
  final String? ffIgn;
  final String ffVerificationStatus; // unverified, challenge_issued, pending_review, verified, rejected
  final String? ffTempChallenge;
  final String? ffProofImageUrl;
  final int matchesPlayed;
  final int wins;
  final int totalKills;
  final double totalEarnings;

  ProfileModel({
    required this.id,
    required this.userId,
    required this.displayName,
    this.avatarUrl,
    this.ffUid,
    this.ffIgn,
    required this.ffVerificationStatus,
    this.ffTempChallenge,
    this.ffProofImageUrl,
    required this.matchesPlayed,
    required this.wins,
    required this.totalKills,
    required this.totalEarnings,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      displayName: json['display_name'] as String? ?? 'Player',
      avatarUrl: json['avatar_url'] as String?,
      ffUid: json['ff_uid'] as String?,
      ffIgn: json['ff_ign'] as String?,
      ffVerificationStatus: json['ff_verification_status'] as String? ?? 'unverified',
      ffTempChallenge: json['ff_temp_challenge'] as String?,
      ffProofImageUrl: json['ff_proof_image_url'] as String?,
      matchesPlayed: (json['matches_played'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      totalKills: (json['total_kills'] as num?)?.toInt() ?? 0,
      totalEarnings: (json['total_earnings'] as num?)?.toDouble() ?? 0.0,
    );
  }

  bool get isFfVerified => ffVerificationStatus == 'verified';
  bool get isFfPending => ffVerificationStatus == 'pending_review';
  bool get isFfChallengeIssued => ffVerificationStatus == 'challenge_issued';

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'display_name': displayName,
      'avatar_url': avatarUrl,
      'ff_uid': ffUid,
      'ff_ign': ffIgn,
      'ff_verification_status': ffVerificationStatus,
      'ff_temp_challenge': ffTempChallenge,
      'ff_proof_image_url': ffProofImageUrl,
      'matches_played': matchesPlayed,
      'wins': wins,
      'total_kills': totalKills,
      'total_earnings': totalEarnings,
    };
  }
}

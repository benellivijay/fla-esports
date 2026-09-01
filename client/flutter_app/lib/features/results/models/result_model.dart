class MatchResultModel {
  final String id;
  final String tournamentId;
  final String entryId;
  final String userId;
  final int claimedRank;
  final int claimedKills;
  final String screenshotUrl;
  final int? adminConfirmedRank;
  final int? adminConfirmedKills;
  final String status; // 'pending_review' | 'approved' | 'rejected' | 'disputed'
  final String? rejectionReason;
  final DateTime createdAt;

  MatchResultModel({
    required this.id,
    required this.tournamentId,
    required this.entryId,
    required this.userId,
    required this.claimedRank,
    required this.claimedKills,
    required this.screenshotUrl,
    this.adminConfirmedRank,
    this.adminConfirmedKills,
    required this.status,
    this.rejectionReason,
    required this.createdAt,
  });

  factory MatchResultModel.fromJson(Map<String, dynamic> json) {
    return MatchResultModel(
      id: json['id'] as String,
      tournamentId: json['tournament_id'] as String,
      entryId: json['entry_id'] as String,
      userId: json['user_id'] as String,
      claimedRank: (json['claimed_rank'] as num).toInt(),
      claimedKills: (json['claimed_kills'] as num?)?.toInt() ?? 0,
      screenshotUrl: json['screenshot_url'] as String,
      adminConfirmedRank: (json['admin_confirmed_rank'] as num?)?.toInt(),
      adminConfirmedKills: (json['admin_confirmed_kills'] as num?)?.toInt(),
      status: json['status'] as String? ?? 'pending_review',
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

class AdminResultQueueItemModel extends MatchResultModel {
  final String tournamentTitle;
  final String tournamentMode;
  final String tournamentMap;
  final int slotNumber;
  final String playerDisplayName;
  final String playerFfUid;
  final String playerFfIgn;

  AdminResultQueueItemModel({
    required super.id,
    required super.tournamentId,
    required super.entryId,
    required super.userId,
    required super.claimedRank,
    required super.claimedKills,
    required super.screenshotUrl,
    super.adminConfirmedRank,
    super.adminConfirmedKills,
    required super.status,
    super.rejectionReason,
    required super.createdAt,
    required this.tournamentTitle,
    required this.tournamentMode,
    required this.tournamentMap,
    required this.slotNumber,
    required this.playerDisplayName,
    required this.playerFfUid,
    required this.playerFfIgn,
  });

  factory AdminResultQueueItemModel.fromJson(Map<String, dynamic> json) {
    return AdminResultQueueItemModel(
      id: json['id'] as String,
      tournamentId: json['tournament_id'] as String,
      entryId: json['entry_id'] as String,
      userId: json['user_id'] as String,
      claimedRank: (json['claimed_rank'] as num).toInt(),
      claimedKills: (json['claimed_kills'] as num?)?.toInt() ?? 0,
      screenshotUrl: json['screenshot_url'] as String,
      adminConfirmedRank: (json['admin_confirmed_rank'] as num?)?.toInt(),
      adminConfirmedKills: (json['admin_confirmed_kills'] as num?)?.toInt(),
      status: json['status'] as String? ?? 'pending_review',
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      tournamentTitle: json['tournament_title'] as String? ?? 'Tournament Match',
      tournamentMode: json['tournament_mode'] as String? ?? 'solo',
      tournamentMap: json['tournament_map'] as String? ?? 'Bermuda',
      slotNumber: (json['slot_number'] as num?)?.toInt() ?? 0,
      playerDisplayName: json['player_display_name'] as String? ?? 'Player',
      playerFfUid: json['player_ff_uid'] as String? ?? '',
      playerFfIgn: json['player_ff_ign'] as String? ?? '',
    );
  }
}

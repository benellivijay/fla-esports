class PrizeDistributionItem {
  final dynamic rank;
  final double amount;
  final double? percentage;

  PrizeDistributionItem({
    required this.rank,
    required this.amount,
    this.percentage,
  });

  factory PrizeDistributionItem.fromJson(Map<String, dynamic> json) {
    return PrizeDistributionItem(
      rank: json['rank'],
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      percentage: (json['percentage'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'rank': rank,
      'amount': amount,
      if (percentage != null) 'percentage': percentage,
    };
  }
}

class TournamentModel {
  final String id;
  final String title;
  final String? description;
  final String game;
  final String gameMode; // 'ff_max' | 'survival' | 'free_match' | 'lone_wolf' | 'headshot_only' | 'one_tap' | 'sniper_1v1' | 'lone_wolf_headshot'
  final String mode; // 'solo' | 'duo' | 'squad'
  final String map; // 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NexTerra'
  final String entryType; // 'free' | 'paid'
  final double entryFee;
  final double prizePool;
  final List<PrizeDistributionItem> prizeDistribution;
  final double perKillPrize;
  final int maxSlots;
  final int filledSlots;
  final DateTime startTime;
  final DateTime? registrationClosesAt;
  final int roomRevealTimeMinutes;
  final String? roomId;
  final String? roomPassword;
  final bool roomRevealed;
  final DateTime? roomRevealedAt;
  final DateTime? roomUpdatedAt;
  final String? roomUpdatedBy;
  final String status; // 'upcoming' | 'open' | 'ongoing' | 'completed' | 'cancelled'
  final String? bannerUrl;
  final String? rules;

  TournamentModel({
    required this.id,
    required this.title,
    this.description,
    required this.game,
    this.gameMode = 'survival',
    required this.mode,
    required this.map,
    required this.entryType,
    required this.entryFee,
    required this.prizePool,
    required this.prizeDistribution,
    required this.perKillPrize,
    required this.maxSlots,
    required this.filledSlots,
    required this.startTime,
    this.registrationClosesAt,
    required this.roomRevealTimeMinutes,
    this.roomId,
    this.roomPassword,
    required this.roomRevealed,
    this.roomRevealedAt,
    this.roomUpdatedAt,
    this.roomUpdatedBy,
    required this.status,
    this.bannerUrl,
    this.rules,
  });

  factory TournamentModel.fromJson(Map<String, dynamic> json) {
    List<PrizeDistributionItem> prizes = [];
    if (json['prize_distribution'] is List) {
      prizes = (json['prize_distribution'] as List)
          .map((i) => PrizeDistributionItem.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    return TournamentModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      game: json['game'] as String? ?? 'Free Fire',
      gameMode: json['game_mode'] as String? ?? json['gameMode'] as String? ?? 'survival',
      mode: json['mode'] as String? ?? 'solo',
      map: json['map'] as String? ?? 'Bermuda',
      entryType: json['entry_type'] as String? ?? 'paid',
      entryFee: (json['entry_fee'] as num?)?.toDouble() ?? 0.0,
      prizePool: (json['prize_pool'] as num?)?.toDouble() ?? 0.0,
      prizeDistribution: prizes,
      perKillPrize: (json['per_kill_prize'] as num?)?.toDouble() ?? 0.0,
      maxSlots: (json['max_slots'] as num?)?.toInt() ?? 48,
      filledSlots: (json['filled_slots'] as num?)?.toInt() ?? 0,
      startTime: DateTime.tryParse(json['start_time'] as String? ?? '') ?? DateTime.now(),
      registrationClosesAt: json['registration_closes_at'] != null 
          ? DateTime.tryParse(json['registration_closes_at'] as String) 
          : null,
      roomRevealTimeMinutes: (json['room_reveal_time_minutes'] as num?)?.toInt() ?? 15,
      roomId: json['room_id'] as String?,
      roomPassword: json['room_password'] as String?,
      roomRevealed: json['room_revealed'] == true || json['room_revealed'] == 1,
      roomRevealedAt: json['room_revealed_at'] != null 
          ? DateTime.tryParse(json['room_revealed_at'] as String) 
          : null,
      roomUpdatedAt: json['room_updated_at'] != null 
          ? DateTime.tryParse(json['room_updated_at'] as String) 
          : null,
      roomUpdatedBy: json['room_updated_by'] as String?,
      status: json['status'] as String? ?? 'upcoming',
      bannerUrl: json['banner_url'] as String?,
      rules: json['rules'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'game': game,
      'game_mode': gameMode,
      'mode': mode,
      'map': map,
      'entry_type': entryType,
      'entry_fee': entryFee,
      'prize_pool': prizePool,
      'prize_distribution': prizeDistribution.map((p) => p.toJson()).toList(),
      'per_kill_prize': perKillPrize,
      'max_slots': maxSlots,
      'filled_slots': filledSlots,
      'start_time': startTime.toIso8601String(),
      'registration_closes_at': registrationClosesAt?.toIso8601String(),
      'room_reveal_time_minutes': roomRevealTimeMinutes,
      'room_id': roomId,
      'room_password': roomPassword,
      'room_revealed': roomRevealed,
      'room_revealed_at': roomRevealedAt?.toIso8601String(),
      'room_updated_at': roomUpdatedAt?.toIso8601String(),
      'room_updated_by': roomUpdatedBy,
      'status': status,
      'banner_url': bannerUrl,
      'rules': rules,
    };
  }

  bool get isPaid => entryType == 'paid';
  bool get isFull => filledSlots >= maxSlots;
  int get availableSlots => maxSlots - filledSlots;
  bool get isRoomSet => roomId != null && roomId!.trim().isNotEmpty;
  
  String get roomStatusProgression {
    if (!isRoomSet) return 'not_set';
    if (roomRevealed) return 'released';
    return 'set_unreleased';
  }
}

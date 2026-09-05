class SlotItemModel {
  final int slotNumber;
  final String status; // 'available' | 'booked'
  final String? bookedBy;
  final bool isCurrentUser;

  SlotItemModel({
    required this.slotNumber,
    required this.status,
    this.bookedBy,
    required this.isCurrentUser,
  });

  factory SlotItemModel.fromJson(Map<String, dynamic> json) {
    return SlotItemModel(
      slotNumber: (json['slotNumber'] as num).toInt(),
      status: json['status'] as String? ?? 'available',
      bookedBy: json['bookedBy'] as String?,
      isCurrentUser: json['isCurrentUser'] == true,
    );
  }

  bool get isAvailable => status == 'available';
  bool get isBooked => status == 'booked';
}

class SlotGridModel {
  final String tournamentId;
  final String mode;
  final int maxSlots;
  final int filledSlots;
  final int availableSlotsCount;
  final int? currentUserBookedSlot;
  final List<int> currentUserBookedSlots;
  final List<SlotItemModel> slots;

  SlotGridModel({
    required this.tournamentId,
    required this.mode,
    required this.maxSlots,
    required this.filledSlots,
    required this.availableSlotsCount,
    this.currentUserBookedSlot,
    this.currentUserBookedSlots = const [],
    required this.slots,
  });

  factory SlotGridModel.fromJson(Map<String, dynamic> json) {
    final List slotList = json['slots'] ?? [];
    final rawBookedSlots = json['currentUserBookedSlots'];
    final List<int> userSlots = rawBookedSlots is List
        ? rawBookedSlots.map((e) => (e as num).toInt()).toList()
        : (json['currentUserBookedSlot'] != null ? [(json['currentUserBookedSlot'] as num).toInt()] : []);

    return SlotGridModel(
      tournamentId: json['tournamentId'] as String,
      mode: json['mode'] as String? ?? 'solo',
      maxSlots: (json['maxSlots'] as num?)?.toInt() ?? 48,
      filledSlots: (json['filledSlots'] as num?)?.toInt() ?? 0,
      availableSlotsCount: (json['availableSlotsCount'] as num?)?.toInt() ?? 0,
      currentUserBookedSlot: json['currentUserBookedSlot'] != null 
          ? (json['currentUserBookedSlot'] as num).toInt() 
          : (userSlots.isNotEmpty ? userSlots.first : null),
      currentUserBookedSlots: userSlots,
      slots: slotList.map((s) => SlotItemModel.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }
}

class UserBookingMatchModel {
  final String entryId;
  final int slotNumber;
  final List<int> slotNumbers;
  final String? teamName;
  final String playerFfUid;
  final String playerFfIgn;
  final double entryFeePaid;
  final String bookingStatus;
  final String tournamentId;
  final String title;
  final String game;
  final String mode;
  final String map;
  final String entryType;
  final double prizePool;
  final double perKillPrize;
  final DateTime startTime;
  final String? roomId;
  final String? roomPassword;
  final bool roomRevealed;
  final String tournamentStatus;

  final List<Map<String, dynamic>> teammates;

  UserBookingMatchModel({
    required this.entryId,
    required this.slotNumber,
    this.slotNumbers = const [],
    this.teamName,
    required this.playerFfUid,
    required this.playerFfIgn,
    required this.entryFeePaid,
    required this.bookingStatus,
    required this.tournamentId,
    required this.title,
    required this.game,
    required this.mode,
    required this.map,
    required this.entryType,
    required this.prizePool,
    required this.perKillPrize,
    required this.startTime,
    this.roomId,
    this.roomPassword,
    required this.roomRevealed,
    required this.tournamentStatus,
    this.teammates = const [],
  });

  String get slotDisplayLabel {
    final effectiveSlots = slotNumbers.isNotEmpty ? slotNumbers : [slotNumber];
    if (mode == 'squad') {
      final team = ((slotNumber - 1) ~/ 4) + 1;
      return 'Team $team • Squad (${effectiveSlots.join(", ")})';
    } else if (mode == 'duo') {
      final team = ((slotNumber - 1) ~/ 2) + 1;
      return 'Team $team • Duo (${effectiveSlots.join(", ")})';
    }
    return 'Slot #$slotNumber';
  }

  String? get rosterSummary {
    if (teammates.isEmpty) return null;
    final names = teammates
        .map((t) => t['ffIgn']?.toString() ?? t['ffUid']?.toString() ?? '')
        .where((n) => n.isNotEmpty)
        .toList();
    if (names.isEmpty) return null;
    return names.join(' • ');
  }

  factory UserBookingMatchModel.fromJson(Map<String, dynamic> json) {
    final rawSlots = json['slot_numbers'];
    final List<int> slotNumbersList = rawSlots is List
        ? rawSlots.map((e) => (e as num).toInt()).toList()
        : [(json['slot_number'] as num).toInt()];

    final rawTeammates = json['teammates'] ?? json['teammate_details'];
    final List<Map<String, dynamic>> parsedTeammates = [];
    if (rawTeammates is List) {
      for (var item in rawTeammates) {
        if (item is Map<String, dynamic>) {
          parsedTeammates.add(item);
        } else if (item is Map) {
          parsedTeammates.add(Map<String, dynamic>.from(item));
        }
      }
    }

    return UserBookingMatchModel(
      entryId: json['entry_id'] as String,
      slotNumber: (json['slot_number'] as num).toInt(),
      slotNumbers: slotNumbersList,
      teamName: json['team_name'] as String?,
      playerFfUid: json['player_ff_uid'] as String,
      playerFfIgn: json['player_ff_ign'] as String,
      entryFeePaid: (json['entry_fee_paid'] as num?)?.toDouble() ?? 0.0,
      bookingStatus: json['booking_status'] as String? ?? 'confirmed',
      tournamentId: json['tournament_id'] as String,
      title: json['title'] as String,
      game: json['game'] as String? ?? 'Free Fire',
      mode: json['mode'] as String? ?? 'solo',
      map: json['map'] as String? ?? 'Bermuda',
      entryType: json['entry_type'] as String? ?? 'paid',
      prizePool: (json['prize_pool'] as num?)?.toDouble() ?? 0.0,
      perKillPrize: (json['per_kill_prize'] as num?)?.toDouble() ?? 0.0,
      startTime: DateTime.tryParse(json['start_time'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      roomId: json['room_id'] as String?,
      roomPassword: json['room_password'] as String?,
      roomRevealed: json['room_revealed'] == true || json['room_revealed'] == 1,
      tournamentStatus: json['tournament_status'] as String? ?? 'upcoming',
      teammates: parsedTeammates,
    );
  }
}

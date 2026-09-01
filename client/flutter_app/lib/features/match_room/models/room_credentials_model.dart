class RoomCredentialsModel {
  final String tournamentId;
  final String title;
  final bool isRevealed;
  final String? roomId;
  final String? roomPassword;
  final int? slotNumber;
  final String? teamName;
  final int timeRemainingSeconds;
  final int revealTimeRemainingSeconds;
  final String mode;
  final String map;
  final String status;
  final String? rules;

  RoomCredentialsModel({
    required this.tournamentId,
    required this.title,
    required this.isRevealed,
    this.roomId,
    this.roomPassword,
    this.slotNumber,
    this.teamName,
    required this.timeRemainingSeconds,
    required this.revealTimeRemainingSeconds,
    required this.mode,
    required this.map,
    required this.status,
    this.rules,
  });

  factory RoomCredentialsModel.fromJson(Map<String, dynamic> json) {
    return RoomCredentialsModel(
      tournamentId: json['tournamentId'] as String,
      title: json['title'] as String? ?? 'Tournament Match',
      isRevealed: json['isRevealed'] == true,
      roomId: json['roomId'] as String?,
      roomPassword: json['roomPassword'] as String?,
      slotNumber: (json['slotNumber'] as num?)?.toInt(),
      teamName: json['teamName'] as String?,
      timeRemainingSeconds: (json['timeRemainingSeconds'] as num?)?.toInt() ?? 0,
      revealTimeRemainingSeconds: (json['revealTimeRemainingSeconds'] as num?)?.toInt() ?? 0,
      mode: json['mode'] as String? ?? 'solo',
      map: json['map'] as String? ?? 'Bermuda',
      status: json['status'] as String? ?? 'upcoming',
      rules: json['rules'] as String?,
    );
  }
}

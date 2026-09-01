import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/room_credentials_model.dart';

class MatchRoomState {
  final bool isLoading;
  final RoomCredentialsModel? room;
  final int currentCountdownSeconds;
  final String? errorMessage;

  const MatchRoomState({
    this.isLoading = false,
    this.room,
    this.currentCountdownSeconds = 0,
    this.errorMessage,
  });

  MatchRoomState copyWith({
    bool? isLoading,
    RoomCredentialsModel? room,
    int? currentCountdownSeconds,
    String? errorMessage,
  }) {
    return MatchRoomState(
      isLoading: isLoading ?? this.isLoading,
      room: room ?? this.room,
      currentCountdownSeconds: currentCountdownSeconds ?? this.currentCountdownSeconds,
      errorMessage: errorMessage,
    );
  }
}

final matchRoomProvider = StateNotifierProvider.family<MatchRoomNotifier, MatchRoomState, String>((ref, tournamentId) {
  return MatchRoomNotifier(tournamentId);
});

class MatchRoomNotifier extends StateNotifier<MatchRoomState> {
  final String tournamentId;
  final ApiClient _apiClient = ApiClient();
  Timer? _countdownTimer;

  MatchRoomNotifier(this.tournamentId) : super(const MatchRoomState()) {
    fetchRoomDetails();
  }

  Future<void> fetchRoomDetails() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/tournaments/$tournamentId/room');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final room = RoomCredentialsModel.fromJson(res.data['data']);
        final seconds = room.isRevealed ? room.timeRemainingSeconds : room.revealTimeRemainingSeconds;
        state = state.copyWith(
          isLoading: false,
          room: room,
          currentCountdownSeconds: seconds,
        );
        _startTimer();
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load match room.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  void _startTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.currentCountdownSeconds > 0) {
        state = state.copyWith(currentCountdownSeconds: state.currentCountdownSeconds - 1);
      } else {
        timer.cancel();
        // If countdown reached 0 and room wasn't revealed yet, re-fetch to get unlocked credentials!
        if (state.room?.isRevealed == false) {
          fetchRoomDetails();
        }
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }
}

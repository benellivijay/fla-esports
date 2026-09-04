import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/tournament_model.dart';

class TournamentFilterState {
  final String entryType; // 'all' | 'free' | 'paid'
  final String gameMode; // 'all' | 'ff_max' | 'survival' | 'free_match' | 'lone_wolf' | 'headshot_only' | 'one_tap' | 'sniper_1v1' | 'lone_wolf_headshot'
  final String mode; // 'all' | 'solo' | 'duo' | 'squad'
  final String map; // 'all' | 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NexTerra'
  final String searchQuery;

  const TournamentFilterState({
    this.entryType = 'all',
    this.gameMode = 'all',
    this.mode = 'all',
    this.map = 'all',
    this.searchQuery = '',
  });

  TournamentFilterState copyWith({
    String? entryType,
    String? gameMode,
    String? mode,
    String? map,
    String? searchQuery,
  }) {
    return TournamentFilterState(
      entryType: entryType ?? this.entryType,
      gameMode: gameMode ?? this.gameMode,
      mode: mode ?? this.mode,
      map: map ?? this.map,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class TournamentListState {
  final bool isLoading;
  final List<TournamentModel> tournaments;
  final TournamentFilterState filters;
  final Map<String, Map<String, int>> gameModeStats;
  final String? errorMessage;

  const TournamentListState({
    this.isLoading = false,
    this.tournaments = const [],
    this.filters = const TournamentFilterState(),
    this.gameModeStats = const {},
    this.errorMessage,
  });

  TournamentListState copyWith({
    bool? isLoading,
    List<TournamentModel>? tournaments,
    TournamentFilterState? filters,
    Map<String, Map<String, int>>? gameModeStats,
    String? errorMessage,
  }) {
    return TournamentListState(
      isLoading: isLoading ?? this.isLoading,
      tournaments: tournaments ?? this.tournaments,
      filters: filters ?? this.filters,
      gameModeStats: gameModeStats ?? this.gameModeStats,
      errorMessage: errorMessage,
    );
  }
}

final tournamentListProvider = StateNotifierProvider<TournamentListNotifier, TournamentListState>((ref) {
  return TournamentListNotifier();
});

class TournamentListNotifier extends StateNotifier<TournamentListState> {
  final ApiClient _apiClient = ApiClient();

  TournamentListNotifier() : super(const TournamentListState()) {
    fetchTournaments();
    fetchGameModeStats();
  }

  Future<void> setFilters({String? entryType, String? gameMode, String? mode, String? map, String? searchQuery}) async {
    state = state.copyWith(
      filters: state.filters.copyWith(
        entryType: entryType,
        gameMode: gameMode,
        mode: mode,
        map: map,
        searchQuery: searchQuery,
      ),
    );
    await fetchTournaments();
  }

  Future<void> fetchGameModeStats() async {
    try {
      final res = await _apiClient.dio.get('/tournaments/game-modes/stats');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final Map<String, dynamic> raw = res.data['stats'] ?? {};
        final Map<String, Map<String, int>> parsed = {};
        raw.forEach((k, v) {
          if (v is Map) {
            parsed[k] = {
              'liveCount': (v['liveCount'] as num?)?.toInt() ?? 0,
              'totalCount': (v['totalCount'] as num?)?.toInt() ?? 0,
            };
          }
        });
        state = state.copyWith(gameModeStats: parsed);
      }
    } catch (_) {}
  }

  Future<void> fetchTournaments() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final queryParams = <String, dynamic>{};
      if (state.filters.entryType != 'all') queryParams['entryType'] = state.filters.entryType;
      if (state.filters.gameMode != 'all') queryParams['game_mode'] = state.filters.gameMode;
      if (state.filters.mode != 'all') queryParams['mode'] = state.filters.mode;
      if (state.filters.map != 'all') queryParams['map'] = state.filters.map;
      if (state.filters.searchQuery.isNotEmpty) queryParams['search'] = state.filters.searchQuery;

      final res = await _apiClient.dio.get(
        '/tournaments',
        queryParameters: queryParams,
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final List list = res.data['tournaments'] ?? [];
        final parsed = list.map((item) => TournamentModel.fromJson(item as Map<String, dynamic>)).toList();

        state = state.copyWith(
          isLoading: false,
          tournaments: parsed,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load tournaments.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<String?> createTournament(Map<String, dynamic> data) async {
    try {
      final res = await _apiClient.dio.post('/tournaments', data: data);
      if ((res.statusCode == 200 || res.statusCode == 201) && res.data['success'] == true) {
        await fetchTournaments();
        return null;
      }
      return res.data?['message']?.toString() ?? 'Failed to publish tournament.';
    } catch (e) {
      try {
        final msg = (e as dynamic).response?.data?['message']?.toString();
        if (msg != null && msg.isNotEmpty) return msg;
      } catch (_) {}
      return 'Failed to publish tournament. Please check details.';
    }
  }
}
